from __future__ import annotations

from datetime import datetime
from typing import Any

import yaml
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from app.api.deps import build_data_status, get_config, get_holdings_user_id, get_user_id, get_username
from app.storage.db import (
    archive_holding,
    create_or_replace_holding,
    export_holdings_as_portfolio,
    import_holdings_from_portfolio,
    list_holding_audit_logs,
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
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="持仓来自本地数据库真源",
        ),
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
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="导入已写入数据库",
        ),
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
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="导出基于当前数据库快照",
        ),
    }


@router.post("")
async def create_holding(request: Request, payload: HoldingCreateIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    actor_user_id = get_user_id(request)
    actor_username = get_username(request)
    try:
        holding = create_or_replace_holding(
            user_id=user_id,
            item=payload.model_dump(exclude_none=True),
            actor_user_id=actor_user_id,
            actor_username=actor_username,
        )
    except ValueError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=400)
    return {
        "holding": holding,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="持仓已写入数据库",
        ),
    }


@router.patch("/{fund_id}")
async def patch_holding(request: Request, fund_id: str, payload: HoldingUpdateIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    actor_user_id = get_user_id(request)
    actor_username = get_username(request)
    updates = payload.model_dump(exclude_none=True)
    updated = update_holding_fields(
        user_id=user_id,
        fund_id=fund_id,
        updates=updates,
        actor_user_id=actor_user_id,
        actor_username=actor_username,
    )
    if not updated:
        return JSONResponse({"detail": "未找到可更新的持仓，或本次未提交有效字段"}, status_code=400)
    return {
        "holding": updated,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="持仓已更新到数据库",
        ),
    }


@router.post("/{fund_id}/archive")
async def archive(request: Request, fund_id: str) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    actor_user_id = get_user_id(request)
    actor_username = get_username(request)
    archived = archive_holding(
        user_id=user_id,
        fund_id=fund_id,
        actor_user_id=actor_user_id,
        actor_username=actor_username,
    )
    if not archived:
        return JSONResponse({"detail": "未找到可归档的持仓"}, status_code=404)
    return {
        "holding": archived,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="持仓已归档到数据库",
        ),
    }


@router.get("/{fund_id}")
async def get_holding_detail(
    request: Request,
    fund_id: str,
) -> dict[str, Any]:
    """获取单个基金的持仓详情"""
    user_id = get_holdings_user_id(request)
    holdings = list_holdings(user_id=user_id, include_archived=False)
    
    # 查找指定基金的持仓
    holding = next((h for h in holdings if h.get("fund_id") == fund_id), None)
    
    if not holding:
        return JSONResponse(
            {"detail": "未找到该基金持仓", "fund_id": fund_id},
            status_code=404
        )
    
    return {
        "fund_id": fund_id,
        "holding": holding,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="持仓来自本地数据库真源",
        ),
    }


@router.get("/{fund_id}/audit")
async def get_holding_audit(
    request: Request,
    fund_id: str,
    limit: int = Query(default=50, ge=1, le=500, description="返回审计记录条数"),
) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    items = list_holding_audit_logs(user_id=user_id, fund_id=fund_id, limit=limit)
    return {
        "fund_id": fund_id,
        "count": len(items),
        "items": items,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="审计记录来自 audit_logs，可用于回放持仓变更",
        ),
    }
