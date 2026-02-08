from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Request

from app.api.deps import build_data_status
from app.storage.db import get_latest_estimate_snapshot

router = APIRouter(prefix="/api/benchmark", tags=["基准对比"])

# 简化的基准指数数据（实际应该从数据源获取）
# 这里用沪深300的历史近似收益率作为示例
BENCHMARK_DATA = {
    "hs300": {
        "name": "沪深300",
        "code": "000300",
        "description": "反映中国A股市场整体表现的指数",
    },
    "zz500": {
        "name": "中证500",
        "code": "000905",
        "description": "反映中国A股市场中小市值公司表现的指数",
    },
    "cyb50": {
        "name": "创业板50",
        "code": "399673",
        "description": "反映创业板市场高成长性公司表现的指数",
    },
}


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _calculate_portfolio_return(snapshot: dict[str, Any]) -> float:
    """计算组合总收益率"""
    funds = snapshot.get("funds", [])
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


def _estimate_benchmark_return(benchmark_id: str) -> float:
    """
    估算基准收益率（简化版本）
    实际应该从真实数据源获取
    这里返回示例数据
    """
    # 实际应该调用东方财富等数据源获取基准指数的涨跌幅
    # 这里暂时返回 0，表示需要用户自己判断
    return 0.0


@router.get("/comparison")
async def get_benchmark_comparison(request: Request) -> dict[str, Any]:
    """获取组合与基准的对比数据"""
    from app.api.deps import get_snapshot_user_id

    user_id = get_snapshot_user_id(request)
    snapshot = get_latest_estimate_snapshot(user_id)

    if not snapshot:
        return {
            "portfolio_return": 0.0,
            "benchmarks": {},
            "comparison": {},
            "data_status": build_data_status(
                status="partial",
                asof="",
                note="暂无持仓数据",
            ),
        }

    portfolio_return = _calculate_portfolio_return(snapshot)
    asof = snapshot.get("asof", "")

    # 对比各个基准
    comparison = {}
    benchmarks = {}

    for bench_id, bench_info in BENCHMARK_DATA.items():
        bench_return = _estimate_benchmark_return(bench_id)
        excess_return = round(portfolio_return - bench_return, 4)

        benchmarks[bench_id] = {
            **bench_info,
            "return": bench_return,
        }

        comparison[bench_id] = {
            "portfolio_return": portfolio_return,
            "benchmark_return": bench_return,
            "excess_return": excess_return,
            "outperform": excess_return > 0,
        }

    return {
        "portfolio_return": portfolio_return,
        "benchmarks": benchmarks,
        "comparison": comparison,
        "best_benchmark": max(
            comparison.items(),
            key=lambda x: x[1]["excess_return"],
            default=(None, None),
        )[0],
        "data_status": build_data_status(
            status="confirmed",
            asof=asof,
            note="基准对比基于最新估值快照计算",
        ),
    }


@router.get("/list")
async def list_benchmarks() -> dict[str, Any]:
    """列出所有可用的基准指数"""
    return {
        "benchmarks": BENCHMARK_DATA,
        "count": len(BENCHMARK_DATA),
    }
