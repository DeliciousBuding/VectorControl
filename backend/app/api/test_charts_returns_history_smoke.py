from __future__ import annotations

import unittest
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.storage.db import clear_estimate_snapshots, save_estimate_snapshot


class ChartsReturnsHistorySmokeTest(unittest.TestCase):
    def _register(self, client: TestClient, username: str, password: str) -> str:
        resp = client.post("/api/auth/register", json={"username": username, "password": password})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = resp.json().get("token")
        self.assertTrue(str(token or "").strip())
        return str(token)

    def _me(self, client: TestClient, token: str) -> dict:
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200, resp.text)
        return resp.json().get("user") or {}

    def test_returns_history_and_cumulative_returns(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token = self._register(client, f"charts_{suffix}", "pass_123456")
            user = self._me(client, token)
            user_id = str(user.get("id") or user.get("user_id") or "").strip()
            self.assertTrue(user_id)

            # 清理遗留快照，避免历史数据影响断言。
            clear_estimate_snapshots(user_id)

            base = datetime(2026, 2, 7, 8, 0, 0, tzinfo=timezone.utc)
            # 同一天两条快照，后者应覆盖前者。
            save_estimate_snapshot(
                user_id=user_id,
                asof=(base).isoformat(),
                payload={
                    "funds": [
                        {"market_value_cny": 110.0, "cost_basis_cny": 100.0, "day_profit_cny": 1.2},
                    ]
                },
            )
            save_estimate_snapshot(
                user_id=user_id,
                asof=(base + timedelta(hours=10)).isoformat(),
                payload={
                    "funds": [
                        {"market_value_cny": 120.0, "cost_basis_cny": 100.0, "day_profit_cny": 2.0},
                    ]
                },
            )
            # 第二天一条快照。
            save_estimate_snapshot(
                user_id=user_id,
                asof=(base + timedelta(days=1, hours=9)).isoformat(),
                payload={
                    "funds": [
                        {"market_value_cny": 130.0, "cost_basis_cny": 100.0, "day_profit_cny": -3.5},
                    ]
                },
            )

            headers = {"Authorization": f"Bearer {token}"}
            history_resp = client.get("/api/charts/returns_history?days=30", headers=headers)
            self.assertEqual(history_resp.status_code, 200, history_resp.text)
            history = history_resp.json()
            self.assertIn("data", history)
            self.assertGreaterEqual(len(history.get("data") or []), 2)
            self.assertIn("data_status", history)

            # 最新一天的 total_return 应为 (130-100)/100*100=30
            last = (history.get("data") or [])[-1]
            self.assertAlmostEqual(float(last.get("total_return") or 0.0), 30.0, places=3)

            cumulative_resp = client.get("/api/charts/cumulative_returns?days=30", headers=headers)
            self.assertEqual(cumulative_resp.status_code, 200, cumulative_resp.text)
            cumulative = cumulative_resp.json()
            labels = cumulative.get("labels") or []
            values = cumulative.get("values") or []
            self.assertEqual(len(labels), len(values))
            self.assertGreaterEqual(len(labels), 2)
            self.assertIn("data_status", cumulative)

            bad_resp = client.get("/api/charts/returns_history?days=15", headers=headers)
            self.assertEqual(bad_resp.status_code, 422, bad_resp.text)
            detail = (bad_resp.json() or {}).get("detail")
            self.assertIsInstance(detail, str)
            self.assertIn("7/30/90", detail)
            self.assertIn("trace_id=", detail)


if __name__ == "__main__":
    unittest.main()
