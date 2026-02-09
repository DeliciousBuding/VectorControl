from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.api.deps import build_data_status, get_snapshot_user_id
from app.storage.db import list_estimate_snapshots

router = APIRouter(prefix="/api/charts", tags=["图表"])
ALLOWED_RETURNS_HISTORY_DAYS = {7, 30, 90}


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


def _calculate_total_return(snapshot: dict[str, Any]) -> float:
    """计算单个快照的总收益率（%）"""
    return float(_summarize_snapshot(snapshot).get("total_return") or 0.0)


def _calculate_day_profit(snapshot: dict[str, Any]) -> float:
    """计算单个快照的当日收益（CNY）"""
    return float(_summarize_snapshot(snapshot).get("day_profit") or 0.0)


@router.get("/returns_history")
async def get_returns_history(
    request: Request,
    days: int | None = Query(default=None, description="仅允许 7/30/90，默认 30"),
) -> dict[str, Any]:
    """获取历史收益率曲线数据"""
    user_id = get_snapshot_user_id(request)

    if days is None:
        days = 30
    elif int(days) not in ALLOWED_RETURNS_HISTORY_DAYS:
        trace_id = uuid.uuid4().hex[:12]
        raise HTTPException(status_code=422, detail=f"days 参数非法，仅允许 7/30/90 (trace_id={trace_id})")

    # 获取足够多的历史快照：按每日至多 2 个估算快照粗略估算。
    limit = min(days * 2, 500)
    snapshots = list_estimate_snapshots(user_id, limit=limit)

    if not snapshots:
        return {
            "data": [],
            "data_status": build_data_status(
                status="partial",
                asof=datetime.now().astimezone().isoformat(),
                note="暂无历史数据",
            ),
        }

    # 按日期分组，每天取最后一个快照。
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
                "asof": asof_text,
                "total_market_value_cny": float(summary.get("total_market_value_cny") or 0.0),
                "total_cost_basis_cny": float(summary.get("total_cost_basis_cny") or 0.0),
                "total_return": float(summary.get("total_return") or 0.0),
                "day_profit": float(summary.get("day_profit") or 0.0),
                "_asof_dt": asof_dt,
            }

    data = sorted(daily_data.values(), key=lambda x: str(x.get("date") or ""))
    data = [{k: v for k, v in item.items() if k != "_asof_dt"} for item in data]
    if len(data) > days:
        data = data[-days:]

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

    limit = min(days * 2, 500)
    snapshots = list_estimate_snapshots(user_id, limit=limit)

    if not snapshots:
        return {
            "labels": [],
            "values": [],
            "data_status": build_data_status(
                status="partial",
                asof="",
                note="暂无历史数据",
            ),
        }

    daily_data: dict[str, dict[str, Any]] = {}

    for snapshot in snapshots:
        resolved = _resolve_snapshot_asof(snapshot)
        if resolved is None:
            continue
        asof_text, asof_dt = resolved

        date_key = asof_dt.date().isoformat()

        existing = daily_data.get(date_key)
        existing_dt = existing.get("_asof_dt") if isinstance(existing, dict) else None
        if not isinstance(existing_dt, datetime) or asof_dt > existing_dt:
            daily_data[date_key] = {
                "date": date_key,
                "label": asof_dt.strftime("%m-%d"),
                "asof": asof_text,
                "total_return": _calculate_total_return(snapshot),
                "_asof_dt": asof_dt,
            }

    data = sorted(daily_data.values(), key=lambda x: str(x.get("date") or ""))
    data = [{k: v for k, v in item.items() if k != "_asof_dt"} for item in data]
    if len(data) > days:
        data = data[-days:]

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
