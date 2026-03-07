from __future__ import annotations

import unittest

from app.storage.catalog_sync import build_catalog_rows_from_config


class CatalogSyncSmokeTest(unittest.TestCase):
    def test_build_catalog_rows_merges_funds_and_portfolio_holdings(self) -> None:
        config = {
            "funds": [
                {
                    "fund_id": "000001",
                    "name": "示例基金A",
                    "aliases": ["基金A"],
                    "tags": ["core"],
                    "status": "active",
                },
                "skip-me",
            ],
            "portfolio": {
                "holdings": [
                    {
                        "fund_id": "000002",
                        "name": "示例基金B",
                        "abbr": "jjb",
                        "notify_email_placeholder": "owner@example.com",
                    },
                    123,
                ]
            },
        }

        rows = build_catalog_rows_from_config(config)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["fund_id"], "000001")
        self.assertEqual(rows[0]["name"], "示例基金A")
        self.assertEqual(rows[0]["aliases"], ["基金A"])
        self.assertEqual(rows[0]["tags"], ["core"])
        self.assertEqual(rows[0]["status"], "active")
        self.assertEqual(rows[0]["pinyin"], "")
        self.assertEqual(rows[0]["abbr"], "")
        self.assertEqual(rows[0]["notify_email_placeholder"], "")
        self.assertEqual(rows[0]["notify_feishu_placeholder"], "")

        self.assertEqual(rows[1]["fund_id"], "000002")
        self.assertEqual(rows[1]["name"], "示例基金B")
        self.assertEqual(rows[1]["abbr"], "jjb")
        self.assertEqual(rows[1]["notify_email_placeholder"], "owner@example.com")
        self.assertEqual(rows[1]["aliases"], [])
        self.assertEqual(rows[1]["tags"], [])
        self.assertEqual(rows[1]["status"], "active")

    def test_build_catalog_rows_returns_empty_for_non_dict_config(self) -> None:
        self.assertEqual(build_catalog_rows_from_config({}), [])
        self.assertEqual(build_catalog_rows_from_config([]), [])


if __name__ == "__main__":
    unittest.main()
