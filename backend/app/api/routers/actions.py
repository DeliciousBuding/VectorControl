from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.api.deps import build_data_status, get_holdings_user_id, today_str
from app.storage.db import insert_action, list_actions

router = APIRouter(prefix="/api/actions", tags=["执行记录"])


class ActionIn(BaseModel):
    date: str | None = None
    occurred_at: str | None = None
    action_key: str
    amount: float
    done: bool


def _normalize_occurred_at(raw: str | None) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    normalized = text.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        local_tz = datetime.now().astimezone().tzinfo
        dt = dt.replace(tzinfo=local_tz)
    return dt.astimezone().isoformat(timespec="seconds")


@router.get("")
async def get_actions(request: Request, date: str | None = None) -> dict:
    date_str = date or today_str()
    user_id = get_holdings_user_id(request)
    actions = list_actions(user_id, date_str)
    return {
        "date": date_str,
        "actions": actions,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="执行记录来自本地数据库真源",
        ),
    }


@router.post("")
async def post_actions(request: Request, payload: ActionIn) -> dict:
    occurred_at: str | None
    try:
        occurred_at = _normalize_occurred_at(payload.occurred_at)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"发生时间格式不正确: {exc}") from exc

    date_str = (occurred_at or "").split("T", 1)[0] if occurred_at else (payload.date or today_str())
    user_id = get_holdings_user_id(request)
    ts = insert_action(
        user_id,
        date_str,
        payload.action_key,
        payload.amount,
        payload.done,
        occurred_at=occurred_at,
    )
    return {
        "date": date_str,
        "actions": [
            {
                "action_key": payload.action_key,
                "amount": payload.amount,
                "done": payload.done,
                "ts": ts,
                "occurred_at": occurred_at or ts,
            }
        ],
        "data_status": build_data_status(
            status="confirmed",
            asof=occurred_at or ts,
            note="执行记录已写入数据库",
        ),
    }
