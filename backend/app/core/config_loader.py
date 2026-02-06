from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.core.settings import ROOT_DIR

CONFIG_DIR = ROOT_DIR / "config"


def _load_yaml(path: Path) -> Any:
    if not path.exists():
        return {}
    content = path.read_text(encoding="utf-8")
    data = yaml.safe_load(content)
    return data if data is not None else {}


def load_all() -> dict[str, Any]:
    funds_raw = _load_yaml(CONFIG_DIR / "funds.yaml")
    portfolio_raw = _load_yaml(CONFIG_DIR / "portfolio.yaml")
    policy_raw = _load_yaml(CONFIG_DIR / "policy.yaml")

    funds = funds_raw.get("funds", []) if isinstance(funds_raw, dict) else funds_raw or []
    if not isinstance(funds, list):
        funds = []

    if isinstance(portfolio_raw, dict):
        portfolio = portfolio_raw
    else:
        portfolio = {"holdings": []}

    if not isinstance(portfolio.get("holdings", []), list):
        portfolio["holdings"] = []

    policy = policy_raw if isinstance(policy_raw, dict) else {"raw": policy_raw}

    return {
        "funds": funds,
        "portfolio": portfolio,
        "policy": policy,
    }


def summarize_config(config: dict[str, Any]) -> dict[str, Any]:
    funds = config.get("funds", [])
    portfolio = config.get("portfolio", {})
    policy = config.get("policy", {})

    holdings = portfolio.get("holdings", []) if isinstance(portfolio, dict) else []
    buckets = sorted({item.get("bucket", "") for item in holdings if isinstance(item, dict) and item.get("bucket")})

    return {
        "funds": {
            "count": len(funds),
            "items": [
                {
                    "fund_id": item.get("fund_id"),
                    "name": item.get("name"),
                    "bucket": item.get("bucket"),
                }
                for item in funds
                if isinstance(item, dict)
            ],
        },
        "portfolio": {
            "holdings_count": len(holdings),
            "buckets": buckets,
        },
        "policy": policy,
    }
