from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.data_sources.base import QuoteProvider
from app.data_sources.mock import MockQuoteProvider

BUCKETS = ["tech", "dividend", "consumer", "manufacturing"]


def build_estimate(provider: QuoteProvider | None = None) -> dict[str, Any]:
    provider = provider or MockQuoteProvider()
    asof = datetime.now(timezone.utc).isoformat()

    raw = provider.get_bucket_estimates(BUCKETS)
    buckets: list[dict[str, Any]] = []
    for bucket in BUCKETS:
        info = raw.get(
            bucket,
            {
                "estimate_pct": 0.0,
                "confidence": "low",
                "note": "placeholder",
            },
        )
        buckets.append(
            {
                "bucket": bucket,
                "estimate_pct": float(info.get("estimate_pct", 0.0)),
                "confidence": info.get("confidence", "low"),
                "note": info.get("note", ""),
            }
        )

    return {
        "asof": asof,
        "buckets": buckets,
        "funds": [],
    }
