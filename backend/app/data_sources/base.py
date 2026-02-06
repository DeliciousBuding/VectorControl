from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class QuoteProvider(ABC):
    @abstractmethod
    def get_fund_quote(self, fund_id: str) -> dict[str, Any] | None:
        """返回单只基金估值信息；返回 None 表示当前不可用。"""
