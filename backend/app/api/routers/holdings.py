from __future__ import annotations

from datetime import datetime
from typing import Any

import yaml
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from app.api.deps import get_config, get_holdings_user_id
from app.storage.db import (
    archive_holding,
    create_or_replace_holding,
    export_holdings_as_portfolio,
    import_holdings_from_portfolio,
    list_holdings,
    update_holding_fields,
)

router = APIRouter(prefix="/api/holdings", tags=["持仓"])


class HoldingCreateIn(BaseModel):
    fund_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    bucket: str = Field(min_length=1)
    market_group: str | None = None
    market_value_cny: float = 0.0
    cost_basis_cny: float = 0.0
    shares: float = 0.0
    cost: float | None = None
    start_date: str | None = None
    tags: list[str] | None = None


class HoldingUpdateIn(BaseModel):
    name: str | None = None
    bucket: str | None = None
    market_group: str | None = None
    tags: list[str] | None = None
    market_value_cny: float | None = None
    cost_basis_cny: float | None = None
    shares: float | None = None
    start_date: str | None = None


class ImportYamlIn(BaseModel):
    mode: str = Field(default="if_empty", description="if_empty/append/replace")


@router.get("")
async def get_holdings(
    request: Request,
    include_archived: bool = Query(default=False, description="是否包含已归档持仓"),
) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    holdings = list_holdings(user_id=user_id, include_archived=include_archived)
    return {
        "holdings": holdings,
        "count": len(holdings),
        "include_archived": include_archived,
    }


@router.post("/import_yaml")
async def import_yaml(request: Request, payload: ImportYamlIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    config = get_config(request)
    portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    try:
        result = import_holdings_from_portfolio(user_id=user_id, portfolio=portfolio, mode=payload.mode)
    except ValueError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=400)

    if int(result.get("configured_count", 0)) <= 0:
        return JSONResponse({"detail": "当前配置中没有可导入的持仓"}, status_code=400)

    return {
        "result": result,
        "imported_at": datetime.now().astimezone().isoformat(),
    }


@router.get("/export_yaml")
async def export_yaml(
    request: Request,
    include_archived: bool = Query(default=False, description="导出时是否包含已归档持仓"),
) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    portfolio = export_holdings_as_portfolio(user_id=user_id, include_archived=include_archived)
    yaml_text = yaml.safe_dump(portfolio, allow_unicode=True, sort_keys=False)
    return {
        "portfolio": portfolio,
        "yaml": yaml_text,
        "include_archived": include_archived,
        "exported_at": datetime.now().astimezone().isoformat(),
    }


@router.post("")
async def create_holding(request: Request, payload: HoldingCreateIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    try:
        holding = create_or_replace_holding(user_id=user_id, item=payload.model_dump(exclude_none=True))
    except ValueError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=400)
    return {"holding": holding}


@router.patch("/{fund_id}")
async def patch_holding(request: Request, fund_id: str, payload: HoldingUpdateIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    updates = payload.model_dump(exclude_none=True)
    updated = update_holding_fields(user_id=user_id, fund_id=fund_id, updates=updates)
    if not updated:
        return JSONResponse({"detail": "未找到可更新的持仓，或本次未提交有效字段"}, status_code=400)
    return {"holding": updated}


@router.post("/{fund_id}/archive")
async def archive(request: Request, fund_id: str) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    archived = archive_holding(user_id=user_id, fund_id=fund_id)
    if not archived:
        return JSONResponse({"detail": "未找到可归档的持仓"}, status_code=404)
    return {"holding": archived}
