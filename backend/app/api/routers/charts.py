from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.api.deps import build_data_status, get_snapshot_user_id
from app.storage.db import list_estimate_snapshots

router = APIRouter(prefix="/api/charts", tags=["图表"])
ALLOWED_RETURNS_HISTORY_DAYS = {7, 30, 90}

# 简单的 TTL 缓存（cache_key -> (timestamp, data)）
_chart_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_SECONDS = 60  # 缓存 60 秒
_CACHE_MAX_ENTRIES = 200


def _get_cached_chart_data(cache_key: str) -> Any | None:
    """获取缓存的图表聚合数据"""
    entry = _chart_cache.get(cache_key)
    if entry is None:
        return None
    timestamp, data = entry
    if time.time() - timestamp > _CACHE_TTL_SECONDS:
        _chart_cache.pop(cache_key, None)
        return None
    return data


def _set_cached_chart_data(cache_key: str, data: Any) -> None:
    """设置缓存的图表聚合数据"""
    _chart_cache[cache_key] = (time.time(), data)
    if len(_chart_cache) <= _CACHE_MAX_ENTRIES:
        return

    now = time.time()
    expired = [key for key, (ts, _) in _chart_cache.items() if now - ts > _CACHE_TTL_SECONDS]
    for key in expired:
        _chart_cache.pop(key, None)

    overflow = len(_chart_cache) - _CACHE_MAX_ENTRIES
    if overflow <= 0:
        return

    oldest_keys = sorted(_chart_cache.items(), key=lambda item: item[1][0])[:overflow]
    for key, _ in oldest_keys:
        _chart_cache.pop(key, None)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _parse_asof_datetime(asof: str) -> datetime | None:
    """解析 asof：支持 ISO8601 与 Z；无时区时按 UTC 解释。"""
    text = str(asof or "").strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _resolve_snapshot_asof(snapshot: dict[str, Any]) -> tuple[str, datetime] | None:
    """asof 口径：优先使用快照行 asof，缺失时回退 payload.asof/as_of。"""
    asof_text = str(snapshot.get("asof") or "").strip()
    if not asof_text:
        payload = snapshot.get("payload")
        if isinstance(payload, dict):
            asof_text = str(payload.get("asof") or payload.get("as_of") or "").strip()
    if not asof_text:
        return None
    parsed = _parse_asof_datetime(asof_text)
    if parsed is None:
        return None
    return asof_text, parsed


def _summarize_snapshot(snapshot: dict[str, Any]) -> dict[str, float]:
    """汇总单个快照的组合资产、成本、收益。"""
    funds = snapshot.get("payload", {}).get("funds", [])
    if not isinstance(funds, list) or not funds:
        return {
            "total_market_value_cny": 0.0,
            "total_cost_basis_cny": 0.0,
            "total_return": 0.0,
            "day_profit": 0.0,
        }

    total_market_value = 0.0
    total_cost = 0.0
    total_day_profit = 0.0
    for fund in funds:
        if not isinstance(fund, dict):
            continue
        total_market_value += _to_float(fund.get("market_value_cny")) or 0.0
        total_cost += _to_float(fund.get("cost_basis_cny")) or 0.0
        total_day_profit += _to_float(fund.get("day_profit_cny")) or 0.0

    if total_cost <= 0:
        total_return = 0.0
    else:
        total_return = round((total_market_value - total_cost) / total_cost * 100, 4)

    return {
        "total_market_value_cny": round(total_market_value, 2),
        "total_cost_basis_cny": round(total_cost, 2),
        "total_return": total_return,
        "day_profit": round(total_day_profit, 2),
    }


def _build_daily_chart_bundle(snapshots: list[dict[str, Any]]) -> dict[str, Any]:
    """按日聚合快照，并保留同日最后一个快照。"""
    daily_data: dict[str, dict[str, Any]] = {}

    for snapshot in snapshots:
        resolved = _resolve_snapshot_asof(snapshot)
        if resolved is None:
            continue
        asof_text, asof_dt = resolved
        date_key = asof_dt.date().isoformat()
        summary = _summarize_snapshot(snapshot)

        existing = daily_data.get(date_key)
        existing_dt = existing.get("_asof_dt") if isinstance(existing, dict) else None
        if not isinstance(existing_dt, datetime) or asof_dt > existing_dt:
            daily_data[date_key] = {
                "date": date_key,
                "label": asof_dt.strftime("%m-%d"),
                "asof": asof_text,
                "total_market_value_cny": float(summary.get("total_market_value_cny") or 0.0),
                "total_cost_basis_cny": float(summary.get("total_cost_basis_cny") or 0.0),
                "total_return": float(summary.get("total_return") or 0.0),
                "day_profit": float(summary.get("day_profit") or 0.0),
                "_asof_dt": asof_dt,
            }

    daily_rows = sorted(daily_data.values(), key=lambda item: str(item.get("date") or ""))
    return {
        "has_snapshots": bool(snapshots),
        "daily_rows": daily_rows,
    }


def _get_daily_chart_bundle(user_id: str, days: int) -> dict[str, Any]:
    """获取指定快照窗口的日级聚合结果，并在接口间复用。"""
    limit = min(days * 2, 500)
    cache_key = f"daily_chart_bundle:{user_id}:{limit}"
    cached = _get_cached_chart_data(cache_key)
    if isinstance(cached, dict) and isinstance(cached.get("daily_rows"), list):
        return cached

    snapshots = list_estimate_snapshots(user_id, limit=limit)
    bundle = _build_daily_chart_bundle(snapshots)
    _set_cached_chart_data(cache_key, bundle)
    return bundle


def _prepare_chart_window(daily_rows: list[dict[str, Any]], days: int) -> list[dict[str, Any]]:
    """截取最近 N 天，保留内部聚合字段供各接口二次投影。"""
    if len(daily_rows) > days:
        return daily_rows[-days:]
    return list(daily_rows)


def _build_returns_history_rows(daily_rows: list[dict[str, Any]], days: int) -> list[dict[str, Any]]:
    """按 returns_history 原始字段投影窗口数据。"""
    rows = _prepare_chart_window(daily_rows, days)
    return [
        {
            "date": str(item.get("date") or ""),
            "asof": str(item.get("asof") or ""),
            "total_market_value_cny": float(item.get("total_market_value_cny") or 0.0),
            "total_cost_basis_cny": float(item.get("total_cost_basis_cny") or 0.0),
            "total_return": float(item.get("total_return") or 0.0),
            "day_profit": float(item.get("day_profit") or 0.0),
        }
        for item in rows
    ]


@router.get("/returns_history")
async def get_returns_history(
    request: Request,
    days: int | None = Query(default=None, description="仅允许 7/30/90，默认 30"),
) -> dict[str, Any]:
    """获取历史收益率曲线数据（复用日级聚合缓存）"""
    user_id = get_snapshot_user_id(request)

    if days is None:
        days = 30
    elif int(days) not in ALLOWED_RETURNS_HISTORY_DAYS:
        trace_id = uuid.uuid4().hex[:12]
        raise HTTPException(status_code=422, detail=f"days 参数非法，仅允许 7/30/90 (trace_id={trace_id})")

    bundle = _get_daily_chart_bundle(user_id, days)
    has_snapshots = bool(bundle.get("has_snapshots"))
    daily_rows = bundle.get("daily_rows") or []

    if not has_snapshots:
        return {
            "data": [],
            "data_status": build_data_status(
                status="partial",
                asof=datetime.now().astimezone().isoformat(),
                note="暂无历史数据",
            ),
        }

    data = _build_returns_history_rows(daily_rows, days)
    return {
        "data": data,
        "count": len(data),
        "days": days,
        "data_status": build_data_status(
            status="confirmed" if data else "partial",
            asof=str(data[-1]["asof"]) if data else "",
            note=f"包含最近 {len(data)} 天的收益率数据",
        ),
    }


@router.get("/cumulative_returns")
async def get_cumulative_returns(
    request: Request,
    days: int = Query(default=30, ge=1, le=365, description="返回多少天的历史数据"),
) -> dict[str, Any]:
    """获取累计收益曲线数据（适配前端绘图）"""
    user_id = get_snapshot_user_id(request)

    bundle = _get_daily_chart_bundle(user_id, days)
    has_snapshots = bool(bundle.get("has_snapshots"))
    daily_rows = bundle.get("daily_rows") or []

    if not has_snapshots:
        return {
            "labels": [],
            "values": [],
            "data_status": build_data_status(
                status="partial",
                asof="",
                note="暂无历史数据",
            ),
        }

    data = _prepare_chart_window(daily_rows, days)
    labels = [str(item.get("label") or "") for item in data]
    values = [float(item.get("total_return") or 0.0) for item in data]

    return {
        "labels": labels,
        "values": values,
        "count": len(data),
        "days": days,
        "data_status": build_data_status(
            status="confirmed" if data else "partial",
            asof=str(data[-1]["asof"]) if data else "",
            note=f"最近 {len(data)} 天累计收益率",
        ),
    }


@router.get("/home_dashboard")
async def get_home_dashboard(
    request: Request,
    returns_days: int = Query(default=30, ge=1, le=365, description="收益曲线天数"),
) -> dict[str, Any]:
    """
    首页仪表盘聚合API - 一次性返回首页需要的所有图表数据
    包括：累计收益曲线、收益历史、市场状态
    """
    from app.utils.market_time import get_market_status

    user_id = get_snapshot_user_id(request)
    bundle = _get_daily_chart_bundle(user_id, returns_days)
    has_snapshots = bool(bundle.get("has_snapshots"))
    daily_rows = bundle.get("daily_rows") or []

    cumulative_data: dict[str, Any] | list[Any] = []
    returns_history_data: list[dict[str, Any]] = []

    if has_snapshots:
        window_rows = _prepare_chart_window(daily_rows, returns_days)
        cumulative_data = {
            "labels": [str(item.get("label") or "") for item in window_rows],
            "values": [float(item.get("total_return") or 0.0) for item in window_rows],
            "count": len(window_rows),
        }
        returns_history_data = _build_returns_history_rows(daily_rows, returns_days)

    return {
        "cumulative_returns": cumulative_data,
        "returns_history": returns_history_data,
        "market_status": get_market_status(),
        "data_status": build_data_status(
            status="confirmed" if cumulative_data else "partial",
            asof=datetime.now().astimezone().isoformat(),
            note="首页仪表盘数据（聚合API）",
        ),
    }
