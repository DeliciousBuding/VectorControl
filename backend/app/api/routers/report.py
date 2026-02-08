from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, get_snapshot_user_id, is_admin, today_str
from app.estimator.engine import build_estimate
from app.storage.db import get_latest_estimate_snapshot, list_actions, list_holdings

router = APIRouter(prefix="/api/report", tags=["日报"])


@router.get("/daily")
async def get_daily_report(request: Request, date: str | None = None) -> dict:
    date_str = date or today_str()
    config = get_config(request)
    policy = config.get("policy", {}) if isinstance(config, dict) else {}

    snapshot_user_id = get_snapshot_user_id(request)
    estimate = get_latest_estimate_snapshot(snapshot_user_id)

    if not estimate:
        if is_admin(request):
            portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
        else:
            portfolio = {"holdings": list_holdings(get_holdings_user_id(request))}
        estimate = build_estimate(portfolio=portfolio)

    actions = list_actions(get_holdings_user_id(request), date_str)

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
        "计划：" + plan_line,
    ]

    return {
        "date": date_str,
        "summary": "\n".join(summary_lines),
        "sections": [
            {"title": "估值概览", "lines": estimate_lines},
            {"title": "执行情况", "lines": action_lines},
            {"title": "明日计划", "lines": [plan_line]},
        ],
    }
