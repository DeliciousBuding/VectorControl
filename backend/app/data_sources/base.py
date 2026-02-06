from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class QuoteProvider(ABC):
    @abstractmethod
    def get_fund_quote(self, fund_id: str) -> dict[str, Any] | None:
        """Return quote info for one fund. None means unavailable."""
