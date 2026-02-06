from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any

from app.core.config_loader import load_all
from app.data_sources.base import QuoteProvider
from app.data_sources.eastmoney import EastMoneyQuoteProvider

BUCKETS = ["tech", "dividend", "consumer", "manufacturing"]


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _portfolio_holdings(portfolio: dict[str, Any] | None) -> list[dict[str, Any]]:
    if isinstance(portfolio, dict):
        holdings = portfolio.get("holdings", [])
        if isinstance(holdings, list):
            return [item for item in holdings if isinstance(item, dict)]

    config = load_all()
    config_portfolio = config.get("portfolio", {})
    holdings = config_portfolio.get("holdings", []) if isinstance(config_portfolio, dict) else []
    return [item for item in holdings if isinstance(item, dict)]


def _market_value(item: dict[str, Any]) -> float:
    # Priority: explicit market value, then fallback to cost basis/cost.
    for key in ("market_value_cny", "market_value", "cost_basis_cny", "cost_basis", "cost"):
        value = _to_float(item.get(key))
        if value is not None and value > 0:
            return value
    return 0.0


def _bucket_summary(bucket: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {
            "bucket": bucket,
            "estimate_pct": 0.0,
            "confidence": "low",
            "note": "no holdings configured",
        }

    valid = [row for row in rows if isinstance(row.get("estimate_pct"), float)]
    if not valid:
        return {
            "bucket": bucket,
            "estimate_pct": 0.0,
            "confidence": "low",
            "note": "no quote data",
        }

    use_market_weight = any(float(row.get("market_value_cny", 0.0)) > 0 for row in valid)
    weighted_sum = 0.0
    weight_sum = 0.0
    if use_market_weight:
        for row in valid:
            weight = float(row.get("market_value_cny", 0.0))
            if weight <= 0:
                continue
            weighted_sum += float(row["estimate_pct"]) * weight
            weight_sum += weight

    if weight_sum <= 0:
        weighted_sum = sum(float(row["estimate_pct"]) for row in valid)
        weight_sum = float(len(valid))

    estimate_pct = weighted_sum / weight_sum if weight_sum > 0 else 0.0
    coverage = len(valid) / len(rows)
    if coverage >= 0.8:
        confidence = "high"
    elif coverage >= 0.5:
        confidence = "medium"
    else:
        confidence = "low"

    source_counter = Counter(str(row.get("source", "unknown")) for row in valid)
    top_source = source_counter.most_common(1)[0][0] if source_counter else "unknown"
    note = f"{len(valid)}/{len(rows)} funds, source={top_source}"

    return {
        "bucket": bucket,
        "estimate_pct": round(estimate_pct, 4),
        "confidence": confidence,
        "note": note,
    }


def build_estimate(
    provider: QuoteProvider | None = None,
    portfolio: dict[str, Any] | None = None,
) -> dict[str, Any]:
    provider = provider or EastMoneyQuoteProvider()
    asof = datetime.now(timezone.utc).isoformat()

    holdings = _portfolio_holdings(portfolio)
    per_fund: list[dict[str, Any]] = []
    by_bucket: dict[str, list[dict[str, Any]]] = {bucket: [] for bucket in BUCKETS}

    for item in holdings:
        bucket = str(item.get("bucket", "")).strip()
        if bucket not in by_bucket:
            continue

        fund_id = str(item.get("fund_id", "")).strip()
        name = str(item.get("name", "")).strip()
        market_value = _market_value(item)

        quote: dict[str, Any] | None = None
        if fund_id:
            try:
                quote = provider.get_fund_quote(fund_id)
            except Exception:
                quote = None

        estimate_pct = None
        source = "none"
        quote_asof = ""
        if isinstance(quote, dict):
            value = _to_float(quote.get("estimate_pct"))
            if value is not None:
                estimate_pct = float(value)
            source = str(quote.get("source", "unknown"))
            quote_asof = str(quote.get("asof", ""))

        fund_row = {
            "fund_id": fund_id,
            "name": name,
            "bucket": bucket,
            "market_value_cny": round(market_value, 2),
            "estimate_pct": estimate_pct,
            "source": source,
            "quote_asof": quote_asof,
        }
        per_fund.append(fund_row)
        by_bucket[bucket].append(fund_row)

    buckets = [_bucket_summary(bucket, by_bucket[bucket]) for bucket in BUCKETS]

    return {
        "asof": asof,
        "buckets": buckets,
        "funds": per_fund,
    }
