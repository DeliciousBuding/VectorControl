from __future__ import annotations

import unittest

from app.api.routers.funds import _build_fund_detail_stage2


class FundDetailStage2SmokeTest(unittest.TestCase):
    def test_stage2_with_empty_history(self) -> None:
        performance_ranges, integrity, anomalies = _build_fund_detail_stage2([])
        self.assertIn("d7", performance_ranges)
        self.assertIn("d30", performance_ranges)
        self.assertIn("ytd", performance_ranges)
        self.assertFalse(bool(performance_ranges["d7"].get("available")))
        self.assertEqual(str(integrity.get("status")), "missing")
        self.assertEqual(int(integrity.get("history_days", -1)), 0)
        self.assertTrue(isinstance(anomalies, list))
        self.assertGreaterEqual(len(anomalies), 1)
        self.assertEqual(str(anomalies[0].get("type")), "nav_missing")

    def test_stage2_with_sample_history(self) -> None:
        nav_rows = [
            {
                "trade_date": "2025-12-20",
                "estimate_nav": None,
                "unit_nav": 0.98,
                "asof": "2025-12-20T15:00:00+08:00",
                "source": "test",
                "confirm_state": "confirmed",
            },
            {
                "trade_date": "2026-01-01",
                "estimate_nav": None,
                "unit_nav": 1.0,
                "asof": "2026-01-01T15:00:00+08:00",
                "source": "test",
                "confirm_state": "confirmed",
            },
            {
                "trade_date": "2026-01-10",
                "estimate_nav": None,
                "unit_nav": 1.02,
                "asof": "2026-01-10T15:00:00+08:00",
                "source": "test",
                "confirm_state": "estimated",
            },
            {
                "trade_date": "2026-01-20",
                "estimate_nav": None,
                "unit_nav": 1.25,
                "asof": "2026-01-20T15:00:00+08:00",
                "source": "test",
                "confirm_state": "confirmed",
            },
        ]
        performance_ranges, integrity, anomalies = _build_fund_detail_stage2(nav_rows)
        self.assertTrue(bool(performance_ranges["d7"].get("available")))
        self.assertTrue(bool(performance_ranges["d30"].get("available")))
        self.assertTrue(isinstance(performance_ranges["d30"].get("return_pct"), float))
        self.assertEqual(str(integrity.get("latest_trade_date")), "2026-01-20")
        self.assertEqual(int(integrity.get("history_days") or 0), 4)
        self.assertTrue(isinstance(anomalies, list))
        anomaly_types = {str(item.get("type")) for item in anomalies if isinstance(item, dict)}
        self.assertIn("nav_jump", anomaly_types)


if __name__ == "__main__":
    unittest.main()
