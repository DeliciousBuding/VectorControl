from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel
from starlette.responses import JSONResponse

from app.api.deps import get_holdings_user_id
from app.storage.db import update_holding_fields

router = APIRouter(prefix="/api/holdings", tags=["持仓"])


class HoldingUpdateIn(BaseModel):
    market_value_cny: float | None = None
    cost_basis_cny: float | None = None
    shares: float | None = None
    start_date: str | None = None


@router.patch("/{fund_id}")
async def patch_holding(request: Request, fund_id: str, payload: HoldingUpdateIn) -> dict:
    user_id = get_holdings_user_id(request)
    updates = payload.model_dump(exclude_none=True)
    updated = update_holding_fields(user_id=user_id, fund_id=fund_id, updates=updates)
    if not updated:
        return JSONResponse({"detail": "未找到持仓或未提供可更新字段"}, status_code=400)
    return {"holding": updated}
