from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import API_TOKEN, app


class FundSearchFallbackSmokeTest(unittest.TestCase):
    def test_search_should_fallback_to_remote_when_local_empty(self) -> None:
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        remote_rows = [
            {
                "fund_id": "110006",
                "name": "易方达货币A",
                "pinyin": "yfdhba",
                "abbr": "yfdhba",
                "status": "active",
                "source": "eastmoney_search",
            }
        ]
        with TestClient(app) as client:
            with patch(
                "app.api.routers.funds.EastMoneySearchProvider.search_funds",
                return_value=remote_rows,
            ) as mocked:
                resp = client.get("/api/funds/search?q=易方达货币A&limit=5", headers=headers)

        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertEqual(int(body.get("count", -1)), 1)
        items = body.get("items", [])
        self.assertEqual(str(items[0].get("fund_id")), "110006")
        self.assertIn("回源", str(body.get("data_status", {}).get("note", "")))
        mocked.assert_called_once()

    def test_suggest_should_fallback_to_remote_when_local_empty(self) -> None:
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        remote_rows = [
            {
                "fund_id": "005827",
                "name": "易方达蓝筹精选混合",
                "pinyin": "yfdlcjxhh",
                "abbr": "yfdlcjxhh",
                "status": "active",
                "source": "eastmoney_search",
            }
        ]
        with TestClient(app) as client:
            with patch(
                "app.api.routers.funds.EastMoneySearchProvider.search_funds",
                return_value=remote_rows,
            ) as mocked:
                resp = client.get("/api/funds/suggest?keyword=易方达蓝筹&limit=5", headers=headers)

        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertEqual(int(body.get("count", -1)), 1)
        items = body.get("items", [])
        self.assertEqual(str(items[0].get("fund_id")), "005827")
        self.assertIn("回源", str(body.get("data_status", {}).get("note", "")))
        mocked.assert_called_once()

    def test_search_fallback_should_upsert_and_support_detail_lookup(self) -> None:
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        remote_rows = [
            {
                "fund_id": "990001",
                "name": "回源测试基金A",
                "pinyin": "huyuanceshijijina",
                "abbr": "hycsjja",
                "status": "active",
                "source": "eastmoney_search",
            }
        ]
        with TestClient(app) as client:
            with patch(
                "app.api.routers.funds.EastMoneySearchProvider.search_funds",
                return_value=remote_rows,
            ) as mocked:
                search_resp = client.get("/api/funds/search?q=回源测试基金A&limit=5", headers=headers)

            self.assertEqual(search_resp.status_code, 200, search_resp.text)
            search_body = search_resp.json()
            self.assertTrue(
                any(str(item.get("fund_id")) == "990001" for item in search_body.get("items", []))
            )
            mocked.assert_called_once()

            detail_resp = client.get("/api/funds/990001", headers=headers)
            self.assertEqual(detail_resp.status_code, 200, detail_resp.text)
            detail_body = detail_resp.json().get("fund", {})
            self.assertEqual(str(detail_body.get("fund_id")), "990001")


if __name__ == "__main__":
    unittest.main()
