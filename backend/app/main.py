from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from starlette.responses import JSONResponse

from app.api.routers import (
    actions,
    advice,
    auth,
    config,
    estimate,
    funds,
    holdings,
    profile,
    report,
    risk,
    settings,
    system,
    transactions,
)
from app.core.config_loader import load_all
from app.core.settings import ensure_api_token
from app.storage.db import get_user_by_session_token, init_db, sync_fund_catalog_from_config

API_TOKEN = ensure_api_token()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
LOGGER = logging.getLogger("vectorcontrol")

app = FastAPI(title="vectorcontrol-backend", version="0.1.0")

PUBLIC_PATHS = {
    "/api/health",
    "/api/healthz",
    "/api/auth/register",
    "/api/auth/login",
}


def _extract_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    if authorization:
        parts = authorization.strip().split(" ", 1)
        return parts[1].strip() if len(parts) == 2 else parts[0].strip()
    token = request.query_params.get("token")
    return token.strip() if token else None


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
            return JSONResponse({"detail": "访问令牌无效或已过期"}, status_code=401)

        request.state.user_id = user["id"]
        request.state.username = user["username"]
        request.state.is_admin = False

    return await call_next(request)


@app.on_event("startup")
def on_startup() -> None:
    app.state.config = load_all()
    init_db()
    sync_fund_catalog_from_config(app.state.config)


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "service": "vectorcontrol-backend"}


@app.get("/api/healthz")
async def healthz() -> dict:
    return {"status": "ok", "service": "vectorcontrol-backend"}


app.include_router(auth.router)
app.include_router(settings.router)
app.include_router(config.router)
app.include_router(estimate.router)
app.include_router(risk.router)
app.include_router(advice.router)
app.include_router(actions.router)
app.include_router(holdings.router)
app.include_router(report.router)
app.include_router(profile.router)
app.include_router(funds.router)
app.include_router(system.router)
app.include_router(transactions.router)
