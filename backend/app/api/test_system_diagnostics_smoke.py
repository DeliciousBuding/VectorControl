from __future__ import annotations

import copy
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.routers import system as system_router
from app.main import API_TOKEN, REQUEST_ID_HEADER, app

FAKE_RELEASE_METADATA = {
    "current": {
        "version": "v9.9.9",
        "commit": "abc123def456",
        "version_source": "file:VERSION",
        "commit_source": "git:HEAD",
        "branch": "main",
    },
    "online_reference": {
        "version": "v9.9.8",
        "version_source": "env:VC_ONLINE_VERSION",
        "commit": "fff111eee222",
        "commit_source": "git_ref",
        "ref": "origin/main",
        "source": "git_ref",
    },
    "compare_with_online": {
        "status": "ahead",
        "ahead": 2,
        "behind": 0,
        "base_ref": "origin/main",
    },
    "cache": {
        "generated_at": "2026-03-06T10:00:00+08:00",
        "ttl_seconds": 30,
    },
}

FAKE_SNAPSHOT = {
    "estimate_snapshot": {
        "available": True,
        "asof": "2026-03-05T20:00:00+08:00",
        "updated_at": "2026-03-05T20:01:00+08:00",
        "confirm_state": "confirmed",
    },
    "fund_catalog": {"active_count": 12},
    "fund_nav_daily": {
        "record_count": 345,
        "latest": {
            "fund_id": "000001",
            "trade_date": "2026-03-05",
            "asof": "2026-03-05T15:00:00+08:00",
            "source": "snapshot",
            "confirm_state": "confirmed",
            "updated_at": "2026-03-05T15:01:00+08:00",
        },
    },
    "fund_sync_job": {
        "job_id": "job-123",
        "status": "success",
        "finished_at": "2026-03-05T16:00:00+08:00",
    },
    "actions_log": {
        "latest": {
            "date": "2026-03-05",
            "action_key": "rebalance",
            "occurred_at": "2026-03-05T16:30:00+08:00",
        },
    },
    "transactions_sync_pending": {
        "available": True,
        "pending_count_current": 1,
        "confirmed_count_current": 5,
        "note": "sync_pending 对账任务可用（含当前 pending/confirmed 统计）",
    },
}


class SystemDiagnosticsSmokeTest(unittest.TestCase):
    def setUp(self) -> None:
        system_router._clear_release_metadata_cache()

    def tearDown(self) -> None:
        system_router._clear_release_metadata_cache()

    def test_status_and_diagnostics_expose_stable_observability_fields(self) -> None:
        request_id = "diag-smoke-001"
        headers = {
            "Authorization": f"Bearer {API_TOKEN}",
            REQUEST_ID_HEADER: request_id,
        }

        with patch("app.api.routers.system.get_system_status_snapshot", return_value=copy.deepcopy(FAKE_SNAPSHOT)), patch(
            "app.api.routers.system._build_release_metadata_uncached",
            return_value=copy.deepcopy(FAKE_RELEASE_METADATA),
        ):
            with TestClient(app) as client:
                status_resp = client.get("/api/system/status", headers=headers)
                diagnostics_resp = client.get("/api/system/diagnostics", headers=headers)

        self.assertEqual(status_resp.status_code, 200, status_resp.text)
        self.assertEqual(diagnostics_resp.status_code, 200, diagnostics_resp.text)

        status_payload = status_resp.json()
        diagnostics_payload = diagnostics_resp.json()
        structured = diagnostics_payload.get("structured") or {}

        self.assertEqual(status_payload.get("service"), "vectorcontrol-backend")
        self.assertEqual(status_payload.get("schema_version"), "system-observability.v1")
        self.assertEqual(status_payload.get("version"), FAKE_RELEASE_METADATA["current"]["version"])
        self.assertEqual(status_payload.get("commit"), FAKE_RELEASE_METADATA["current"]["commit"])
        self.assertEqual(status_payload.get("request_id"), request_id)
        self.assertIsInstance(status_payload.get("server_elapsed_ms"), int)
        self.assertGreaterEqual(int(status_payload.get("server_elapsed_ms") or 0), 0)
        self.assertEqual(status_payload.get("runtime", {}).get("python_version"), status_payload.get("python_version"))
        self.assertEqual(status_payload.get("runtime", {}).get("platform"), status_payload.get("platform"))
        self.assertEqual(status_payload.get("release", {}).get("current", {}).get("version_source"), "file:VERSION")
        self.assertEqual(status_payload.get("release", {}).get("current", {}).get("commit_source"), "git:HEAD")
        self.assertEqual(status_payload.get("release", {}).get("compare_with_online", {}).get("base_ref"), "origin/main")
        self.assertEqual(status_payload.get("release", {}).get("cache", {}).get("ttl_seconds"), 30)
        self.assertEqual(status_payload.get("snapshot", {}).get("fund_catalog", {}).get("active_count"), 12)
        self.assertIn("db_file", status_payload.get("sqlite", {}))
        self.assertIn("journal_mode", status_payload.get("sqlite", {}))
        self.assertIn("db_dir", status_payload.get("sqlite", {}))
        self.assertIn("derived", status_payload.get("sqlite", {}))
        self.assertIn("lock_risk", status_payload.get("sqlite", {}).get("derived", {}))

        self.assertEqual(diagnostics_payload.get("request_id"), request_id)
        self.assertEqual(diagnostics_payload.get("server_time"), structured.get("server_time"))
        self.assertEqual(diagnostics_payload.get("server_elapsed_ms"), structured.get("server_elapsed_ms"))
        self.assertEqual(structured.get("schema_version"), "system-observability.v1")
        self.assertEqual(structured.get("request_id"), request_id)
        self.assertEqual(structured.get("version"), FAKE_RELEASE_METADATA["current"]["version"])
        self.assertEqual(structured.get("commit"), FAKE_RELEASE_METADATA["current"]["commit"])
        self.assertIsNone(structured.get("snapshot"))
        self.assertIn("sqlite", structured)
        self.assertIn("db_file", structured.get("sqlite", {}))
        self.assertIn("derived", structured.get("sqlite", {}))
        self.assertIn("observations", structured.get("sqlite", {}).get("derived", {}))
        self.assertEqual(structured.get("release", {}).get("current", {}).get("branch"), "main")
        self.assertEqual(structured.get("user", {}).get("is_admin"), True)
        self.assertIn(f"Request ID: {request_id}", str(diagnostics_payload.get("diagnostic_text") or ""))
        self.assertIn("Server Elapsed:", str(diagnostics_payload.get("diagnostic_text") or ""))
        self.assertIn("=== SQLite ===", str(diagnostics_payload.get("diagnostic_text") or ""))
        self.assertIn("Journal Mode:", str(diagnostics_payload.get("diagnostic_text") or ""))
        self.assertIn("Lock Risk:", str(diagnostics_payload.get("diagnostic_text") or ""))
        self.assertIn("Observations:", str(diagnostics_payload.get("diagnostic_text") or ""))

    def test_release_metadata_cache_reuses_result_across_requests(self) -> None:
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        build_calls: list[int] = []

        def fake_release_builder() -> dict:
            build_calls.append(1)
            payload = copy.deepcopy(FAKE_RELEASE_METADATA)
            payload["cache"]["generated_at"] = f"call-{len(build_calls)}"
            return payload

        with patch("app.api.routers.system.get_system_status_snapshot", return_value=copy.deepcopy(FAKE_SNAPSHOT)), patch(
            "app.api.routers.system._build_release_metadata_uncached",
            side_effect=fake_release_builder,
        ) as mocked_builder:
            with TestClient(app) as client:
                status_resp = client.get("/api/system/status", headers=headers)
                diagnostics_resp = client.get("/api/system/diagnostics", headers=headers)

        self.assertEqual(status_resp.status_code, 200, status_resp.text)
        self.assertEqual(diagnostics_resp.status_code, 200, diagnostics_resp.text)
        self.assertEqual(mocked_builder.call_count, 1)
        self.assertEqual(len(build_calls), 1)
        self.assertEqual(status_resp.json().get("release", {}).get("cache", {}).get("generated_at"), "call-1")
        self.assertEqual(
            diagnostics_resp.json().get("structured", {}).get("release", {}).get("cache", {}).get("generated_at"),
            "call-1",
        )


if __name__ == "__main__":
    unittest.main()
