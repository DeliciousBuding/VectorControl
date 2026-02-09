from __future__ import annotations

import unittest
import uuid
from datetime import datetime

from fastapi.testclient import TestClient

from app.main import app


class SipSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "sip") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json().get("token") or "")
        self.assertTrue(token)
        return {"Authorization": f"Bearer {token}"}

    def test_sip_crud_execute_and_upcoming(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client, prefix="sipcrud")
            tomorrow_weekday = (datetime.now().astimezone().isoweekday() % 7) + 1

            create_resp = client.post(
                "/api/sip",
                headers=headers,
                json={
                    "fund_id": "012345",
                    "fund_name": "测试定投基金",
                    "amount": 188.8,
                    "frequency": "weekly",
                    "day": tomorrow_weekday,
                    "note": "smoke-create",
                },
            )
            self.assertEqual(create_resp.status_code, 200, create_resp.text)
            create_body = create_resp.json()
            self.assertIn("data_status", create_body)
            created = create_body.get("plan", {})
            plan_id = int(created.get("id") or 0)
            self.assertGreater(plan_id, 0)
            self.assertEqual(str(created.get("fund_id") or ""), "012345")
            self.assertEqual(str(created.get("frequency") or ""), "weekly")
            self.assertTrue(bool(created.get("enabled")))

            list_resp = client.get("/api/sip", headers=headers)
            self.assertEqual(list_resp.status_code, 200, list_resp.text)
            list_body = list_resp.json()
            self.assertGreaterEqual(int(list_body.get("count") or 0), 1)
            self.assertTrue(any(int(item.get("id") or 0) == plan_id for item in list_body.get("plans", [])))

            upcoming_resp = client.get("/api/sip/upcoming?days=14", headers=headers)
            self.assertEqual(upcoming_resp.status_code, 200, upcoming_resp.text)
            upcoming_items = upcoming_resp.json().get("plans", [])
            self.assertTrue(any(int(item.get("id") or 0) == plan_id for item in upcoming_items))

            patch_disable = client.patch(
                f"/api/sip/{plan_id}",
                headers=headers,
                json={"enabled": False, "note": "smoke-disable"},
            )
            self.assertEqual(patch_disable.status_code, 200, patch_disable.text)
            self.assertFalse(bool(patch_disable.json().get("plan", {}).get("enabled")))

            enabled_only_resp = client.get("/api/sip?enabled_only=true", headers=headers)
            self.assertEqual(enabled_only_resp.status_code, 200, enabled_only_resp.text)
            enabled_only_items = enabled_only_resp.json().get("plans", [])
            self.assertFalse(any(int(item.get("id") or 0) == plan_id for item in enabled_only_items))

            patch_enable = client.patch(f"/api/sip/{plan_id}", headers=headers, json={"enabled": True})
            self.assertEqual(patch_enable.status_code, 200, patch_enable.text)

            execute_resp = client.post(f"/api/sip/{plan_id}/execute", headers=headers)
            self.assertEqual(execute_resp.status_code, 200, execute_resp.text)
            executed = execute_resp.json().get("plan", {})
            self.assertEqual(int(executed.get("id") or 0), plan_id)
            self.assertTrue(str(executed.get("last_executed") or "").strip())
            self.assertTrue(str(executed.get("next_date") or "").strip())

            detail_resp = client.get(f"/api/sip/{plan_id}", headers=headers)
            self.assertEqual(detail_resp.status_code, 200, detail_resp.text)
            self.assertEqual(int(detail_resp.json().get("plan", {}).get("id") or 0), plan_id)

            delete_resp = client.delete(f"/api/sip/{plan_id}", headers=headers)
            self.assertEqual(delete_resp.status_code, 200, delete_resp.text)
            self.assertTrue(bool(delete_resp.json().get("deleted")))

            missing_resp = client.get(f"/api/sip/{plan_id}", headers=headers)
            self.assertEqual(missing_resp.status_code, 404, missing_resp.text)

    def test_sip_validation_and_user_isolation(self) -> None:
        with TestClient(app) as client:
            headers_a = self._register_headers(client, prefix="sipa")
            headers_b = self._register_headers(client, prefix="sipb")

            create_resp = client.post(
                "/api/sip",
                headers=headers_a,
                json={
                    "fund_id": "022222",
                    "amount": 100,
                    "frequency": "monthly",
                    "day": 15,
                },
            )
            self.assertEqual(create_resp.status_code, 200, create_resp.text)
            plan_id = int(create_resp.json().get("plan", {}).get("id") or 0)
            self.assertGreater(plan_id, 0)

            get_other = client.get(f"/api/sip/{plan_id}", headers=headers_b)
            self.assertEqual(get_other.status_code, 404, get_other.text)

            patch_other = client.patch(f"/api/sip/{plan_id}", headers=headers_b, json={"amount": 120})
            self.assertEqual(patch_other.status_code, 404, patch_other.text)

            execute_other = client.post(f"/api/sip/{plan_id}/execute", headers=headers_b)
            self.assertEqual(execute_other.status_code, 404, execute_other.text)

            delete_other = client.delete(f"/api/sip/{plan_id}", headers=headers_b)
            self.assertEqual(delete_other.status_code, 404, delete_other.text)

            bad_frequency = client.post(
                "/api/sip",
                headers=headers_a,
                json={
                    "fund_id": "033333",
                    "amount": 100,
                    "frequency": "daily",
                    "day": 1,
                },
            )
            self.assertEqual(bad_frequency.status_code, 422, bad_frequency.text)

            bad_day = client.post(
                "/api/sip",
                headers=headers_a,
                json={
                    "fund_id": "033334",
                    "amount": 100,
                    "frequency": "weekly",
                    "day": 8,
                },
            )
            self.assertEqual(bad_day.status_code, 422, bad_day.text)

            bad_fund_id = client.post(
                "/api/sip",
                headers=headers_a,
                json={
                    "fund_id": "abc",
                    "amount": 100,
                    "frequency": "monthly",
                    "day": 10,
                },
            )
            self.assertEqual(bad_fund_id.status_code, 422, bad_fund_id.text)


if __name__ == "__main__":
    unittest.main()
