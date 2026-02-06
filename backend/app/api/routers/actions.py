from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.deps import get_holdings_user_id, today_str
from app.storage.db import insert_action, list_actions

router = APIRouter(prefix="/api/actions", tags=["执行记录"])


class ActionIn(BaseModel):
    date: str | None = None
    action_key: str
    amount: float
    done: bool


@router.get("")
async def get_actions(request: Request, date: str | None = None) -> dict:
    date_str = date or today_str()
    user_id = get_holdings_user_id(request)
    actions = list_actions(user_id, date_str)
    return {"date": date_str, "actions": actions}


@router.post("")
async def post_actions(request: Request, payload: ActionIn) -> dict:
    date_str = payload.date or today_str()
    user_id = get_holdings_user_id(request)
    ts = insert_action(user_id, date_str, payload.action_key, payload.amount, payload.done)
    return {
        "date": date_str,
        "actions": [
            {
                "action_key": payload.action_key,
                "amount": payload.amount,
                "done": payload.done,
                "ts": ts,
            }
        ],
    }
