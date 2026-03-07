from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import SERVICE_NAME, app, create_app
from app.storage.db import connect


class AppAssemblySmokeTest(unittest.TestCase):
    def test_create_app_registers_key_routes_once(self) -> None:
        fresh_app = create_app()

        route_methods: dict[tuple[str, str], int] = {}
        for route in fresh_app.routes:
            path = getattr(route, "path", None)
            methods = getattr(route, "methods", None) or set()
            if not path:
                continue
            for method in methods:
                route_methods[(path, method)] = route_methods.get((path, method), 0) + 1

        self.assertEqual(route_methods.get(("/api/health", "GET")), 1)
        self.assertEqual(route_methods.get(("/api/healthz", "GET")), 1)
        self.assertEqual(route_methods.get(("/api/charts/returns_history", "GET")), 1)
        self.assertEqual(route_methods.get(("/api/benchmark/list", "GET")), 1)

    def test_create_app_startup_initializes_state(self) -> None:
        fresh_app = create_app()
        fake_config = {"funds": [], "portfolio": {"holdings": []}, "policy": {}}

        with patch("app.main.initialize_app_state") as mock_initialize:
            with TestClient(fresh_app):
                pass

        mock_initialize.assert_called_once_with(fresh_app)

    def test_estimate_snapshot_indexes_initialized_in_init_db(self) -> None:
        with TestClient(app):
            with connect() as conn:
                rows = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='estimate_snapshot'"
                ).fetchall()
            names = {str(row["name"]) for row in rows if row["name"]}

        self.assertIn("idx_estimate_snapshot_user_id", names)
        self.assertIn("idx_estimate_snapshot_user_asof", names)

    def test_existing_app_metadata_is_unchanged(self) -> None:
        self.assertEqual(app.title, SERVICE_NAME)


if __name__ == "__main__":
    unittest.main()
