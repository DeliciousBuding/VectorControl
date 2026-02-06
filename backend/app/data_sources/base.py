from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class QuoteProvider(ABC):
    @abstractmethod
    def get_bucket_estimates(self, buckets: list[str]) -> dict[str, dict[str, Any]]:
        """Return per-bucket estimate info."""
