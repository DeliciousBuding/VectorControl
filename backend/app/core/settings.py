from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - dotenv optional at import time
    load_dotenv = None

LOGGER = logging.getLogger("fund-watchtower")

ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_PATH = ROOT_DIR / ".env"
DATA_DIR = ROOT_DIR / "backend" / "data"
RUNTIME_TOKEN_PATH = DATA_DIR / "runtime_token.txt"


def _load_env() -> None:
    if load_dotenv is None:
        return
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH)


def ensure_api_token() -> str:
    _load_env()
    token = os.getenv("API_TOKEN", "").strip()
    if not token or token.lower() == "change-me":
        token = secrets.token_urlsafe(24)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        RUNTIME_TOKEN_PATH.write_text(token, encoding="utf-8")
        LOGGER.warning("API_TOKEN not set; generated runtime token: %s", token)
        os.environ["API_TOKEN"] = token
    return token


def get_env(name: str, default: str | None = None) -> str | None:
    _load_env()
    value = os.getenv(name)
    return value if value is not None else default
