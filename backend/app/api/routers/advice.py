from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, is_admin
from app.estimator.engine import build_estimate
from app.policy.advice import build_advice
from app.storage.db import list_holdings

router = APIRouter(prefix="/api", tags=["策略"])


@router.get("/advice")
async def get_advice(request: Request) -> dict:
    config = get_config(request)
    policy = config.get("policy", {}) if isinstance(config, dict) else {}

    if is_admin(request):
        holdings = list_holdings("legacy")
        portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    else:
        holdings = list_holdings(get_holdings_user_id(request))
        portfolio = {"holdings": holdings}

    estimate = build_estimate(portfolio=portfolio)
    return build_advice(estimate, holdings, policy)
