from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app


class HealthzSmokeTest(unittest.TestCase):
    def test_healthz_ok(self) -> None:
        with TestClient(app) as client:
            resp = client.get("/api/healthz")
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(str(body.get("status")), "ok")
            self.assertTrue(str(body.get("service") or ""))

    def test_health_ok(self) -> None:
        with TestClient(app) as client:
            resp = client.get("/api/health")
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(str(body.get("status")), "ok")
            self.assertTrue(str(body.get("service") or ""))


if __name__ == "__main__":
    unittest.main()

