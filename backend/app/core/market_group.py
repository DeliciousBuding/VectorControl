from __future__ import annotations

from typing import Iterable


def _normalize_text(value: object) -> str:
    return str(value or "").strip().lower()


def _normalize_tags(tags: Iterable[object] | None) -> set[str]:
    if not tags:
        return set()
    return {_normalize_text(tag) for tag in tags if _normalize_text(tag)}


def decide_market_group(
    *,
    name: str = "",
    tags: Iterable[object] | None = None,
    market: str | None = None,
    currency: str | None = None,
    asset_class: str | None = None,
) -> str:
    """
    市场分组优先级：
    1) 资产类别
    2) 市场
    3) 币种
    4) 标签与名称关键字
    """
    asset = _normalize_text(asset_class)
    market_text = _normalize_text(market)
    currency_text = _normalize_text(currency)
    tag_set = _normalize_tags(tags)
    name_text = _normalize_text(name)

    if asset in {"us", "overseas", "global", "qdii"}:
        return "us_overseas"
    if asset in {"cn", "hk", "domestic"}:
        return "cn_hk"

    if market_text in {"us", "usa", "nyse", "nasdaq", "overseas", "global"}:
        return "us_overseas"
    if market_text in {"cn", "hk", "china", "hongkong", "domestic"}:
        return "cn_hk"

    if currency_text in {"usd"}:
        return "us_overseas"
    if currency_text in {"cny", "hkd", "rmb"}:
        return "cn_hk"

    if {"qdii", "nasdaq", "overseas", "global", "us"} & tag_set:
        return "us_overseas"
    if {"cn", "hk", "domestic"} & tag_set:
        return "cn_hk"

    if "qdii" in name_text or "纳斯达克" in name:
        return "us_overseas"
    return "cn_hk"

