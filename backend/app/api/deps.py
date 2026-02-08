from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import Request


def today_str() -> str:
    return datetime.now().astimezone().date().isoformat()


def get_config(request: Request) -> dict[str, Any]:
    config = getattr(request.app.state, "config", {})
    return config if isinstance(config, dict) else {}


def get_user_id(request: Request) -> str:
    return str(getattr(request.state, "user_id", ""))


def get_username(request: Request) -> str:
    return str(getattr(request.state, "username", ""))


def is_admin(request: Request) -> bool:
    return bool(getattr(request.state, "is_admin", False))


def get_holdings_user_id(request: Request) -> str:
    return "legacy" if is_admin(request) else get_user_id(request)


def get_snapshot_user_id(request: Request) -> str:
    return "admin" if is_admin(request) else get_user_id(request)


def map_confirm_state_to_data_status(confirm_state: str | None, failed_count: int = 0) -> str:
    text = str(confirm_state or "").strip().lower()
    if text == "confirmed":
        return "confirmed"
    if text == "partial" or int(failed_count or 0) > 0:
        return "partial"
    return "estimating"


def build_data_status(status: str, asof: str | None = None, note: str | None = None) -> dict[str, str]:
    clean_status = str(status or "").strip().lower()
    if clean_status not in {"confirmed", "estimating", "partial"}:
        clean_status = "estimating"
    return {
        "status": clean_status,
        "asof": str(asof or "").strip(),
        "note": str(note or "").strip(),
    }
