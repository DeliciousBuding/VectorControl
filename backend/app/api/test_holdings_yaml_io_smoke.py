from __future__ import annotations

import uuid
import unittest

from fastapi.testclient import TestClient

from app.main import app


class HoldingsYamlIoSmokeTest(unittest.TestCase):
    def _register(self, client: TestClient) -> str:
        username = f"yaml_{uuid.uuid4().hex[:10]}"
        password = "pass_123456"
        resp = client.post("/api/auth/register", json={"username": username, "password": password})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = resp.json().get("token")
        self.assertTrue(bool(token))
        return str(token)

    def test_default_empty_then_import_and_export(self) -> None:
        with TestClient(app) as client:
            token = self._register(client)
            headers = {"Authorization": f"Bearer {token}"}

            before = client.get("/api/holdings", headers=headers)
            self.assertEqual(before.status_code, 200, before.text)
            self.assertEqual(int(before.json().get("count", -1)), 0)

            imported = client.post("/api/holdings/import_yaml", headers=headers, json={"mode": "if_empty"})
            self.assertEqual(imported.status_code, 200, imported.text)
            result = imported.json().get("result", {})
            self.assertGreater(int(result.get("imported_count", 0)), 0)
            self.assertGreater(int(result.get("total_count", 0)), 0)

            again = client.post("/api/holdings/import_yaml", headers=headers, json={"mode": "if_empty"})
            self.assertEqual(again.status_code, 200, again.text)
            result_again = again.json().get("result", {})
            self.assertEqual(int(result_again.get("imported_count", -1)), 0)
            self.assertGreaterEqual(int(result_again.get("skipped_count", -1)), 0)

            exported = client.get("/api/holdings/export_yaml", headers=headers)
            self.assertEqual(exported.status_code, 200, exported.text)
            body = exported.json()
            self.assertIn("yaml", body)
            self.assertIn("holdings:", str(body.get("yaml", "")))
            holdings = body.get("portfolio", {}).get("holdings", [])
            self.assertEqual(len(holdings), int(result.get("total_count", 0)))

            replaced = client.post("/api/holdings/import_yaml", headers=headers, json={"mode": "replace"})
            self.assertEqual(replaced.status_code, 200, replaced.text)
            self.assertGreater(int(replaced.json().get("result", {}).get("imported_count", 0)), 0)

    def test_import_mode_validation(self) -> None:
        with TestClient(app) as client:
            token = self._register(client)
            headers = {"Authorization": f"Bearer {token}"}
            invalid = client.post("/api/holdings/import_yaml", headers=headers, json={"mode": "invalid-mode"})
            self.assertEqual(invalid.status_code, 400, invalid.text)


if __name__ == "__main__":
    unittest.main()

