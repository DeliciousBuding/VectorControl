from __future__ import annotations

import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class SettingsNetworkBenchmarkCompatSmokeTest(unittest.TestCase):
    def _register_and_headers(self, client: TestClient) -> dict[str, str]:
        username = f"bench_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_settings_and_compat_paths_do_not_return_not_found(self) -> None:
        fake_result = {
            "profile": "cn_fund",
            "timeout_seconds": 2.5,
            "generated_at": "2026-02-08T17:40:00+08:00",
            "targets": [],
            "winner": {"key": "eastmoney"},
        }
        with TestClient(app) as client, patch("app.api.routers.settings.run_network_benchmark", return_value=fake_result):
            headers = self._register_and_headers(client)
            run_payload = {"profile": "cn_fund", "timeout_seconds": 2.5, "persist": True}

            run_paths = [
                "/api/settings/network-benchmark/run",
                "/api/settings/network_benchmark/run",
                "/api/network-benchmark/run",
                "/api/network_benchmark/run",
            ]
            for path in run_paths:
                resp = client.post(path, json=run_payload, headers=headers)
                self.assertEqual(resp.status_code, 200, f"{path}: {resp.text}")
                self.assertEqual(str(resp.json().get("result", {}).get("profile")), "cn_fund")

            latest_paths = [
                "/api/settings/network-benchmark/latest",
                "/api/settings/network_benchmark/latest",
                "/api/network-benchmark/latest",
                "/api/network_benchmark/latest",
            ]
            for path in latest_paths:
                resp = client.get(path, headers=headers)
                self.assertEqual(resp.status_code, 200, f"{path}: {resp.text}")
                self.assertEqual(bool(resp.json().get("available")), True)

    def test_invalid_profile_returns_422(self) -> None:
        with TestClient(app) as client, patch("app.api.routers.settings.run_network_benchmark") as mocked:
            headers = self._register_and_headers(client)
            payload = {"profile": "bad_profile", "timeout_seconds": 2.5, "persist": True}
            for path in [
                "/api/settings/network-benchmark/run",
                "/api/network-benchmark/run",
                "/api/network_benchmark/run",
            ]:
                resp = client.post(path, json=payload, headers=headers)
                self.assertEqual(resp.status_code, 422, f"{path}: {resp.text}")
            mocked.assert_not_called()

    def test_invalid_timeout_returns_422(self) -> None:
        with TestClient(app) as client, patch("app.api.routers.settings.run_network_benchmark") as mocked:
            headers = self._register_and_headers(client)
            payloads = [
                {"profile": "cn_fund", "timeout_seconds": 0.1, "persist": True},
                {"profile": "global", "timeout_seconds": 99, "persist": True},
            ]
            for payload in payloads:
                for path in [
                    "/api/settings/network-benchmark/run",
                    "/api/network-benchmark/run",
                    "/api/network_benchmark/run",
                ]:
                    resp = client.post(path, json=payload, headers=headers)
                    self.assertEqual(resp.status_code, 422, f"{path}: {resp.text}")
            mocked.assert_not_called()


if __name__ == "__main__":
    unittest.main()
