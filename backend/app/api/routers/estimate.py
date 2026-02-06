from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, get_snapshot_user_id, is_admin
from app.estimator.engine import build_estimate
from app.storage.db import (
    get_confirmed_fund_profit_map,
    get_latest_estimate_snapshot_on_or_before,
    list_holdings,
    save_estimate_snapshot,
)

router = APIRouter(prefix="/api", tags=["估值"])


def _yesterday_str() -> str:
    return (datetime.now().astimezone().date() - timedelta(days=1)).isoformat()


@router.get("/estimate")
async def get_estimate(request: Request) -> dict:
    config = get_config(request)
    if is_admin(request):
        portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    else:
        holdings = list_holdings(get_holdings_user_id(request))
        portfolio = {"holdings": holdings}

    snapshot_user_id = get_snapshot_user_id(request)
    yesterday = _yesterday_str()
    payload = build_estimate(
        portfolio=portfolio,
        previous_snapshot=get_latest_estimate_snapshot_on_or_before(snapshot_user_id, yesterday),
        confirmed_yesterday_profit=get_confirmed_fund_profit_map(snapshot_user_id, yesterday),
    )
    save_estimate_snapshot(snapshot_user_id, payload["asof"], payload)
    return payload
