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

    def test_compat_paths_do_not_return_not_found(self) -> None:
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

            run_resp = client.post("/api/network-benchmark/run", json=run_payload, headers=headers)
            self.assertEqual(run_resp.status_code, 200, run_resp.text)
            self.assertEqual(str(run_resp.json().get("result", {}).get("profile")), "cn_fund")

            run_resp_legacy = client.post("/api/network_benchmark/run", json=run_payload, headers=headers)
            self.assertEqual(run_resp_legacy.status_code, 200, run_resp_legacy.text)

            latest_resp = client.get("/api/network-benchmark/latest", headers=headers)
            self.assertEqual(latest_resp.status_code, 200, latest_resp.text)
            self.assertEqual(bool(latest_resp.json().get("available")), True)

            latest_resp_legacy = client.get("/api/network_benchmark/latest", headers=headers)
            self.assertEqual(latest_resp_legacy.status_code, 200, latest_resp_legacy.text)
            self.assertEqual(bool(latest_resp_legacy.json().get("available")), True)


if __name__ == "__main__":
    unittest.main()
