from __future__ import annotations

from fastapi import FastAPI

from app.core.config_loader import load_all
from app.storage.db import init_db, sync_fund_catalog_from_config


def initialize_app_state(app: FastAPI) -> None:
    config = load_all()
    init_db()
    sync_fund_catalog_from_config(config)
    app.state.config = config
