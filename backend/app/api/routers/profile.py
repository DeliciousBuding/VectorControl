from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.deps import get_holdings_user_id
from app.storage.db import get_user_profile, upsert_user_profile

router = APIRouter(prefix="/api/profile", tags=["资料"])


class ProfileIn(BaseModel):
    nickname: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


@router.get("")
async def get_profile(request: Request) -> dict:
    user_id = get_holdings_user_id(request)
    profile = get_user_profile(user_id)
    return {"user_id": user_id, "profile": profile}


@router.put("")
async def put_profile(request: Request, payload: ProfileIn) -> dict:
    user_id = get_holdings_user_id(request)
    profile = upsert_user_profile(user_id, payload.model_dump(exclude_none=True))
    return {"user_id": user_id, "profile": profile}
