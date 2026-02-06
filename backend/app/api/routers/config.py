from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_config, get_holdings_user_id, get_user_id, get_username, is_admin
from app.core.config_loader import summarize_config
from app.storage.db import list_holdings

router = APIRouter(prefix="/api", tags=["配置"])


@router.get("/config")
async def get_config_summary(request: Request) -> dict:
    config = get_config(request)
    summary = summarize_config(config)

    user_id = get_user_id(request)
    if not user_id:
        return summary

    holdings = list_holdings(get_holdings_user_id(request))
    buckets = sorted({str(item.get("bucket", "")) for item in holdings if item.get("bucket")})

    summary["session"] = {
        "user_id": user_id,
        "username": "admin" if is_admin(request) else get_username(request),
        "mode": "admin" if is_admin(request) else "user",
    }
    summary["portfolio"]["holdings_count"] = len(holdings)
    summary["portfolio"]["buckets"] = buckets
    return summary
