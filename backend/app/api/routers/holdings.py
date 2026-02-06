from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from app.api.deps import get_holdings_user_id
from app.storage.db import archive_holding, create_or_replace_holding, list_holdings, update_holding_fields

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

