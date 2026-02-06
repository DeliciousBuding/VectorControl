from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, get_snapshot_user_id, is_admin
from app.estimator.engine import build_estimate
from app.risk.engine import build_risk_overview
from app.storage.db import list_estimate_snapshots, list_holdings

router = APIRouter(prefix="/api/risk", tags=["风险"])


@router.get("/overview")
async def get_risk_overview(request: Request) -> dict:
    config = get_config(request)
    snapshot_user_id = get_snapshot_user_id(request)

    if is_admin(request):
        portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    else:
        holdings = list_holdings(get_holdings_user_id(request))
        portfolio = {"holdings": holdings}

    latest_estimate = build_estimate(portfolio=portfolio)
    funds = latest_estimate.get("funds", []) if isinstance(latest_estimate, dict) else []
    snapshots = list_estimate_snapshots(snapshot_user_id, limit=240)
    risk = build_risk_overview(funds=funds, snapshots=snapshots)
    risk["asof"] = latest_estimate.get("asof")
    risk["holdings_count"] = len(funds)
    return risk
