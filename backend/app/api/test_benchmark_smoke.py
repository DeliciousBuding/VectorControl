from __future__ import annotations

import unittest
import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.storage.db import clear_estimate_snapshots, save_estimate_snapshot


class BenchmarkSmokeTest(unittest.TestCase):
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

    def test_benchmark_list_and_comparison(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token = self._register(client, f"bench_{suffix}", "pass_123456")
            user = self._me(client, token)
            user_id = str(user.get("id") or user.get("user_id") or "").strip()
            self.assertTrue(user_id)

            headers = {"Authorization": f"Bearer {token}"}

            resp_list = client.get("/api/benchmark/list", headers=headers)
            self.assertEqual(resp_list.status_code, 200, resp_list.text)
            payload_list = resp_list.json()
            benchmarks = payload_list.get("benchmarks") or {}
            self.assertIn("hs300", benchmarks)
            self.assertIn("zz500", benchmarks)
            self.assertIn("cyb50", benchmarks)

            # 无快照时应返回 partial + 空 comparison
            clear_estimate_snapshots(user_id)
            resp_cmp_empty = client.get("/api/benchmark/comparison", headers=headers)
            self.assertEqual(resp_cmp_empty.status_code, 200, resp_cmp_empty.text)
            payload_empty = resp_cmp_empty.json()
            self.assertEqual(payload_empty.get("comparison") or {}, {})
            self.assertEqual((payload_empty.get("data_status") or {}).get("status"), "partial")

            # 写入一条快照后，应返回 confirmed 且 portfolio_return 可计算
            asof = datetime(2026, 2, 9, 9, 0, 0, tzinfo=timezone.utc).isoformat()
            save_estimate_snapshot(
                user_id=user_id,
                asof=asof,
                payload={
                    "funds": [
                        {"market_value_cny": 120.0, "cost_basis_cny": 100.0},
                    ]
                },
            )
            resp_cmp = client.get("/api/benchmark/comparison", headers=headers)
            self.assertEqual(resp_cmp.status_code, 200, resp_cmp.text)
            payload_cmp = resp_cmp.json()
            self.assertEqual((payload_cmp.get("data_status") or {}).get("status"), "confirmed")
            self.assertAlmostEqual(float(payload_cmp.get("portfolio_return") or 0.0), 20.0, places=3)
            comp = payload_cmp.get("comparison") or {}
            self.assertIn("hs300", comp)
            self.assertIn("benchmark_return", comp.get("hs300") or {})


if __name__ == "__main__":
    unittest.main()

