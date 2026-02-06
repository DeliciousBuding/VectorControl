from __future__ import annotations

import logging
from fastapi import FastAPI, Request
from starlette.responses import JSONResponse

from app.core.config_loader import load_all, summarize_config
from app.core.settings import ensure_api_token
from app.estimator.engine import build_estimate
from app.policy.advice import build_advice
from app.storage.db import init_db, list_holdings, save_estimate_snapshot, seed_holdings

API_TOKEN = ensure_api_token()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
LOGGER = logging.getLogger("fund-watchtower")

app = FastAPI(title="fund-watchtower-backend", version="0.0.1")


def _extract_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    if authorization:
        parts = authorization.strip().split(" ", 1)
        return parts[1].strip() if len(parts) == 2 else parts[0]
    return request.query_params.get("token")


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and path != "/api/health":
        token_value = _extract_token(request)
        if not token_value:
            return JSONResponse({"detail": "Missing API token"}, status_code=401)
        if token_value != API_TOKEN:
            return JSONResponse({"detail": "Invalid API token"}, status_code=403)
    return await call_next(request)


@app.on_event("startup")
def on_startup() -> None:
    config = load_all()
    app.state.config = config
    init_db()
    inserted = seed_holdings(config.get("portfolio", {}))
    if inserted:
        LOGGER.info("Seeded %s holdings from portfolio.yaml", inserted)


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "service": "fund-watchtower-backend"}


@app.get("/api/config")
async def get_config() -> dict:
    config = getattr(app.state, "config", {})
    return summarize_config(config)


@app.get("/api/estimate")
async def get_estimate() -> dict:
    payload = build_estimate()
    save_estimate_snapshot(payload["asof"], payload)
    return payload


@app.get("/api/advice")
async def get_advice() -> dict:
    config = getattr(app.state, "config", {})
    estimate = build_estimate()
    holdings = list_holdings()
    policy = config.get("policy", {}) if isinstance(config, dict) else {}
    return build_advice(estimate, holdings, policy)
