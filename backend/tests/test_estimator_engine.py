from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.data_sources.base import QuoteProvider
from app.estimator.engine import build_estimate


class StubQuoteProvider(QuoteProvider):
    def __init__(self, mapping: dict[str, dict[str, Any] | None]) -> None:
        self.mapping = mapping
        self.calls: list[str] = []

    def get_fund_quote(self, fund_id: str) -> dict[str, Any] | None:
        self.calls.append(fund_id)
        return self.mapping.get(fund_id)


def _portfolio(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {"holdings": rows}


def test_主源成功时应返回有效状态并按市值加权() -> None:
    provider = StubQuoteProvider(
        {
            "100001": {"estimate_pct": -1.0, "source": "eastmoney", "asof": "2026-02-06 14:50"},
            "100002": {"estimate_pct": 1.0, "source": "eastmoney", "asof": "2026-02-06 14:50"},
        }
    )
    portfolio = _portfolio(
        [
            {"fund_id": "100001", "name": "基金A", "bucket": "tech", "market_value_cny": 100},
            {"fund_id": "100002", "name": "基金B", "bucket": "tech", "market_value_cny": 300},
        ]
    )

    payload = build_estimate(provider=provider, portfolio=portfolio)
    tech = next(item for item in payload["buckets"] if item["bucket"] == "tech")
    funds = {item["fund_id"]: item for item in payload["funds"]}

    assert tech["estimate_pct"] == 0.5
    assert funds["100001"]["status"] == "ok"
    assert funds["100001"]["reason"] == ""
    assert funds["100001"]["source"] == "eastmoney"
    assert funds["100001"]["asof"] == "2026-02-06 14:50"


def test_回退源成功时应标记回退来源() -> None:
    provider = StubQuoteProvider(
        {
            "200001": {
                "estimate_pct": 0.28,
                "source": "tencent_fallback",
                "asof": "2026-02-06 14:55",
            }
        }
    )
    portfolio = _portfolio(
        [
            {"fund_id": "200001", "name": "基金C", "bucket": "dividend", "market_value_cny": 120},
        ]
    )

    payload = build_estimate(provider=provider, portfolio=portfolio)
    fund = payload["funds"][0]

    assert fund["status"] == "ok"
    assert fund["source"] == "tencent_fallback"
    assert fund["estimate_pct"] == 0.28


def test_单只基金失败不影响同桶聚合计算() -> None:
    provider = StubQuoteProvider(
        {
            "300001": {"estimate_pct": -0.4, "source": "eastmoney", "asof": "2026-02-06 14:57"},
            "300002": None,
        }
    )
    portfolio = _portfolio(
        [
            {"fund_id": "300001", "name": "基金D", "bucket": "consumer", "market_value_cny": 200},
            {"fund_id": "300002", "name": "基金E", "bucket": "consumer", "market_value_cny": 200},
        ]
    )

    payload = build_estimate(provider=provider, portfolio=portfolio)
    consumer = next(item for item in payload["buckets"] if item["bucket"] == "consumer")
    funds = {item["fund_id"]: item for item in payload["funds"]}

    assert consumer["estimate_pct"] == -0.4
    assert "1/2" in consumer["note"]
    assert funds["300002"]["status"] == "failed"
    assert funds["300002"]["reason"] == "未获取到估值"


def test_增量刷新可复用快照报价并减少外部请求() -> None:
    provider = StubQuoteProvider(
        {
            "400001": {"estimate_pct": -0.2, "source": "eastmoney", "asof": "2026-02-06 14:58"},
            "400002": {"estimate_pct": 0.6, "source": "eastmoney", "asof": "2026-02-06 14:58"},
        }
    )
    portfolio = _portfolio(
        [
            {"fund_id": "400001", "name": "基金F", "bucket": "tech", "market_value_cny": 180},
            {"fund_id": "400002", "name": "基金G", "bucket": "tech", "market_value_cny": 220},
        ]
    )
    now_iso = datetime.now(timezone.utc).isoformat()
    incremental_snapshot = {
        "asof": now_iso,
        "funds": [
            {
                "fund_id": "400001",
                "status": "ok",
                "estimate_pct": 0.3,
                "estimate_nav": 1.2356,
                "nav": 1.236,
                "source": "eastmoney",
                "quote_asof": now_iso,
            }
        ],
    }

    payload = build_estimate(
        provider=provider,
        portfolio=portfolio,
        incremental_snapshot=incremental_snapshot,
        enable_incremental_refresh=True,
        quote_cache_ttl_seconds=180,
    )
    funds = {item["fund_id"]: item for item in payload["funds"]}

    assert provider.calls == ["400002"]
    assert payload["incremental_enabled"] is True
    assert payload["incremental_mode"] == "partial_reuse"
    assert payload["incremental_reused_quotes"] == 1
    assert payload["incremental_fetched_quotes"] == 1
    assert funds["400001"]["quote_cache_hit"] is True
    assert funds["400002"]["quote_cache_hit"] is False
    assert funds["400001"]["estimate_pct"] == 0.3


def test_周末休市时国内基金应标记为已更新() -> None:
    provider = StubQuoteProvider(
        {
            "500001": {"estimate_pct": 0.12, "source": "eastmoney", "asof": "2026-02-06 15:00"},
        }
    )
    portfolio = _portfolio(
        [
            {
                "fund_id": "500001",
                "name": "基金H",
                "bucket": "tech",
                "market_value_cny": 150,
                "market_group": "cn_hk",
            },
        ]
    )

    payload = build_estimate(
        provider=provider,
        portfolio=portfolio,
        now_local=datetime(2026, 2, 8, 10, 0, 0),  # 周日，本地时间
    )
    fund = payload["funds"][0]

    assert fund["status"] == "ok"
    assert fund["confirm_state"] == "confirmed"
    assert fund["yesterday_profit_source"] == "market_closed_snapshot"
    assert payload["confirm_state"] == "confirmed"


def test_交易已确认且无pending时应进入确认口径() -> None:
    provider = StubQuoteProvider(
        {
            "600001": {"estimate_pct": 0.08, "source": "eastmoney", "asof": "2026-02-10 15:00"},
        }
    )
    portfolio = _portfolio(
        [
            {
                "fund_id": "600001",
                "name": "基金I",
                "bucket": "tech",
                "market_value_cny": 300,
                "market_group": "cn_hk",
            },
        ]
    )

    payload = build_estimate(
        provider=provider,
        portfolio=portfolio,
        transaction_summary_map={
            "600001": {
                "total_count": 2,
                "pending_count": 0,
                "confirmed_count": 2,
                "last_occurred_at": "2026-02-10T10:00:00+08:00",
            }
        },
        now_local=datetime(2026, 2, 10, 16, 0, 0),
    )
    fund = payload["funds"][0]

    assert fund["status"] == "ok"
    assert fund["confirm_state"] == "confirmed"
    assert fund["yesterday_profit_source"] == "transaction_confirmed"
    assert fund["transaction_pending_count"] == 0
    assert fund["transaction_confirmed_count"] == 2
    assert payload["confirm_state"] == "confirmed"
