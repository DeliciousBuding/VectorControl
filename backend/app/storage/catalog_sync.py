from __future__ import annotations

from typing import Any


def _catalog_row_from_config_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "fund_id": item.get("fund_id"),
        "name": item.get("name"),
        "pinyin": item.get("pinyin", ""),
        "abbr": item.get("abbr", ""),
        "aliases": item.get("aliases", []),
        "tags": item.get("tags", []),
        "status": item.get("status", "active"),
        "notify_email_placeholder": item.get("notify_email_placeholder", ""),
        "notify_feishu_placeholder": item.get("notify_feishu_placeholder", ""),
    }



def build_catalog_rows_from_config(config: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(config, dict):
        return []

    catalog_rows: list[dict[str, Any]] = []
    funds = config.get("funds", [])
    if isinstance(funds, list):
        for item in funds:
            if not isinstance(item, dict):
                continue
            catalog_rows.append(_catalog_row_from_config_item(item))

    portfolio = config.get("portfolio", {})
    holdings = portfolio.get("holdings", []) if isinstance(portfolio, dict) else []
    if isinstance(holdings, list):
        for item in holdings:
            if not isinstance(item, dict):
                continue
            catalog_rows.append(_catalog_row_from_config_item(item))

    return catalog_rows
