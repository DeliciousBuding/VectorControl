from __future__ import annotations

import logging
from datetime import datetime
from fastapi import FastAPI, Request
from pydantic import BaseModel
from starlette.responses import JSONResponse

from app.core.config_loader import load_all, summarize_config
from app.core.settings import ensure_api_token
from app.estimator.engine import build_estimate
from app.policy.advice import build_advice
from app.storage.db import (
    get_latest_estimate_snapshot,
    init_db,
    insert_action,
    list_actions,
    list_holdings,
    save_estimate_snapshot,
    seed_holdings,
)

API_TOKEN = ensure_api_token()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
LOGGER = logging.getLogger("fund-watchtower")

app = FastAPI(title="fund-watchtower-backend", version="0.0.1")


def _today_str() -> str:
    return datetime.now().astimezone().date().isoformat()


class ActionIn(BaseModel):
    date: str | None = None
    action_key: str
    amount: float
    done: bool


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
    config = getattr(app.state, "config", {})
    portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    payload = build_estimate(portfolio=portfolio)
    save_estimate_snapshot(payload["asof"], payload)
    return payload


@app.get("/api/advice")
async def get_advice() -> dict:
    config = getattr(app.state, "config", {})
    portfolio = config.get("portfolio", {}) if isinstance(config, dict) else {}
    estimate = build_estimate(portfolio=portfolio)
    holdings = list_holdings()
    policy = config.get("policy", {}) if isinstance(config, dict) else {}
    return build_advice(estimate, holdings, policy)


@app.get("/api/actions")
async def get_actions(date: str | None = None) -> dict:
    date_str = date or _today_str()
    actions = list_actions(date_str)
    return {"date": date_str, "actions": actions}


@app.post("/api/actions")
async def post_actions(payload: ActionIn) -> dict:
    date_str = payload.date or _today_str()
    ts = insert_action(date_str, payload.action_key, payload.amount, payload.done)
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
async def get_daily_report(date: str | None = None) -> dict:
    date_str = date or _today_str()
    config = getattr(app.state, "config", {})
    policy = config.get("policy", {}) if isinstance(config, dict) else {}

    estimate = get_latest_estimate_snapshot() or build_estimate()
    actions = list_actions(date_str)

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
        f"固定动作：摩根纳指A +10、摩根纳指C +10；"
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
