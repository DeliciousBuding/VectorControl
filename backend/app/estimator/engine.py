from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timezone
from typing import Any

from app.core.config_loader import load_all
from app.core.market_group import decide_market_group
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
    for key in ("market_value_cny", "market_value", "cost_basis_cny", "cost_basis", "cost"):
        value = _to_float(item.get(key))
        if value is not None and value > 0:
            return value
    return 0.0


def _cost_basis(item: dict[str, Any]) -> float:
    for key in ("cost_basis_cny", "cost_basis", "cost"):
        value = _to_float(item.get(key))
        if value is not None and value >= 0:
            return value
    return 0.0


def _normalize_tags(item: dict[str, Any]) -> list[str]:
    raw = item.get("tags")
    if isinstance(raw, list):
        return [str(v).strip().lower() for v in raw if str(v).strip()]
    if isinstance(raw, str) and raw.strip():
        return [raw.strip().lower()]
    return []


def _parse_date(text: str) -> date | None:
    raw = str(text or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw).date()
    except ValueError:
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date()
        except ValueError:
            return None


def _holding_days(start_date: str, today: date) -> int:
    parsed = _parse_date(start_date)
    if parsed is None:
        return 0
    days = (today - parsed).days + 1
    return max(days, 0)


def _snapshot_day_profit_map(snapshot: dict[str, Any] | None) -> dict[str, float]:
    if not isinstance(snapshot, dict):
        return {}
    funds = snapshot.get("funds", [])
    if not isinstance(funds, list):
        return {}

    result: dict[str, float] = {}
    for row in funds:
        if not isinstance(row, dict):
            continue
        fund_id = str(row.get("fund_id", "")).strip()
        if not fund_id:
            continue

        day_profit = _to_float(row.get("day_profit_cny"))
        if day_profit is None:
            market_value = _to_float(row.get("market_value_cny")) or 0.0
            estimate_pct = _to_float(row.get("estimate_pct")) or 0.0
            day_profit = market_value * estimate_pct / 100.0
        result[fund_id] = round(day_profit, 2)
    return result


def _bucket_summary(bucket: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {
            "bucket": bucket,
            "estimate_pct": 0.0,
            "confidence": "low",
            "note": "未配置持仓",
        }

    valid = [row for row in rows if isinstance(row.get("estimate_pct"), float)]
    if not valid:
        return {
            "bucket": bucket,
            "estimate_pct": 0.0,
            "confidence": "low",
            "note": "无可用估值数据",
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
    note = f"{len(valid)}/{len(rows)} 只有效，主要来源 {top_source}"

    return {
        "bucket": bucket,
        "estimate_pct": round(estimate_pct, 4),
        "confidence": confidence,
        "note": note,
    }


def build_estimate(
    provider: QuoteProvider | None = None,
    portfolio: dict[str, Any] | None = None,
    previous_snapshot: dict[str, Any] | None = None,
    confirmed_yesterday_profit: dict[str, float] | None = None,
) -> dict[str, Any]:
    provider = provider or EastMoneyQuoteProvider()
    asof = datetime.now(timezone.utc).isoformat()
    today_local = datetime.now().astimezone().date()

    holdings = _portfolio_holdings(portfolio)
    per_fund: list[dict[str, Any]] = []
    by_bucket: dict[str, list[dict[str, Any]]] = {bucket: [] for bucket in BUCKETS}

    eligible_holdings: list[dict[str, Any]] = []
    for item in holdings:
        bucket = str(item.get("bucket", "")).strip()
        if bucket in by_bucket:
            eligible_holdings.append(item)

    total_market_value = sum(_market_value(item) for item in eligible_holdings)
    previous_day_profit_map = _snapshot_day_profit_map(previous_snapshot)
    confirmed_map = confirmed_yesterday_profit or {}

    for item in eligible_holdings:
        bucket = str(item.get("bucket", "")).strip()
        fund_id = str(item.get("fund_id", "")).strip()
        name = str(item.get("name", "")).strip()
        start_date = str(item.get("start_date", "")).strip()

        market_value = _market_value(item)
        cost_basis = _cost_basis(item)
        holding_profit = round(market_value - cost_basis, 2)
        holding_profit_rate = round((holding_profit / cost_basis), 4) if cost_basis > 0 else 0.0
        position_weight_pct = round((market_value / total_market_value) * 100, 4) if total_market_value > 0 else 0.0
        holding_days = _holding_days(start_date, today_local)
        tags = _normalize_tags(item)
        market_group = str(item.get("market_group", "")).strip() or decide_market_group(
            name=name,
            tags=tags,
            market=str(item.get("market", "")),
            currency=str(item.get("currency", "")),
            asset_class=str(item.get("asset_class", "")),
        )

        quote: dict[str, Any] | None = None
        request_error = ""
        if fund_id:
            try:
                quote = provider.get_fund_quote(fund_id)
            except Exception as exc:
                request_error = f"请求异常: {exc.__class__.__name__}"
                quote = None

        estimate_pct = None
        source = "none"
        quote_asof = ""
        status = "failed"
        reason = request_error
        if isinstance(quote, dict):
            value = _to_float(quote.get("estimate_pct"))
            if value is not None:
                estimate_pct = float(value)
                status = "ok"
                reason = ""
            else:
                reason = "估值字段缺失"
            source = str(quote.get("source", "unknown"))
            quote_asof = str(quote.get("asof", ""))
        elif not reason:
            reason = "未获取到估值"

        if not fund_id:
            reason = "缺少基金代码"

        day_profit_cny = round(market_value * ((_to_float(estimate_pct) or 0.0) / 100.0), 2)
        confirmed_profit = _to_float(confirmed_map.get(fund_id)) if fund_id else None
        yesterday_profit_source = "estimated_today"
        if confirmed_profit is not None:
            yesterday_profit_cny = round(confirmed_profit, 2)
            yesterday_profit_source = "confirmed"
        elif fund_id in previous_day_profit_map:
            yesterday_profit_cny = round(previous_day_profit_map[fund_id], 2)
            yesterday_profit_source = "snapshot_fallback"
        else:
            yesterday_profit_cny = day_profit_cny

        fund_row = {
            "fund_id": fund_id,
            "name": name,
            "bucket": bucket,
            "market_value_cny": round(market_value, 2),
            "cost_basis_cny": round(cost_basis, 2),
            "shares": round(_to_float(item.get("shares")) or 0.0, 4),
            "start_date": start_date,
            "holding_profit_cny": holding_profit,
            "holding_profit_rate": holding_profit_rate,
            "day_profit_cny": day_profit_cny,
            "yesterday_profit_cny": yesterday_profit_cny,
            "yesterday_profit_source": yesterday_profit_source,
            "holding_days": holding_days,
            "position_weight_pct": position_weight_pct,
            "estimate_pct": estimate_pct,
            "status": status,
            "reason": reason,
            "source": source,
            "asof": quote_asof,
            "quote_asof": quote_asof,
            "tags": tags,
            "market_group": market_group,
        }
        per_fund.append(fund_row)
        by_bucket[bucket].append(fund_row)

    buckets = [_bucket_summary(bucket, by_bucket[bucket]) for bucket in BUCKETS]
    total_count = len(per_fund)
    ok_count = sum(1 for row in per_fund if row.get("status") == "ok")
    failed_count = total_count - ok_count

    return {
        "asof": asof,
        "buckets": buckets,
        "funds": per_fund,
        "coverage": {
            "total": total_count,
            "ok": ok_count,
            "failed": failed_count,
        },
    }
