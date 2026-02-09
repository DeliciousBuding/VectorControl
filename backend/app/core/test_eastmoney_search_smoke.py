from __future__ import annotations

import unittest

from app.data_sources.eastmoney import EastMoneySearchProvider


class EastMoneySearchSmokeTest(unittest.TestCase):
    def test_parse_search_payload_only_keeps_fund_category(self) -> None:
        payload = {
            "ErrCode": 0,
            "Datas": [
                {
                    "CODE": "110006",
                    "NAME": "易方达货币A",
                    "JP": "YFDHBA",
                    "CATEGORY": 700,
                    "CATEGORYDESC": "基金",
                },
                {
                    "CODE": "600000",
                    "NAME": "浦发银行",
                    "JP": "PFYH",
                    "CATEGORY": 1,
                    "CATEGORYDESC": "股票",
                },
                {
                    "CODE": "021778",
                    "NAME": "广发纳指100ETF联接(QDII)人民币F",
                    "JP": "GFNZ100ETFLJQDIIRMBF",
                    "CATEGORY": 700,
                    "CATEGORYDESC": "基金",
                },
            ],
        }

        items = EastMoneySearchProvider._parse_search_payload(payload, limit=10)
        self.assertEqual(len(items), 2)
        ids = [str(item.get("fund_id")) for item in items]
        self.assertEqual(ids, ["110006", "021778"])
        self.assertTrue(all(str(item.get("status")) == "active" for item in items))

    def test_parse_search_payload_should_skip_invalid_or_duplicate_code(self) -> None:
        payload = {
            "ErrCode": 0,
            "Datas": [
                {"CODE": "110006", "NAME": "易方达货币A", "CATEGORY": 700, "CATEGORYDESC": "基金"},
                {"CODE": "110006", "NAME": "易方达货币A重复", "CATEGORY": 700, "CATEGORYDESC": "基金"},
                {"CODE": "ABC123", "NAME": "非法代码", "CATEGORY": 700, "CATEGORYDESC": "基金"},
                {"CODE": "12345", "NAME": "短代码", "CATEGORY": 700, "CATEGORYDESC": "基金"},
            ],
        }

        items = EastMoneySearchProvider._parse_search_payload(payload, limit=10)
        self.assertEqual(len(items), 1)
        self.assertEqual(str(items[0].get("fund_id")), "110006")


if __name__ == "__main__":
    unittest.main()

