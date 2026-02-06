from __future__ import annotations

import uuid
from datetime import datetime
import unittest

from fastapi.testclient import TestClient

from app.core.rate_limit import reset_auth_rate_limiter
from app.main import app


class AuthIsolationSmokeTest(unittest.TestCase):
    def setUp(self) -> None:
        reset_auth_rate_limiter()

    def _register(self, client: TestClient, username: str, password: str) -> str:
        resp = client.post("/api/auth/register", json={"username": username, "password": password})
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertIn("token", body)
        return str(body["token"])

    def test_auth_guard_401(self) -> None:
        with TestClient(app) as client:
            missing_resp = client.get("/api/config")
            self.assertEqual(missing_resp.status_code, 401, missing_resp.text)

            invalid_resp = client.get("/api/config", headers={"Authorization": "Bearer invalid-token"})
            self.assertEqual(invalid_resp.status_code, 401, invalid_resp.text)

    def test_user_data_isolation(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token_a = self._register(client, f"iso_a_{suffix}", "pass_123456")
            token_b = self._register(client, f"iso_b_{suffix}", "pass_123456")

            headers_a = {"Authorization": f"Bearer {token_a}"}
            headers_b = {"Authorization": f"Bearer {token_b}"}

            unique_fund_id = f"U{uuid.uuid4().hex[:5].upper()}"
            create_resp = client.post(
                "/api/holdings",
                headers=headers_a,
                json={
                    "fund_id": unique_fund_id,
                    "name": "隔离验证基金",
                    "bucket": "consumer",
                    "market_group": "cn_hk",
                    "market_value_cny": 88.0,
                    "cost_basis_cny": 80.0,
                },
            )
            self.assertEqual(create_resp.status_code, 200, create_resp.text)

            list_a = client.get("/api/holdings", headers=headers_a).json().get("holdings", [])
            list_b = client.get("/api/holdings", headers=headers_b).json().get("holdings", [])
            ids_a = {row["fund_id"] for row in list_a}
            ids_b = {row["fund_id"] for row in list_b}
            self.assertIn(unique_fund_id, ids_a)
            self.assertNotIn(unique_fund_id, ids_b)

            patch_b = client.patch(
                f"/api/holdings/{unique_fund_id}",
                headers=headers_b,
                json={"market_value_cny": 99.0},
            )
            self.assertEqual(patch_b.status_code, 400, patch_b.text)

            today = datetime.now().astimezone().date().isoformat()
            action_a = client.post(
                "/api/actions",
                headers=headers_a,
                json={"date": today, "action_key": "isolation_action", "amount": 10, "done": True},
            )
            self.assertEqual(action_a.status_code, 200, action_a.text)

            actions_a = client.get(f"/api/actions?date={today}", headers=headers_a).json().get("actions", [])
            actions_b = client.get(f"/api/actions?date={today}", headers=headers_b).json().get("actions", [])
            keys_a = {row["action_key"] for row in actions_a}
            keys_b = {row["action_key"] for row in actions_b}
            self.assertIn("isolation_action", keys_a)
            self.assertNotIn("isolation_action", keys_b)

    def test_login_rate_limit(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            username = f"limit_{suffix}"
            password = "pass_123456"
            self._register(client, username, password)

            status_codes: list[int] = []
            for _ in range(6):
                resp = client.post("/api/auth/login", json={"username": username, "password": "wrong-password"})
                status_codes.append(resp.status_code)

            self.assertEqual(status_codes[:5], [401, 401, 401, 401, 401])
            self.assertEqual(status_codes[5], 429)

            blocked_resp = client.post("/api/auth/login", json={"username": username, "password": "wrong-password"})
            self.assertEqual(blocked_resp.status_code, 429, blocked_resp.text)
            self.assertIn("Retry-After", blocked_resp.headers)

    def test_estimate_has_coverage_and_yesterday_source(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token = self._register(client, f"cov_{suffix}", "pass_123456")
            headers = {"Authorization": f"Bearer {token}"}

            estimate_resp = client.get("/api/estimate", headers=headers)
            self.assertEqual(estimate_resp.status_code, 200, estimate_resp.text)
            body = estimate_resp.json()

            coverage = body.get("coverage", {})
            self.assertIn("total", coverage)
            self.assertIn("ok", coverage)
            self.assertIn("failed", coverage)
            self.assertEqual(int(coverage["total"]), int(coverage["ok"]) + int(coverage["failed"]))
            self.assertIn("as_of", body)
            self.assertIn("updated_at", body)
            self.assertIn("confirm_state", body)

            funds = body.get("funds", [])
            self.assertTrue(isinstance(funds, list))
            for row in funds:
                self.assertIn("yesterday_profit_source", row)
                self.assertIn("as_of", row)
                self.assertIn("updated_at", row)
                self.assertIn("confirm_state", row)


if __name__ == "__main__":
    unittest.main()
