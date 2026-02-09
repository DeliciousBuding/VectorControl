from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Request

from app.api.deps import build_data_status, get_snapshot_user_id
from app.storage.db import list_estimate_snapshots

router = APIRouter(prefix="/api/benchmark", tags=["基准对比"])

# v1: 先提供“可对比的基准列表 + 组合收益率”，基准收益率暂不接入外部数据源（返回 None）。
BENCHMARKS: dict[str, dict[str, str]] = {
    "hs300": {"name": "沪深300", "code": "000300", "description": "反映中国A股市场整体表现的指数"},
    "zz500": {"name": "中证500", "code": "000905", "description": "反映中国A股市场中小市值公司表现的指数"},
    "cyb50": {"name": "创业板50", "code": "399673", "description": "反映创业板市场高成长性公司表现的指数"},
}


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _calculate_portfolio_return(snapshot_payload: dict[str, Any]) -> float:
    """计算组合总收益率（%），口径与 charts._calculate_total_return 对齐。"""
    funds = snapshot_payload.get("funds", [])
    if not isinstance(funds, list) or not funds:
        return 0.0

    total_market_value = 0.0
    total_cost = 0.0
    for fund in funds:
        if not isinstance(fund, dict):
            continue
        total_market_value += _to_float(fund.get("market_value_cny")) or 0.0
        total_cost += _to_float(fund.get("cost_basis_cny")) or 0.0

    if total_cost <= 0:
        return 0.0
    return round((total_market_value - total_cost) / total_cost * 100, 4)


@router.get("/list")
async def list_benchmarks() -> dict[str, Any]:
    return {"benchmarks": BENCHMARKS, "count": len(BENCHMARKS)}


@router.get("/comparison")
async def get_benchmark_comparison(request: Request) -> dict[str, Any]:
    """组合 vs 基准对比（v1：基准收益率暂不接入数据源）。"""
    user_id = get_snapshot_user_id(request)

    # 使用最新估值快照，便于带出 asof 时间；payload 结构与 charts/returns_history 一致。
    snaps = list_estimate_snapshots(user_id, limit=1)
    latest = snaps[-1] if snaps else None
    if not latest:
        return {
            "portfolio_return": 0.0,
            "benchmarks": BENCHMARKS,
            "comparison": {},
            "best_benchmark": None,
            "data_status": build_data_status(
                status="partial",
                asof=datetime.now().astimezone().isoformat(),
                note="暂无估值快照数据",
            ),
        }

    payload = latest.get("payload", {}) if isinstance(latest, dict) else {}
    asof = str(latest.get("asof") or "").strip() if isinstance(latest, dict) else ""
    payload = payload if isinstance(payload, dict) else {}

    portfolio_return = _calculate_portfolio_return(payload)

    comparison: dict[str, dict[str, Any]] = {}
    for bench_id in BENCHMARKS.keys():
        # v1: 未接入真实基准数据源，返回 None；前端应展示 unknown 状态而非“跑赢/跑输”。
        benchmark_return: float | None = None
        comparison[bench_id] = {
            "portfolio_return": portfolio_return,
            "benchmark_return": benchmark_return,
            "excess_return": None,
            "outperform": None,
        }

    return {
        "portfolio_return": portfolio_return,
        "benchmarks": BENCHMARKS,
        "comparison": comparison,
        "best_benchmark": None,
        "data_status": build_data_status(
            status="confirmed",
            asof=asof,
            note="组合收益率基于最新估值快照；基准收益率暂未接入数据源",
        ),
    }

