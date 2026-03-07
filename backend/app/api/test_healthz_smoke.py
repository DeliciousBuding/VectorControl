from __future__ import annotations

import unittest

from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.main import SERVICE_NAME, app


class HealthzSmokeTest(unittest.TestCase):
    def test_healthz_ok_and_startup_loaded(self) -> None:
        with TestClient(app) as client:
            resp = client.get("/api/healthz")
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(str(body.get("status")), "ok")
            self.assertEqual(str(body.get("service") or ""), SERVICE_NAME)
            self.assertTrue(hasattr(app.state, "config"))
            self.assertTrue(str(resp.headers.get("X-Request-ID", "")).strip())

    def test_health_ok(self) -> None:
        with TestClient(app) as client:
            resp = client.get("/api/health")
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), True)
            self.assertEqual(str(body.get("service") or ""), SERVICE_NAME)

    def test_关键启动路由仅装配一次(self) -> None:
        def route_count(path: str, method: str) -> int:
            target_method = method.upper()
            return sum(
                1
                for route in app.routes
                if isinstance(route, APIRoute)
                and route.path == path
                and target_method in (route.methods or set())
            )

        self.assertEqual(route_count("/api/charts/returns_history", "GET"), 1)
        self.assertEqual(route_count("/api/benchmark/list", "GET"), 1)


if __name__ == "__main__":
    unittest.main()

