"""定投计划 API"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from app.api.deps import build_data_status, get_holdings_user_id
from app.storage.db import (
    create_sip_plan,
    delete_sip_plan,
    execute_sip_plan,
    get_sip_plan,
    list_sip_plans,
    list_upcoming_sip_plans,
    update_sip_plan,
)

router = APIRouter(prefix="/api/sip", tags=["定投计划"])


class SIPPlanCreate(BaseModel):
    fund_id: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$", description="基金代码")
    fund_name: str = Field(default="", description="基金名称")
    amount: float = Field(gt=0, description="定投金额")
    frequency: str = Field(default="monthly", description="频率: weekly/biweekly/monthly")
    day: int = Field(ge=1, le=31, description="执行日：月投1-31，周投1-7")
    note: str = Field(default="", description="备注")


class SIPPlanUpdate(BaseModel):
    fund_name: str | None = None
    amount: float | None = Field(default=None, gt=0)
    frequency: str | None = None
    day: int | None = Field(default=None, ge=1, le=31)
    enabled: bool | None = None
    note: str | None = None


@router.get("")
async def get_sip_plans(
    request: Request,
    enabled_only: bool = Query(default=False, description="只返回启用的计划"),
) -> dict[str, Any]:
    """获取用户的所有定投计划"""
    user_id = get_holdings_user_id(request)
    plans = list_sip_plans(user_id, enabled_only=enabled_only)

    return {
        "plans": plans,
        "count": len(plans),
        "enabled_only": enabled_only,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note=f"共 {len(plans)} 个定投计划",
        ),
    }


@router.post("")
async def create_plan(request: Request, payload: SIPPlanCreate) -> dict[str, Any]:
    """创建定投计划"""
    user_id = get_holdings_user_id(request)
    try:
        plan = create_sip_plan(
            user_id=user_id,
            fund_id=payload.fund_id,
            amount=payload.amount,
            frequency=payload.frequency,
            day=payload.day,
            fund_name=payload.fund_name,
            note=payload.note,
        )
    except ValueError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=422)

    return {
        "plan": plan,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="定投计划已创建",
        ),
    }


@router.get("/upcoming")
async def get_upcoming(
    request: Request,
    days: int = Query(default=7, ge=1, le=30, description="查看未来多少天"),
) -> dict[str, Any]:
    """获取即将执行的定投计划"""
    user_id = get_holdings_user_id(request)
    plans = list_upcoming_sip_plans(user_id, days=days)

    return {
        "plans": plans,
        "count": len(plans),
        "days": days,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note=f"未来 {days} 天内有 {len(plans)} 个定投计划",
        ),
    }


@router.get("/{plan_id}")
async def get_plan(request: Request, plan_id: int) -> dict[str, Any]:
    """获取单个定投计划"""
    user_id = get_holdings_user_id(request)
    plan = get_sip_plan(user_id, plan_id)

    if not plan:
        return JSONResponse(
            {"detail": "定投计划不存在"},
            status_code=404,
        )

    return {
        "plan": plan,
        "data_status": build_data_status(
            status="confirmed",
            asof=str(plan.get("updated_at") or plan.get("created_at") or ""),
            note="定投计划详情",
        ),
    }


@router.patch("/{plan_id}")
async def update_plan(
    request: Request,
    plan_id: int,
    payload: SIPPlanUpdate,
) -> dict[str, Any]:
    """更新定投计划"""
    user_id = get_holdings_user_id(request)

    updates = payload.model_dump(exclude_none=True)

    if not updates:
        return JSONResponse(
            {"detail": "没有需要更新的字段"},
            status_code=400,
        )

    try:
        plan = update_sip_plan(user_id, plan_id, updates)
    except ValueError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=422)

    if not plan:
        return JSONResponse(
            {"detail": "定投计划不存在"},
            status_code=404,
        )

    return {
        "plan": plan,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="定投计划已更新",
        ),
    }


@router.delete("/{plan_id}")
async def delete_plan(request: Request, plan_id: int) -> dict[str, Any]:
    """删除定投计划"""
    user_id = get_holdings_user_id(request)

    deleted = delete_sip_plan(user_id, plan_id)

    if not deleted:
        return JSONResponse(
            {"detail": "定投计划不存在"},
            status_code=404,
        )

    return {
        "deleted": True,
        "plan_id": plan_id,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="定投计划已删除",
        ),
    }


@router.post("/{plan_id}/execute")
async def execute_plan(request: Request, plan_id: int) -> dict[str, Any]:
    """标记定投计划已执行"""
    user_id = get_holdings_user_id(request)
    plan = execute_sip_plan(user_id, plan_id)

    if not plan:
        return JSONResponse(
            {"detail": "定投计划不存在"},
            status_code=404,
        )

    return {
        "plan": plan,
        "data_status": build_data_status(
            status="confirmed",
            asof=str(plan.get("updated_at") or datetime.now().astimezone().isoformat()),
            note=f"已执行，下次定投: {str(plan.get('next_date') or '-')}",
        ),
    }
