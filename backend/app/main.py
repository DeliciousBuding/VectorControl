from __future__ import annotations

from contextlib import asynccontextmanager
import contextvars
import logging
import time
import uuid

from fastapi import FastAPI, Request
from starlette.responses import JSONResponse

from app.api.routers import (
    actions,
    advice,
    auth,
    benchmark,
    charts,
    config,
    estimate,
    funds,
    holdings,
    profile,
    report,
    risk,
    settings,
    sip,
    system,
    transactions,
)
from app.bootstrap import initialize_app_state
from app.core.settings import ensure_api_token
from app.storage.db import get_user_by_session_token

SERVICE_NAME = "vectorcontrol-backend"
API_TOKEN = ensure_api_token()
REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 128
DEFAULT_REQUEST_ID = "-"
REQUEST_DURATION_HEADER = "X-Server-Elapsed-Ms"

PUBLIC_PATHS = {
    "/api/health",
    "/api/healthz",
    "/api/auth/register",
    "/api/auth/login",
}

APP_ROUTERS = (
    auth.router,
    settings.router,
    settings.compat_router,
    config.router,
    estimate.router,
    risk.router,
    advice.router,
    actions.router,
    holdings.router,
    report.router,
    profile.router,
    funds.router,
    charts.router,
    benchmark.router,
    system.router,
    transactions.router,
    sip.router,
)

_REQUEST_ID_CONTEXT: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id",
    default=DEFAULT_REQUEST_ID,
)
_DEFAULT_LOG_RECORD_FACTORY = logging.getLogRecordFactory()


def _request_id_record_factory(*args, **kwargs):
    record = _DEFAULT_LOG_RECORD_FACTORY(*args, **kwargs)
    record.request_id = _REQUEST_ID_CONTEXT.get(DEFAULT_REQUEST_ID)
    return record


def _configure_logging() -> logging.Logger:
    logging.setLogRecordFactory(_request_id_record_factory)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s [request_id=%(request_id)s]: %(message)s",
    )
    return logging.getLogger("vectorcontrol")


LOGGER = _configure_logging()


def _extract_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    if authorization:
        parts = authorization.strip().split(" ", 1)
        return parts[1].strip() if len(parts) == 2 else parts[0].strip()
    token = request.query_params.get("token")
    return token.strip() if token else None


def _resolve_request_id(request: Request) -> str:
    request_id = request.headers.get(REQUEST_ID_HEADER, "").strip()
    if request_id:
        return request_id[:MAX_REQUEST_ID_LENGTH]
    return uuid.uuid4().hex


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


async def request_id_middleware(request: Request, call_next):
    request_id = _resolve_request_id(request)
    request.state.request_id = request_id
    started_at = time.perf_counter()
    request.state.request_started_at = started_at
    context_token = _REQUEST_ID_CONTEXT.set(request_id)
    response = None
    try:
        response = await call_next(request)
    finally:
        elapsed_ms = max(0, int((time.perf_counter() - started_at) * 1000))
        request.state.server_elapsed_ms = elapsed_ms
        status_code = getattr(response, "status_code", 500)
        LOGGER.info(
            "request_completed method=%s path=%s status_code=%s request_id=%s server_elapsed_ms=%s",
            request.method.upper(),
            request.url.path,
            status_code,
            request_id,
            elapsed_ms,
        )
        _REQUEST_ID_CONTEXT.reset(context_token)
    response.headers[REQUEST_ID_HEADER] = request_id
    response.headers[REQUEST_DURATION_HEADER] = str(elapsed_ms)
    return response


async def health() -> dict[str, str | bool]:
    return {"ok": True, "service": SERVICE_NAME}


async def healthz() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}


def _register_middleware(app: FastAPI) -> None:
    app.middleware("http")(auth_middleware)
    app.middleware("http")(request_id_middleware)


def _build_lifespan():
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        initialize_app_state(app)
        yield

    return lifespan



def _register_routes(app: FastAPI) -> None:
    app.add_api_route("/api/health", health, methods=["GET"])
    app.add_api_route("/api/healthz", healthz, methods=["GET"])
    for router in APP_ROUTERS:
        app.include_router(router)



def create_app() -> FastAPI:
    app = FastAPI(title=SERVICE_NAME, version="0.1.0", lifespan=_build_lifespan())
    _register_middleware(app)
    _register_routes(app)
    return app


app = create_app()
