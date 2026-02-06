from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, get_snapshot_user_id, is_admin
from app.estimator.engine import build_estimate
from app.storage.db import list_holdings, save_estimate_snapshot

router = APIRouter(prefix="/api", tags=["估值"])


@router.get("/estimate")
async def get_estimate(request: Request) -> dict:
    config = get_config(request)
    if is_admin(request):
        portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    else:
        holdings = list_holdings(get_holdings_user_id(request))
        portfolio = {"holdings": holdings}

    payload = build_estimate(portfolio=portfolio)
    save_estimate_snapshot(get_snapshot_user_id(request), payload["asof"], payload)
    return payload
