from __future__ import annotations

from typing import Any

from app.data_sources.base import QuoteProvider


class MockQuoteProvider(QuoteProvider):
    def get_fund_quote(self, fund_id: str) -> dict[str, Any] | None:
        return {
            "fund_id": fund_id,
            "name": "",
            "estimate_pct": 0.0,
            "source": "mock",
            "asof": "",
        }
