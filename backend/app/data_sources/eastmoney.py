from __future__ import annotations

import json
import re
import time
from typing import Any
from urllib import error, parse, request

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


def _normalize_keyword(keyword: str) -> str:
    text = str(keyword or "").strip()
    if not text:
        return ""
    return re.sub(r"\s+", " ", text)


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


class EastMoneySearchProvider:
    SEARCH_ENDPOINT = "https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx"

    def __init__(self, timeout_seconds: float = 4.0) -> None:
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def _parse_search_payload(payload: Any, limit: int = 20) -> list[dict[str, Any]]:
        if not isinstance(payload, dict):
            return []

        raw_items = payload.get("Datas")
        if not isinstance(raw_items, list):
            return []

        safe_limit = max(1, min(int(limit), 50))
        items: list[dict[str, Any]] = []
        seen_codes: set[str] = set()

        for row in raw_items:
            if not isinstance(row, dict):
                continue

            category = str(row.get("CATEGORYDESC") or "").strip()
            category_code = str(row.get("CATEGORY") or "").strip()
            is_fund = ("基金" in category) or (category_code == "700")
            if not is_fund:
                continue

            fund_id = _normalize_code(
                str(row.get("CODE") or row.get("FCODE") or row.get("_id") or "")
            )
            name = str(row.get("NAME") or row.get("SHORTNAME") or "").strip()
            if not fund_id or not name:
                continue
            if fund_id in seen_codes:
                continue
            seen_codes.add(fund_id)

            pinyin = str(row.get("JP") or "").strip().lower()
            items.append(
                {
                    "fund_id": fund_id,
                    "name": name,
                    "pinyin": pinyin,
                    "abbr": pinyin[:32],
                    "aliases": [],
                    "tags": [],
                    "status": "active",
                    "source": "eastmoney_search",
                }
            )
            if len(items) >= safe_limit:
                break

        return items

    def search_funds(self, keyword: str, limit: int = 20) -> list[dict[str, Any]]:
        clean_keyword = _normalize_keyword(keyword)
        if not clean_keyword:
            return []

        safe_limit = max(1, min(int(limit), 50))
        query = parse.urlencode({"m": "1", "key": clean_keyword})
        url = f"{self.SEARCH_ENDPOINT}?{query}"
        req = request.Request(
            url,
            headers={
                "User-Agent": _UA,
                "Referer": "https://fund.eastmoney.com/",
                "Accept": "application/json",
            },
            method="GET",
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                text = resp.read().decode("utf-8", errors="ignore")
        except (error.URLError, TimeoutError, ValueError):
            return []

        try:
            payload = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return []

        return self._parse_search_payload(payload, limit=safe_limit)
