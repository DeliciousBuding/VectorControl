from __future__ import annotations

from datetime import datetime, timedelta, timezone
from time import perf_counter

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, get_snapshot_user_id, is_admin
from app.core.settings import get_env
from app.estimator.engine import build_estimate
from app.risk.engine import build_risk_overview
from app.storage.db import (
    get_confirmed_fund_profit_map,
    get_latest_estimate_snapshot,
    get_latest_estimate_snapshot_on_or_before,
    list_holdings,
    list_estimate_snapshots,
    save_estimate_snapshot,
)

router = APIRouter(prefix="/api", tags=["估值"])


def _yesterday_str() -> str:
    return (datetime.now().astimezone().date() - timedelta(days=1)).isoformat()


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _estimate_cache_ttl_seconds() -> int:
    raw = (get_env("VC_ESTIMATE_CACHE_SECONDS", "20") or "20").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 20
    return max(0, min(value, 300))


def _snapshot_age_seconds(snapshot: dict | None) -> float | None:
    if not isinstance(snapshot, dict):
        return None
    asof_raw = str(snapshot.get("asof") or snapshot.get("as_of") or "").strip()
    if not asof_raw:
        return None
    try:
        asof_time = datetime.fromisoformat(asof_raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if asof_time.tzinfo is None:
        asof_time = asof_time.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    age = (now - asof_time.astimezone(timezone.utc)).total_seconds()
    return max(0.0, age)


def _attach_risk_overview(payload: dict, snapshot_user_id: str) -> None:
    if not isinstance(payload, dict):
        return
    if isinstance(payload.get("risk_overview"), dict):
        return

    funds = payload.get("funds", [])
    if not isinstance(funds, list):
        funds = []

    snapshots = list_estimate_snapshots(snapshot_user_id, limit=240)
    risk = build_risk_overview(funds=funds, snapshots=snapshots)
    risk["asof"] = payload.get("asof") or payload.get("as_of")
    risk["holdings_count"] = len(funds)
    payload["risk_overview"] = risk


@router.get("/estimate")
async def get_estimate(request: Request) -> dict:
    request_started = perf_counter()
    config = get_config(request)
    if is_admin(request):
        portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    else:
        holdings = list_holdings(get_holdings_user_id(request))
        portfolio = {"holdings": holdings}

    snapshot_user_id = get_snapshot_user_id(request)
    prefer_cached = _to_bool(request.query_params.get("prefer_cached"), default=True)
    force_refresh = _to_bool(request.query_params.get("force_refresh"), default=False)
    cache_ttl_seconds = _estimate_cache_ttl_seconds()

    if cache_ttl_seconds > 0 and prefer_cached and not force_refresh:
        latest_snapshot = get_latest_estimate_snapshot(snapshot_user_id)
        snapshot_age_seconds = _snapshot_age_seconds(latest_snapshot)
        if latest_snapshot and snapshot_age_seconds is not None and snapshot_age_seconds <= cache_ttl_seconds:
            payload = dict(latest_snapshot)
            _attach_risk_overview(payload, snapshot_user_id)
            payload["cache_hit"] = True
            payload["cache_age_seconds"] = round(snapshot_age_seconds, 3)
            payload["server_elapsed_ms"] = int((perf_counter() - request_started) * 1000)
            return payload

    yesterday = _yesterday_str()
    estimate_started = perf_counter()
    payload = build_estimate(
        portfolio=portfolio,
        previous_snapshot=get_latest_estimate_snapshot_on_or_before(snapshot_user_id, yesterday),
        confirmed_yesterday_profit=get_confirmed_fund_profit_map(snapshot_user_id, yesterday),
    )
    payload["cache_hit"] = False
    payload["cache_age_seconds"] = 0
    payload["build_elapsed_ms"] = int((perf_counter() - estimate_started) * 1000)
    _attach_risk_overview(payload, snapshot_user_id)
    payload["server_elapsed_ms"] = int((perf_counter() - request_started) * 1000)
    save_estimate_snapshot(snapshot_user_id, payload["asof"], payload)
    return payload
