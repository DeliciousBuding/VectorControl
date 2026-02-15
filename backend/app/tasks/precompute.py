"""
预计算任务 - 定时计算estimate数据并缓存到数据库
用于非交易时间快速响应
"""
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any

from app.estimator.engine import build_estimate
from app.risk.engine import build_risk_overview
from app.storage.db import (
    get_latest_estimate_snapshot,
    get_latest_estimate_snapshot_on_or_before,
    get_confirmed_fund_profit_map,
    list_holdings,
    list_estimate_snapshots,
    save_estimate_snapshot,
    summarize_fund_transactions_map,
)
from app.utils.market_time import get_market_status, is_cn_market_open, is_us_market_open


def _yesterday_str() -> str:
    return (datetime.now().astimezone().date() - timedelta(days=1)).isoformat()


def precompute_estimate_snapshot(user_id: str = "legacy") -> dict[str, Any] | None:
    """
    预计算用户持仓估值快照
    在非交易时间预先计算好，加快API响应速度
    """
    # 检查是否已经有最新的快照（1小时内）
    latest = get_latest_estimate_snapshot(user_id)
    if latest:
        asof_str = str(latest.get("asof") or latest.get("as_of") or "")
        if asof_str:
            try:
                asof_dt = datetime.fromisoformat(asof_str.replace("Z", "+00:00"))
                age_seconds = (datetime.now(timezone.utc) - asof_dt).total_seconds()
                if age_seconds < 3600:  # 1小时内已计算过
                    print(f"[Precompute] Snapshot for {user_id} is fresh ({age_seconds:.0f}s), skipping")
                    return None
            except Exception:
                pass
    
    # 获取用户持仓
    holdings = list_holdings(user_id=user_id, include_archived=False)
    if not holdings:
        print(f"[Precompute] No holdings for {user_id}, skipping")
        return None
    
    portfolio = {"holdings": holdings}
    
    # 计算estimate
    print(f"[Precompute] Computing estimate for {user_id} with {len(holdings)} holdings...")
    started = perf_counter()
    
    yesterday = _yesterday_str()
    try:
        payload = build_estimate(
            portfolio=portfolio,
            previous_snapshot=get_latest_estimate_snapshot_on_or_before(user_id, yesterday),
            confirmed_yesterday_profit=get_confirmed_fund_profit_map(user_id, yesterday),
            transaction_summary_map=summarize_fund_transactions_map(user_id),
            incremental_snapshot=latest,
            enable_incremental_refresh=True,
            quote_cache_ttl_seconds=90,
        )
        
        # 添加risk overview
        snapshots = list_estimate_snapshots(user_id, limit=240)
        risk = build_risk_overview(funds=payload.get("funds", []), snapshots=snapshots)
        risk["asof"] = payload.get("asof") or payload.get("as_of")
        risk["holdings_count"] = len(payload.get("funds", []))
        payload["risk_overview"] = risk
        
        # 添加市场状态
        payload["market_status"] = get_market_status()
        payload["cache_ttl_seconds"] = 3600  # 1小时
        payload["precomputed"] = True
        payload["precompute_elapsed_ms"] = int((perf_counter() - started) * 1000)
        
        # 保存快照
        save_estimate_snapshot(user_id, payload["asof"], payload)
        
        elapsed = perf_counter() - started
        print(f"[Precompute] Completed for {user_id} in {elapsed:.2f}s")
        return payload
        
    except Exception as e:
        print(f"[Precompute] Failed for {user_id}: {e}")
        return None


def should_precompute() -> bool:
    """
    判断是否应该执行预计算
    非交易时间才需要预计算
    """
    cn_open = is_cn_market_open()
    us_open = is_us_market_open()
    
    # 如果任何市场开盘，不需要预计算（实时计算即可）
    if cn_open or us_open:
        return False
    
    return True


def run_precompute_task():
    """
    运行预计算任务
    可以被定时任务调用（如cron）
    """
    if not should_precompute():
        market_status = get_market_status()
        print(f"[Precompute] Markets are open ({market_status.get('holiday_name') or 'trading'}), skipping precompute")
        return
    
    print(f"[Precompute] Starting precompute task at {datetime.now().isoformat()}")
    
    # 获取所有有持仓的用户
    # 目前只支持默认用户
    users = ["legacy"]
    
    for user_id in users:
        try:
            result = precompute_estimate_snapshot(user_id)
            if result:
                print(f"[Precompute] Success for user {user_id}: {len(result.get('funds', []))} funds")
        except Exception as e:
            print(f"[Precompute] Error for user {user_id}: {e}")
    
    print(f"[Precompute] Task completed at {datetime.now().isoformat()}")


if __name__ == "__main__":
    # 可以直接运行此文件进行测试
    run_precompute_task()
