from __future__ import annotations

import unittest
import uuid

from fastapi.testclient import TestClient

from app.main import app


class SettingsDcaPlansValidateSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "dca") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_put_settings_validates_dca_plans_fields(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)

            bad_schedule = {
                "settings": {
                    "strategy": {
                        "dca_plans": [
                            {
                                "id": "p1",
                                "name": "plan",
                                "amount": 10.0,
                                "schedule": "daily",
                                "fund_id": "",
                                "paused": False,
                            }
                        ]
                    }
                }
            }
            r1 = client.put("/api/settings", headers=headers, json=bad_schedule)
            self.assertEqual(r1.status_code, 422, r1.text)

            bad_amount = {
                "settings": {
                    "strategy": {
                        "dca_plans": [
                            {
                                "id": "p1",
                                "name": "plan",
                                "amount": 0,
                                "schedule": "weekly",
                                "fund_id": "",
                                "paused": False,
                            }
                        ]
                    }
                }
            }
            r2 = client.put("/api/settings", headers=headers, json=bad_amount)
            self.assertEqual(r2.status_code, 422, r2.text)

            bad_fund_id = {
                "settings": {
                    "strategy": {
                        "dca_plans": [
                            {
                                "id": "p1",
                                "name": "plan",
                                "amount": 10.0,
                                "schedule": "weekly",
                                "fund_id": "12345",
                                "paused": False,
                            }
                        ]
                    }
                }
            }
            r3 = client.put("/api/settings", headers=headers, json=bad_fund_id)
            self.assertEqual(r3.status_code, 422, r3.text)

    def test_put_settings_accepts_and_normalizes_dca_plans(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            payload = {
                "settings": {
                    "strategy": {
                        "dca_plans": [
                            {
                                "id": "  plan_1  ",
                                "name": "  My Plan ",
                                "amount": 12,
                                "schedule": "WEEKLY",
                                "fund_id": None,
                                "paused": False,
                            }
                        ]
                    }
                }
            }
            resp = client.put("/api/settings", headers=headers, json=payload)
            self.assertEqual(resp.status_code, 200, resp.text)
            settings = resp.json().get("settings", {})
            strategy = settings.get("strategy", {})
            plans = strategy.get("dca_plans", [])
            self.assertEqual(len(plans), 1)
            self.assertEqual(str(plans[0].get("id")), "plan_1")
            self.assertEqual(str(plans[0].get("name")), "My Plan")
            self.assertEqual(float(plans[0].get("amount")), 12.0)
            self.assertEqual(str(plans[0].get("schedule")), "weekly")
            self.assertEqual(str(plans[0].get("fund_id")), "")
            self.assertEqual(bool(plans[0].get("paused")), False)


if __name__ == "__main__":
    unittest.main()

