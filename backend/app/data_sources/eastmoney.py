from __future__ import annotations

import json
import re
import time
from typing import Any
from urllib import error, request

from app.data_sources.base import QuoteProvider

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _normalize_code(fund_id: str) -> str | None:
    code = str(fund_id or "").strip()
    return code if re.fullmatch(r"\d{6}", code) else None


class EastMoneyQuoteProvider(QuoteProvider):
    def __init__(self, timeout_seconds: float = 4.0) -> None:
        self.timeout_seconds = timeout_seconds

    def get_fund_quote(self, fund_id: str) -> dict[str, Any] | None:
        code = _normalize_code(fund_id)
        if not code:
            return None

        quote = self._fetch_eastmoney(code)
        if quote is not None:
            return quote

        return self._fetch_tencent(code)

    def _fetch_eastmoney(self, code: str) -> dict[str, Any] | None:
        url = f"https://fundgz.1234567.com.cn/js/{code}.js?rt={int(time.time() * 1000)}"
        req = request.Request(
            url,
            headers={
                "User-Agent": _UA,
                "Referer": "https://fund.eastmoney.com/",
            },
            method="GET",
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
        except (error.URLError, TimeoutError, ValueError):
            return None

        match = re.search(r"jsonpgz\((.*)\)\s*;?", raw)
        if not match:
            return None

        try:
            payload = json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            return None

        pct = _to_float(payload.get("gszzl"))
        if pct is None:
            return None

        return {
            "fund_id": code,
            "name": str(payload.get("name", "")).strip(),
            "estimate_pct": pct,
            "estimate_nav": _to_float(payload.get("gsz")),
            "nav": _to_float(payload.get("dwjz")),
            "asof": str(payload.get("gztime", "")),
            "source": "eastmoney",
        }

    def _fetch_tencent(self, code: str) -> dict[str, Any] | None:
        url = f"https://qt.gtimg.cn/q=jj{code}"
        req = request.Request(url, headers={"User-Agent": _UA}, method="GET")
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                blob = resp.read()
        except (error.URLError, TimeoutError, ValueError):
            return None

        text = blob.decode("utf-8", errors="ignore")
        if "~" not in text:
            text = blob.decode("gbk", errors="ignore")

        match = re.search(r'v_jj\d+="([^"]*)"', text)
        if not match:
            return None

        parts = match.group(1).split("~")
        if len(parts) < 9:
            return None

        pct = _to_float(parts[7])
        if pct is None:
            return None

        return {
            "fund_id": code,
            "name": parts[1].strip() if len(parts) > 1 else "",
            "estimate_pct": pct,
            "estimate_nav": _to_float(parts[5]) if len(parts) > 5 else None,
            "nav": _to_float(parts[6]) if len(parts) > 6 else None,
            "asof": parts[8].strip() if len(parts) > 8 else "",
            "source": "tencent_fallback",
        }
