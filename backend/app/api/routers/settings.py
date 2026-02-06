from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.deps import get_holdings_user_id
from app.storage.db import get_user_settings, upsert_user_settings

router = APIRouter(prefix="/api/settings", tags=["设置"])


class SettingsIn(BaseModel):
    settings: dict[str, Any]


@router.get("")
async def get_settings(request: Request) -> dict:
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    return {"settings": settings, "user_id": user_id}


@router.put("")
async def put_settings(request: Request, payload: SettingsIn) -> dict:
    user_id = get_holdings_user_id(request)
    settings = upsert_user_settings(user_id, payload.settings)
    return {"settings": settings, "user_id": user_id}
