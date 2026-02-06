from __future__ import annotations

from datetime import date, datetime
from typing import Any


def _today_str() -> str:
    return datetime.now().astimezone().date().isoformat()


def _holding_days(start_date: str) -> int | None:
    try:
        start = date.fromisoformat(start_date)
    except Exception:
        return None
    today = datetime.now().astimezone().date()
    return (today - start).days


def _find_caitong_consumer(holdings: list[dict[str, Any]]) -> dict[str, Any] | None:
    for item in holdings:
        name = str(item.get("name", ""))
        fund_id = str(item.get("fund_id", ""))
        if "品质消费" in name or fund_id == "caitong_consumer":
            return item
    return None


def build_advice(
    estimate: dict[str, Any],
    holdings: list[dict[str, Any]],
    policy: dict[str, Any],
) -> dict[str, Any]:
    tech_estimate = 0.0
    for bucket in estimate.get("buckets", []):
        if bucket.get("bucket") == "tech":
            tech_estimate = float(bucket.get("estimate_pct", 0.0))
            break

    try:
        threshold = float(policy.get("tech_threshold_pct", -1.5))
    except Exception:
        threshold = -1.5

    nanfang_enabled = tech_estimate <= threshold
    actions = [
        {
            "key": "morgan_a_buy",
            "title": "摩根纳指A +10",
            "amount": 10,
            "type": "fixed",
            "enabled": True,
            "reason": "",
        },
        {
            "key": "morgan_c_buy",
            "title": "摩根纳指C +10",
            "amount": 10,
            "type": "fixed",
            "enabled": True,
            "reason": "",
        },
        {
            "key": "nanfang_buy",
            "title": "南方纳指 +50",
            "amount": 50,
            "type": "conditional",
            "enabled": nanfang_enabled,
            "reason": "" if nanfang_enabled else "未触发阈值",
        },
    ]

    notes: list[str] = []
    target = _find_caitong_consumer(holdings)
    if target:
        days = _holding_days(str(target.get("start_date", "")))
        if days is None:
            notes.append("财通品质消费：无法解析持有天数")
        elif days < 30:
            notes.append(f"财通品质消费：未满足做T门槛（持有{days}天）")
        else:
            notes.append("财通品质消费：可考虑做T（目标降成本），但不自动生成交易动作")
    else:
        notes.append("财通品质消费：未找到持仓，无法判断做T门槛")

    return {
        "date": _today_str(),
        "actions": actions,
        "notes": notes,
    }
