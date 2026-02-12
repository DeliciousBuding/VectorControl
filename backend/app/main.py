from __future__ import annotations

import contextvars
import logging
import time
import uuid
from collections import defaultdict
from threading import Lock

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
from app.core.config_loader import load_all
from app.core.settings import ensure_api_token
from app.storage.db import get_user_by_session_token, init_db, sync_fund_catalog_from_config

API_TOKEN = ensure_api_token()
REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 128
DEFAULT_REQUEST_ID = "-"

_REQUEST_ID_CONTEXT: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id",
    default=DEFAULT_REQUEST_ID,
)
_DEFAULT_LOG_RECORD_FACTORY = logging.getLogRecordFactory()


class RequestStats:
    """请求统计器"""
    
    def __init__(self):
        self._lock = Lock()
        self._total_requests = 0
        self._total_errors = 0
        self._path_stats: dict[str, dict] = defaultdict(lambda: {"count": 0, "total_ms": 0.0, "errors": 0})
        self._start_time = time.time()
    
    def record(self, path: str, elapsed_ms: float, is_error: bool) -> None:
        with self._lock:
            self._total_requests += 1
            if is_error:
                self._total_errors += 1
            
            path_key = path.split("?")[0][:100]
            self._path_stats[path_key]["count"] += 1
            self._path_stats[path_key]["total_ms"] += elapsed_ms
            if is_error:
                self._path_stats[path_key]["errors"] += 1
    
    def get_stats(self) -> dict:
        with self._lock:
            uptime_seconds = time.time() - self._start_time
            
            top_paths = sorted(
                [
                    {
                        "path": path,
                        "count": stats["count"],
                        "avg_ms": stats["total_ms"] / stats["count"] if stats["count"] > 0 else 0,
                        "errors": stats["errors"],
                    }
                    for path, stats in self._path_stats.items()
                ],
                key=lambda x: x["count"],
                reverse=True,
            )[:20]
            
            return {
                "uptime_seconds": int(uptime_seconds),
                "total_requests": self._total_requests,
                "total_errors": self._total_errors,
                "error_rate": self._total_errors / self._total_requests if self._total_requests > 0 else 0,
                "requests_per_second": self._total_requests / uptime_seconds if uptime_seconds > 0 else 0,
                "top_paths": top_paths,
            }
    
    def reset(self) -> None:
        with self._lock:
            self._total_requests = 0
            self._total_errors = 0
            self._path_stats.clear()
            self._start_time = time.time()


_request_stats = RequestStats()


def _request_id_record_factory(*args, **kwargs):
    record = _DEFAULT_LOG_RECORD_FACTORY(*args, **kwargs)
    record.request_id = _REQUEST_ID_CONTEXT.get(DEFAULT_REQUEST_ID)
    return record


logging.setLogRecordFactory(_request_id_record_factory)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s [request_id=%(request_id)s]: %(message)s",
)
LOGGER = logging.getLogger("vectorcontrol")

app = FastAPI(title="vectorcontrol-backend", version="0.1.0")

PUBLIC_PATHS = {
    "/api/health",
    "/api/healthz",
    "/api/auth/register",
    "/api/auth/login",
    "/api/settings/notifications/telegram/webhook",
}


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


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = _resolve_request_id(request)
    request.state.request_id = request_id
    context_token = _REQUEST_ID_CONTEXT.set(request_id)
    start_time = time.time()
    is_error = False
    try:
        response = await call_next(request)
        if response.status_code >= 400:
            is_error = True
    except Exception:
        is_error = True
        raise
    finally:
        elapsed_ms = (time.time() - start_time) * 1000
        _request_stats.record(request.url.path, elapsed_ms, is_error)
        _REQUEST_ID_CONTEXT.reset(context_token)
    response.headers[REQUEST_ID_HEADER] = request_id
    return response


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
app.include_router(settings.compat_router)
app.include_router(config.router)
app.include_router(estimate.router)
app.include_router(risk.router)
app.include_router(advice.router)
app.include_router(actions.router)
app.include_router(holdings.router)
app.include_router(report.router)
app.include_router(profile.router)
app.include_router(funds.router)
app.include_router(charts.router)
app.include_router(benchmark.router)
app.include_router(system.router)
app.include_router(transactions.router)
app.include_router(charts.router)
app.include_router(benchmark.router)
app.include_router(sip.router)
