from __future__ import annotations

import unittest
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.storage.db import connect


class SipCrudExecuteSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "sip") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json().get("token") or "")
        self.assertTrue(token)
        return {"Authorization": f"Bearer {token}"}

    def _random_fund_id(self) -> str:
        return f"{int(uuid.uuid4().int % 1_000_000):06d}"

    def test_sip_crud_and_execute_flow(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            fund_id = self._random_fund_id()

            create_resp = client.post(
                "/api/sip",
                headers=headers,
                json={
                    "fund_id": fund_id,
                    "fund_name": "测试定投基金",
                    "amount": 128.5,
                    "frequency": "weekly",
                    "day": 3,
                    "note": "smoke",
                },
            )
            self.assertEqual(create_resp.status_code, 200, create_resp.text)
            create_body = create_resp.json()
            self.assertIn("data_status", create_body)
            plan = create_body.get("plan", {})
            plan_id = int(plan.get("id") or 0)
            self.assertGreater(plan_id, 0)
            self.assertEqual(str(plan.get("fund_id")), fund_id)
            self.assertEqual(str(plan.get("frequency")), "weekly")
            self.assertEqual(int(plan.get("day")), 3)
            self.assertTrue(str(plan.get("next_date") or "").strip())

            list_resp = client.get("/api/sip", headers=headers)
            self.assertEqual(list_resp.status_code, 200, list_resp.text)
            list_body = list_resp.json()
            self.assertIn("data_status", list_body)
            ids = {int(item.get("id")) for item in list_body.get("plans", []) if item.get("id") is not None}
            self.assertIn(plan_id, ids)

            detail_resp = client.get(f"/api/sip/{plan_id}", headers=headers)
            self.assertEqual(detail_resp.status_code, 200, detail_resp.text)
            detail_body = detail_resp.json()
            self.assertEqual(int(detail_body.get("plan", {}).get("id") or 0), plan_id)
            self.assertIn("data_status", detail_body)

            patch_resp = client.patch(
                f"/api/sip/{plan_id}",
                headers=headers,
                json={"amount": 256.0, "day": 5, "note": "updated"},
            )
            self.assertEqual(patch_resp.status_code, 200, patch_resp.text)
            patch_plan = patch_resp.json().get("plan", {})
            self.assertAlmostEqual(float(patch_plan.get("amount") or 0), 256.0, places=4)
            self.assertEqual(int(patch_plan.get("day") or 0), 5)

            execute_resp = client.post(f"/api/sip/{plan_id}/execute", headers=headers)
            self.assertEqual(execute_resp.status_code, 200, execute_resp.text)
            execute_plan = execute_resp.json().get("plan", {})
            self.assertTrue(str(execute_plan.get("last_executed") or "").strip())
            self.assertTrue(str(execute_plan.get("next_date") or "").strip())

            delete_resp = client.delete(f"/api/sip/{plan_id}", headers=headers)
            self.assertEqual(delete_resp.status_code, 200, delete_resp.text)
            self.assertTrue(bool(delete_resp.json().get("deleted")))

            missing_resp = client.get(f"/api/sip/{plan_id}", headers=headers)
            self.assertEqual(missing_resp.status_code, 404, missing_resp.text)

    def test_sip_validation_and_user_isolation(self) -> None:
        with TestClient(app) as client:
            headers_a = self._register_headers(client, prefix="sip_a")
            headers_b = self._register_headers(client, prefix="sip_b")

            bad_fund_id_resp = client.post(
                "/api/sip",
                headers=headers_a,
                json={
                    "fund_id": "abc123",
                    "fund_name": "坏数据",
                    "amount": 50,
                    "frequency": "weekly",
                    "day": 3,
                },
            )
            self.assertEqual(bad_fund_id_resp.status_code, 422, bad_fund_id_resp.text)

            bad_day_resp = client.post(
                "/api/sip",
                headers=headers_a,
                json={
                    "fund_id": self._random_fund_id(),
                    "fund_name": "坏数据2",
                    "amount": 50,
                    "frequency": "biweekly",
                    "day": 9,
                },
            )
            self.assertEqual(bad_day_resp.status_code, 422, bad_day_resp.text)

            create_resp = client.post(
                "/api/sip",
                headers=headers_a,
                json={
                    "fund_id": self._random_fund_id(),
                    "fund_name": "隔离测试",
                    "amount": 88,
                    "frequency": "monthly",
                    "day": 15,
                },
            )
            self.assertEqual(create_resp.status_code, 200, create_resp.text)
            plan_id = int(create_resp.json().get("plan", {}).get("id") or 0)
            self.assertGreater(plan_id, 0)

            update_bad_combo = client.patch(
                f"/api/sip/{plan_id}",
                headers=headers_a,
                json={"frequency": "weekly", "day": 8},
            )
            self.assertEqual(update_bad_combo.status_code, 422, update_bad_combo.text)

            user_b_detail = client.get(f"/api/sip/{plan_id}", headers=headers_b)
            self.assertEqual(user_b_detail.status_code, 404, user_b_detail.text)

            user_b_execute = client.post(f"/api/sip/{plan_id}/execute", headers=headers_b)
            self.assertEqual(user_b_execute.status_code, 404, user_b_execute.text)

    def test_sip_table_initialized_in_init_db(self) -> None:
        with TestClient(app):
            with connect() as conn:
                row = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='sip_plans' LIMIT 1"
                ).fetchone()
            self.assertIsNotNone(row)


if __name__ == "__main__":
    unittest.main()
