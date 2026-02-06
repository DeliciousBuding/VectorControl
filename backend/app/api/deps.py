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
