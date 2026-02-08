from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Query, Request

from app.api.deps import build_data_status, get_snapshot_user_id
from app.storage.db import list_estimate_snapshots

router = APIRouter(prefix="/api/charts", tags=["图表"])


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _calculate_total_return(snapshot: dict[str, Any]) -> float:
    """计算单个快照的总收益率"""
    funds = snapshot.get("payload", {}).get("funds", [])
    if not funds:
        return 0.0

    total_market_value = 0.0
    total_cost = 0.0

    for fund in funds:
        if not isinstance(fund, dict):
            continue
        market_value = _to_float(fund.get("market_value_cny")) or 0.0
        cost_basis = _to_float(fund.get("cost_basis_cny")) or 0.0
        total_market_value += market_value
        total_cost += cost_basis

    if total_cost <= 0:
        return 0.0

    return round((total_market_value - total_cost) / total_cost * 100, 4)


def _calculate_day_profit(snapshot: dict[str, Any]) -> float:
    """计算单个快照的当日收益"""
    funds = snapshot.get("payload", {}).get("funds", [])
    if not funds:
        return 0.0

    total = 0.0
    for fund in funds:
        if not isinstance(fund, dict):
            continue
        day_profit = _to_float(fund.get("day_profit_cny")) or 0.0
        total += day_profit

    return round(total, 2)


@router.get("/returns_history")
async def get_returns_history(
    request: Request,
    days: int = Query(default=30, ge=1, le=365, description="返回多少天的历史数据"),
) -> dict[str, Any]:
    """获取历史收益率曲线数据"""
    user_id = get_snapshot_user_id(request)

    # 获取足够多的历史快照
    limit = min(days * 2, 500)  # 每天最多2个快照
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

    # 按日期分组，每天取最后一个快照
    daily_data: dict[str, dict[str, Any]] = {}

    for snapshot in snapshots:
        asof = str(snapshot.get("asof") or "")
        if not asof:
            continue

        try:
            dt = datetime.fromisoformat(asof.replace("Z", "+00:00"))
        except ValueError:
            continue

        date_key = dt.date().isoformat()

        # 如果这一天还没有数据，或者这个快照比已有更新，则更新
        if date_key not in daily_data or asof > daily_data[date_key].get("asof", ""):
            daily_data[date_key] = {
                "date": date_key,
                "asof": asof,
                "total_return": _calculate_total_return(snapshot),
                "day_profit": _calculate_day_profit(snapshot),
            }

    # 转换为列表并按日期排序
    data = sorted(daily_data.values(), key=lambda x: x["date"])

    # 只保留最近 N 天
    if len(data) > days:
        data = data[-days:]

    return {
        "data": data,
        "count": len(data),
        "days": days,
        "data_status": build_data_status(
            status="confirmed" if data else "partial",
            asof=data[-1]["asof"] if data else "",
            note=f"包含最近 {len(data)} 天的收益率数据",
        ),
    }


@router.get("/cumulative_returns")
async def get_cumulative_returns(
    request: Request,
    days: int = Query(default=30, ge=1, le=365, description="返回多少天的历史数据"),
) -> dict[str, Any]:
    """获取累计收益曲线数据（适合绘图）"""
    user_id = get_snapshot_user_id(request)

    # 复用 get_returns_history 的逻辑
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

    # 按日期分组
    daily_data: dict[str, dict[str, Any]] = {}

    for snapshot in snapshots:
        asof = str(snapshot.get("asof") or "")
        if not asof:
            continue

        try:
            dt = datetime.fromisoformat(asof.replace("Z", "+00:00"))
        except ValueError:
            continue

        date_key = dt.date().isoformat()

        if date_key not in daily_data or asof > daily_data[date_key].get("asof", ""):
            daily_data[date_key] = {
                "date": date_key,
                "label": dt.strftime("%m-%d"),
                "asof": asof,
                "total_return": _calculate_total_return(snapshot),
            }

    # 排序并截取
    data = sorted(daily_data.values(), key=lambda x: x["date"])
    if len(data) > days:
        data = data[-days:]

    # 提取 labels 和 values（Chart.js 格式）
    labels = [item["label"] for item in data]
    values = [item["total_return"] for item in data]

    return {
        "labels": labels,
        "values": values,
        "count": len(data),
        "days": days,
        "data_status": build_data_status(
            status="confirmed" if data else "partial",
            asof=data[-1]["asof"] if data else "",
            note=f"最近 {len(data)} 天累计收益率",
        ),
    }
