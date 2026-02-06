from __future__ import annotations

from typing import Any

from app.data_sources.base import QuoteProvider


class MockQuoteProvider(QuoteProvider):
    def get_bucket_estimates(self, buckets: list[str]) -> dict[str, dict[str, Any]]:
        return {
            bucket: {
                "estimate_pct": 0.0,
                "confidence": "low",
                "note": "placeholder",
            }
            for bucket in buckets
        }
