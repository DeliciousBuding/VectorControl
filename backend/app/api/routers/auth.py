from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel
from starlette.responses import JSONResponse

from app.api.deps import get_config, get_holdings_user_id, get_user_id, get_username, is_admin
from app.core.rate_limit import LimitRule, auth_rate_limiter
from app.storage.db import (
    create_session,
    create_user,
    delete_session,
    list_holdings,
    seed_user_holdings_if_empty,
    verify_user_credentials,
)

router = APIRouter(prefix="/api/auth", tags=["认证"])


class AuthIn(BaseModel):
    username: str
    password: str


LOGIN_RULE = LimitRule(max_attempts=6, window_seconds=600, block_seconds=900)
REGISTER_RULE = LimitRule(max_attempts=8, window_seconds=600, block_seconds=900)


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


def _too_many_response(retry_after: int) -> JSONResponse:
    return JSONResponse(
        {"detail": f"请求过于频繁，请在 {retry_after} 秒后重试"},
        status_code=429,
        headers={"Retry-After": str(retry_after)},
    )


@router.post("/register")
async def register(payload: AuthIn, request: Request) -> dict:
    ip = _client_ip(request)
    register_key = f"register:{ip}"
    allowed, retry_after = auth_rate_limiter.check(register_key)
    if not allowed:
        return _too_many_response(retry_after)

    config = get_config(request)
    portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}

    try:
        user = create_user(payload.username, payload.password)
    except ValueError as exc:
        auth_rate_limiter.record_failure(register_key, REGISTER_RULE)
        return JSONResponse({"detail": str(exc)}, status_code=400)

    auth_rate_limiter.record_success(register_key)
    seed_user_holdings_if_empty(user["id"], portfolio)
    token = create_session(user["id"])
    return {"token": token, "user": user}


@router.post("/login")
async def login(payload: AuthIn, request: Request) -> dict:
    ip = _client_ip(request)
    username = payload.username.strip().lower()
    login_key = f"login:{ip}:{username}"
    allowed, retry_after = auth_rate_limiter.check(login_key)
    if not allowed:
        return _too_many_response(retry_after)

    config = get_config(request)
    portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}

    user = verify_user_credentials(payload.username, payload.password)
    if not user:
        allowed, retry_after = auth_rate_limiter.record_failure(login_key, LOGIN_RULE)
        if not allowed:
            return _too_many_response(retry_after)
        return JSONResponse({"detail": "用户名或密码错误"}, status_code=401)

    auth_rate_limiter.record_success(login_key)
    seed_user_holdings_if_empty(user["id"], portfolio)
    token = create_session(user["id"])
    return {"token": token, "user": user}


@router.get("/me")
async def me(request: Request) -> dict:
    if is_admin(request):
        return {
            "user": {"id": "admin", "username": "admin"},
            "holdings_count": len(list_holdings("legacy")),
            "mode": "admin",
        }

    user_id = get_user_id(request)
    username = get_username(request)
    holdings = list_holdings(user_id)
    return {
        "user": {"id": user_id, "username": username},
        "holdings_count": len(holdings),
        "mode": "user",
    }


@router.post("/logout")
async def logout(request: Request) -> dict:
    if is_admin(request):
        return {"ok": True}

    authorization = request.headers.get("Authorization", "")
    token = ""
    if authorization:
        parts = authorization.strip().split(" ", 1)
        token = parts[1].strip() if len(parts) == 2 else parts[0].strip()
    if not token:
        token = request.query_params.get("token", "")

    if token:
        delete_session(token)

    return {"ok": True}
