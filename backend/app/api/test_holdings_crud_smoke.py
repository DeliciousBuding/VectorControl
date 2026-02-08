from __future__ import annotations

import unittest
import uuid

from fastapi.testclient import TestClient

from app.main import app


class HoldingsCrudSmokeTest(unittest.TestCase):
    def _register_and_token(self, client: TestClient) -> str:
        username = f"user_{uuid.uuid4().hex[:10]}"
        password = "pass_123456"
        resp = client.post("/api/auth/register", json={"username": username, "password": password})
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertIn("token", body)
        return str(body["token"])

    def test_holdings_crud_and_archive(self) -> None:
        with TestClient(app) as client:
            token = self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            list_resp = client.get("/api/holdings", headers=headers)
            self.assertEqual(list_resp.status_code, 200, list_resp.text)
            list_body = list_resp.json()
            self.assertIn("count", list_body)
            self.assertIn("data_status", list_body)

            create_payload = {
                "fund_id": "000001",
                "name": "测试基金A",
                "bucket": "consumer",
                "market_group": "cn_hk",
                "market_value_cny": 120.5,
                "cost_basis_cny": 110.0,
                "shares": 88.0,
                "start_date": "2026-02-06",
                "tags": ["test"],
            }
            create_resp = client.post("/api/holdings", json=create_payload, headers=headers)
            self.assertEqual(create_resp.status_code, 200, create_resp.text)
            create_body = create_resp.json()
            self.assertEqual(create_body["holding"]["fund_id"], "000001")
            self.assertIn("data_status", create_body)

            patch_resp = client.patch(
                "/api/holdings/000001",
                json={"market_value_cny": 130.0, "tags": ["test", "updated"]},
                headers=headers,
            )
            self.assertEqual(patch_resp.status_code, 200, patch_resp.text)
            patch_body = patch_resp.json()
            self.assertAlmostEqual(float(patch_body["holding"]["market_value_cny"]), 130.0, places=4)
            self.assertIn("data_status", patch_body)

            audit_after_patch = client.get("/api/holdings/000001/audit?limit=20", headers=headers)
            self.assertEqual(audit_after_patch.status_code, 200, audit_after_patch.text)
            audit_body = audit_after_patch.json()
            self.assertIn("items", audit_body)
            self.assertGreaterEqual(len(audit_body["items"]), 2)
            patch_actions = {str(item.get("action")) for item in audit_body["items"]}
            self.assertIn("patch", patch_actions)

            archive_resp = client.post("/api/holdings/000001/archive", headers=headers)
            self.assertEqual(archive_resp.status_code, 200, archive_resp.text)
            archive_body = archive_resp.json()
            self.assertTrue(bool(archive_body["holding"]["archived"]))
            self.assertIn("data_status", archive_body)

            audit_after_archive = client.get("/api/holdings/000001/audit?limit=20", headers=headers)
            self.assertEqual(audit_after_archive.status_code, 200, audit_after_archive.text)
            audit_archive_body = audit_after_archive.json()
            archive_actions = {str(item.get("action")) for item in audit_archive_body.get("items", [])}
            self.assertIn("archive", archive_actions)

            active_list_resp = client.get("/api/holdings", headers=headers)
            self.assertEqual(active_list_resp.status_code, 200, active_list_resp.text)
            ids = {row["fund_id"] for row in active_list_resp.json().get("holdings", [])}
            self.assertNotIn("000001", ids)

            all_list_resp = client.get("/api/holdings?include_archived=true", headers=headers)
            self.assertEqual(all_list_resp.status_code, 200, all_list_resp.text)
            archived_rows = [row for row in all_list_resp.json().get("holdings", []) if row["fund_id"] == "000001"]
            self.assertEqual(len(archived_rows), 1)
            self.assertTrue(bool(archived_rows[0]["archived"]))


if __name__ == "__main__":
    unittest.main()
