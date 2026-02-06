from __future__ import annotations

from typing import Any

from app.data_sources.base import QuoteProvider
from app.estimator.engine import build_estimate


class StubQuoteProvider(QuoteProvider):
    def __init__(self, mapping: dict[str, dict[str, Any] | None]) -> None:
        self.mapping = mapping

    def get_fund_quote(self, fund_id: str) -> dict[str, Any] | None:
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
