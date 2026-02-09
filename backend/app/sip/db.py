"""定投计划数据库操作（兼容转发层）"""

from __future__ import annotations

from typing import Any

from app.storage.db import (
    create_sip_plan,
    delete_sip_plan,
    execute_sip_plan,
    get_sip_plan,
    list_sip_plans,
    list_upcoming_sip_plans,
    update_sip_plan,
)


def get_upcoming_sip_plans(user_id: str, days: int = 7) -> list[dict[str, Any]]:
    return list_upcoming_sip_plans(user_id=user_id, days=days)


def mark_sip_executed(user_id: str, plan_id: int) -> dict[str, Any] | None:
    return execute_sip_plan(user_id=user_id, plan_id=plan_id)


__all__ = [
    "create_sip_plan",
    "delete_sip_plan",
    "execute_sip_plan",
    "get_sip_plan",
    "get_upcoming_sip_plans",
    "list_sip_plans",
    "list_upcoming_sip_plans",
    "mark_sip_executed",
    "update_sip_plan",
]
