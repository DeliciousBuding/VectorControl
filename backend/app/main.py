from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import FastAPI, Request
from pydantic import BaseModel
from starlette.responses import JSONResponse

from app.core.config_loader import load_all, summarize_config
from app.core.settings import ensure_api_token
from app.estimator.engine import build_estimate
from app.policy.advice import build_advice
from app.storage.db import (
    create_session,
    create_user,
    delete_session,
    get_latest_estimate_snapshot,
    get_user_by_session_token,
    get_user_settings,
    init_db,
    insert_action,
    list_actions,
    list_holdings,
    save_estimate_snapshot,
    seed_user_holdings_if_empty,
    upsert_user_settings,
    verify_user_credentials,
)

API_TOKEN = ensure_api_token()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
LOGGER = logging.getLogger("vectorcontrol")

app = FastAPI(title="vectorcontrol-backend", version="0.1.0")

PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/register",
    "/api/auth/login",
}


class ActionIn(BaseModel):
    date: str | None = None
    action_key: str
    amount: float
    done: bool


class AuthIn(BaseModel):
    username: str
    password: str


class SettingsIn(BaseModel):
    settings: dict[str, Any]


def _today_str() -> str:
    return datetime.now().astimezone().date().isoformat()


def _extract_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    if authorization:
        parts = authorization.strip().split(" ", 1)
        return parts[1].strip() if len(parts) == 2 else parts[0]
    return request.query_params.get("token")


def _get_user_id(request: Request) -> str:
    return str(getattr(request.state, "user_id", ""))


def _is_admin(request: Request) -> bool:
    return bool(getattr(request.state, "is_admin", False))


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and path not in PUBLIC_PATHS:
        token_value = _extract_token(request)
        if not token_value:
            return JSONResponse({"detail": "缺少访问令牌，请先登录"}, status_code=401)

        if token_value == API_TOKEN:
            request.state.user_id = "admin"
            request.state.username = "admin"
            request.state.is_admin = True
            return await call_next(request)

        user = get_user_by_session_token(token_value)
        if not user:
            return JSONResponse({"detail": "访问令牌无效或已过期"}, status_code=403)

        request.state.user_id = user["id"]
        request.state.username = user["username"]
        request.state.is_admin = False

    return await call_next(request)


@app.on_event("startup")
def on_startup() -> None:
    config = load_all()
    app.state.config = config
    init_db()


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "service": "vectorcontrol-backend"}


@app.post("/api/auth/register")
async def register(payload: AuthIn) -> dict:
    config = getattr(app.state, "config", {})
    portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}

    try:
        user = create_user(payload.username, payload.password)
    except ValueError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=400)

    seed_user_holdings_if_empty(user["id"], portfolio)
    token = create_session(user["id"])
    return {"token": token, "user": user}


@app.post("/api/auth/login")
async def login(payload: AuthIn) -> dict:
    config = getattr(app.state, "config", {})
    portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}

    user = verify_user_credentials(payload.username, payload.password)
    if not user:
        return JSONResponse({"detail": "用户名或密码错误"}, status_code=401)

    seed_user_holdings_if_empty(user["id"], portfolio)
    token = create_session(user["id"])
    return {"token": token, "user": user}


@app.get("/api/auth/me")
async def me(request: Request) -> dict:
    user_id = _get_user_id(request)
    username = getattr(request.state, "username", "")

    if _is_admin(request):
        return {
            "user": {"id": "admin", "username": "admin"},
            "holdings_count": len(list_holdings("legacy")),
            "mode": "admin",
        }

    holdings = list_holdings(user_id)
    return {
        "user": {"id": user_id, "username": username},
        "holdings_count": len(holdings),
        "mode": "user",
    }


@app.get("/api/settings")
async def get_settings(request: Request) -> dict:
    user_id = "legacy" if _is_admin(request) else _get_user_id(request)
    settings = get_user_settings(user_id)
    return {"settings": settings, "user_id": user_id}


@app.put("/api/settings")
async def put_settings(request: Request, payload: SettingsIn) -> dict:
    user_id = "legacy" if _is_admin(request) else _get_user_id(request)
    settings = upsert_user_settings(user_id, payload.settings)
    return {"settings": settings, "user_id": user_id}


@app.post("/api/auth/logout")
async def logout(request: Request) -> dict:
    if _is_admin(request):
        return {"ok": True}

    token_value = _extract_token(request)
    if token_value:
        delete_session(token_value)
    return {"ok": True}


@app.get("/api/config")
async def get_config(request: Request) -> dict:
    config = getattr(app.state, "config", {})
    summary = summarize_config(config)

    user_id = _get_user_id(request)
    if not user_id:
        return summary

    if _is_admin(request):
        holdings = list_holdings("legacy")
        username = "admin"
    else:
        holdings = list_holdings(user_id)
        username = str(getattr(request.state, "username", ""))

    buckets = sorted({str(item.get("bucket", "")) for item in holdings if item.get("bucket")})

    summary["session"] = {
        "user_id": user_id,
        "username": username,
        "mode": "admin" if _is_admin(request) else "user",
    }
    summary["portfolio"]["holdings_count"] = len(holdings)
    summary["portfolio"]["buckets"] = buckets
    return summary


@app.get("/api/estimate")
async def get_estimate(request: Request) -> dict:
    user_id = _get_user_id(request)
    config = getattr(app.state, "config", {})

    if _is_admin(request):
        portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
        snapshot_user_id = "admin"
    else:
        holdings = list_holdings(user_id)
        portfolio = {"holdings": holdings}
        snapshot_user_id = user_id

    payload = build_estimate(portfolio=portfolio)
    save_estimate_snapshot(snapshot_user_id, payload["asof"], payload)
    return payload


@app.get("/api/advice")
async def get_advice(request: Request) -> dict:
    user_id = _get_user_id(request)
    config = getattr(app.state, "config", {})
    policy = config.get("policy", {}) if isinstance(config, dict) else {}

    if _is_admin(request):
        portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
        holdings = list_holdings("legacy")
    else:
        holdings = list_holdings(user_id)
        portfolio = {"holdings": holdings}

    estimate = build_estimate(portfolio=portfolio)
    return build_advice(estimate, holdings, policy)


@app.get("/api/actions")
async def get_actions(request: Request, date: str | None = None) -> dict:
    date_str = date or _today_str()
    user_id = "legacy" if _is_admin(request) else _get_user_id(request)
    actions = list_actions(user_id, date_str)
    return {"date": date_str, "actions": actions}


@app.post("/api/actions")
async def post_actions(request: Request, payload: ActionIn) -> dict:
    date_str = payload.date or _today_str()
    user_id = "legacy" if _is_admin(request) else _get_user_id(request)
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


@app.get("/api/report/daily")
async def get_daily_report(request: Request, date: str | None = None) -> dict:
    date_str = date or _today_str()
    config = getattr(app.state, "config", {})
    policy = config.get("policy", {}) if isinstance(config, dict) else {}

    snapshot_user_id = "admin" if _is_admin(request) else _get_user_id(request)
    estimate = get_latest_estimate_snapshot(snapshot_user_id)

    if not estimate:
        if _is_admin(request):
            portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
        else:
            portfolio = {"holdings": list_holdings(snapshot_user_id)}
        estimate = build_estimate(portfolio=portfolio)

    actions_user_id = "legacy" if _is_admin(request) else _get_user_id(request)
    actions = list_actions(actions_user_id, date_str)

    estimate_lines: list[str] = []
    for bucket in estimate.get("buckets", []):
        pct = float(bucket.get("estimate_pct", 0.0))
        confidence = bucket.get("confidence", "low")
        estimate_lines.append(f"{bucket.get('bucket')}: {pct:.2f}% ({confidence})")
    if not estimate_lines:
        estimate_lines.append("暂无估值快照")

    action_lines: list[str] = []
    if not actions:
        action_lines.append("今日无执行记录")
    else:
        for item in actions:
            status = "已执行" if item.get("done") else "未执行"
            action_lines.append(
                f"{item.get('action_key')} {item.get('amount')} {status} {item.get('ts')}"
            )

    try:
        threshold = float(policy.get("tech_threshold_pct", -1.5))
    except Exception:
        threshold = -1.5

    plan_line = (
        "固定动作：摩根纳指A +10、摩根纳指C +10；"
        f"条件：tech <= {threshold}% 触发南方纳指 +50"
    )

    summary_lines = [
        f"日报 {date_str}",
        "估值：" + ("; ".join(estimate_lines) if estimate_lines else "暂无"),
        "执行：" + ("; ".join(action_lines) if action_lines else "无"),
        "计划：" + plan_line,
    ]

    return {
        "date": date_str,
        "summary": "\n".join(summary_lines),
        "sections": [
            {"title": "估值概览", "lines": estimate_lines},
            {"title": "执行情况", "lines": action_lines},
            {"title": "明日计划", "lines": [plan_line]},
        ],
    }
