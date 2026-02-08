from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, get_snapshot_user_id, is_admin, today_str
from app.estimator.engine import build_estimate
from app.storage.db import (
    get_latest_estimate_snapshot,
    get_transactions_sync_pending_snapshot,
    list_actions,
    list_holdings,
)

router = APIRouter(prefix="/api/report", tags=["日报"])


@router.get("/daily")
async def get_daily_report(request: Request, date: str | None = None) -> dict:
    date_str = date or today_str()
    config = get_config(request)
    policy = config.get("policy", {}) if isinstance(config, dict) else {}
    holdings_user_id = get_holdings_user_id(request)

    snapshot_user_id = get_snapshot_user_id(request)
    estimate = get_latest_estimate_snapshot(snapshot_user_id)

    if not estimate:
        if is_admin(request):
            portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
        else:
            portfolio = {"holdings": list_holdings(holdings_user_id)}
        estimate = build_estimate(portfolio=portfolio)

    actions = list_actions(holdings_user_id, date_str)
    sync_pending = get_transactions_sync_pending_snapshot(holdings_user_id)

    estimate_lines: list[str] = []
    for bucket in estimate.get("buckets", []):
        pct = float(bucket.get("estimate_pct", 0.0))
        confidence = bucket.get("confidence", "low")
        estimate_lines.append(f"{bucket.get('bucket')}: {pct:.2f}% ({confidence})")
    if not estimate_lines:
        estimate_lines.append("暂无估值快照")

    action_lines: list[str] = []
    if not actions:
        action_lines.append("今日无执行记录")
    else:
        for item in actions:
            status = "已执行" if item.get("done") else "未执行"
            occurred_at = item.get("occurred_at") or item.get("ts") or ""
            action_lines.append(
                f"{item.get('action_key')} {item.get('amount')} {status} {occurred_at}"
            )

    pending_count = int(sync_pending.get("pending_count_current") or 0)
    confirmed_count = int(sync_pending.get("confirmed_count_current") or 0)
    synced_total = int(sync_pending.get("synced_total") or 0)
    synced_fund_count = int(sync_pending.get("synced_fund_count") or 0)
    latest_confirmed_at = str(sync_pending.get("latest_confirmed_at") or "").strip()
    last_run_at = str(sync_pending.get("last_run_at") or "").strip()

    sync_lines = [
        f"当前 pending {pending_count} 笔，confirmed {confirmed_count} 笔",
    ]
    if synced_total > 0:
        sync_line = f"sync_pending 累计入账 {synced_total} 笔，覆盖 {synced_fund_count} 只基金"
        if latest_confirmed_at:
            sync_line += f"，最近确认时间 {latest_confirmed_at}"
        sync_lines.append(sync_line)
    else:
        sync_lines.append("尚无 sync_pending 入账记录")
    if last_run_at:
        sync_lines.append(f"最近对账时间 {last_run_at}")

    try:
        threshold = float(policy.get("tech_threshold_pct", -1.5))
    except Exception:
        threshold = -1.5

    plan_line = (
        "固定动作：摩根纳指A +10、摩根纳指C +10；"
        f"条件：tech <= {threshold}% 触发南方纳指 +50"
    )

    summary_lines = [
        f"日报 {date_str}",
        "估值：" + ("; ".join(estimate_lines) if estimate_lines else "暂无"),
        "执行：" + ("; ".join(action_lines) if action_lines else "无"),
        "对账：" + ("; ".join(sync_lines) if sync_lines else "无"),
        "计划：" + plan_line,
    ]

    return {
        "date": date_str,
        "summary": "\n".join(summary_lines),
        "sections": [
            {"title": "估值概览", "lines": estimate_lines},
            {"title": "执行情况", "lines": action_lines},
            {"title": "对账入账", "lines": sync_lines},
            {"title": "明日计划", "lines": [plan_line]},
        ],
    }
