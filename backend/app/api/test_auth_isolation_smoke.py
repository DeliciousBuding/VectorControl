from __future__ import annotations

import uuid
from datetime import datetime
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.rate_limit import reset_auth_rate_limiter
from app.main import API_TOKEN, app


class AuthIsolationSmokeTest(unittest.TestCase):
    def setUp(self) -> None:
        reset_auth_rate_limiter()

    def _register(self, client: TestClient, username: str, password: str) -> str:
        resp = client.post("/api/auth/register", json={"username": username, "password": password})
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertIn("token", body)
        return str(body["token"])

    def test_auth_guard_401(self) -> None:
        with TestClient(app) as client:
            missing_resp = client.get("/api/config")
            self.assertEqual(missing_resp.status_code, 401, missing_resp.text)

            invalid_resp = client.get("/api/config", headers={"Authorization": "Bearer invalid-token"})
            self.assertEqual(invalid_resp.status_code, 401, invalid_resp.text)

    def test_system_status_contract(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token = self._register(client, f"sys_{suffix}", "pass_123456")
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.get("/api/system/status", headers=headers)
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()

            self.assertEqual(body.get("service"), "vectorcontrol-backend")
            self.assertIn("version", body)
            self.assertIn("commit", body)
            self.assertIn("server_time", body)
            self.assertIn("python_version", body)
            self.assertIn("release", body)

            release = body.get("release", {})
            self.assertIn("current", release)
            self.assertIn("online_reference", release)
            self.assertIn("compare_with_online", release)
            self.assertIn("status", release.get("compare_with_online", {}))
            self.assertIn("ahead", release.get("compare_with_online", {}))
            self.assertIn("behind", release.get("compare_with_online", {}))

            user = body.get("user", {})
            self.assertEqual(bool(user.get("is_admin")), False)
            self.assertTrue(str(user.get("user_id", "")).strip())
            self.assertEqual(str(user.get("holdings_scope_user_id", "")), str(user.get("user_id", "")))

            snapshot = body.get("snapshot", {})
            self.assertIn("estimate_snapshot", snapshot)
            self.assertIn("fund_catalog", snapshot)
            self.assertIn("fund_nav_daily", snapshot)
            self.assertIn("fund_sync_job", snapshot)
            self.assertIn("actions_log", snapshot)
            self.assertIn("transactions_sync_pending", snapshot)
            sync_pending = snapshot.get("transactions_sync_pending", {})
            self.assertIn("pending_count_current", sync_pending)
            self.assertIn("confirmed_count_current", sync_pending)
            self.assertIn("synced_total", sync_pending)
            self.assertIn("synced_fund_count", sync_pending)
            self.assertIn("latest_confirmed_at", sync_pending)

    def test_user_data_isolation(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token_a = self._register(client, f"iso_a_{suffix}", "pass_123456")
            token_b = self._register(client, f"iso_b_{suffix}", "pass_123456")

            headers_a = {"Authorization": f"Bearer {token_a}"}
            headers_b = {"Authorization": f"Bearer {token_b}"}

            unique_fund_id = f"U{uuid.uuid4().hex[:5].upper()}"
            create_resp = client.post(
                "/api/holdings",
                headers=headers_a,
                json={
                    "fund_id": unique_fund_id,
                    "name": "隔离验证基金",
                    "bucket": "consumer",
                    "market_group": "cn_hk",
                    "market_value_cny": 88.0,
                    "cost_basis_cny": 80.0,
                },
            )
            self.assertEqual(create_resp.status_code, 200, create_resp.text)

            list_a = client.get("/api/holdings", headers=headers_a).json().get("holdings", [])
            list_b = client.get("/api/holdings", headers=headers_b).json().get("holdings", [])
            ids_a = {row["fund_id"] for row in list_a}
            ids_b = {row["fund_id"] for row in list_b}
            self.assertIn(unique_fund_id, ids_a)
            self.assertNotIn(unique_fund_id, ids_b)

            patch_b = client.patch(
                f"/api/holdings/{unique_fund_id}",
                headers=headers_b,
                json={"market_value_cny": 99.0},
            )
            self.assertEqual(patch_b.status_code, 400, patch_b.text)

            today = datetime.now().astimezone().date().isoformat()
            action_a = client.post(
                "/api/actions",
                headers=headers_a,
                json={
                    "date": today,
                    "occurred_at": f"{today}T09:30:00+08:00",
                    "action_key": "isolation_action",
                    "amount": 10,
                    "done": True,
                },
            )
            self.assertEqual(action_a.status_code, 200, action_a.text)

            actions_a_resp = client.get(f"/api/actions?date={today}", headers=headers_a)
            actions_b_resp = client.get(f"/api/actions?date={today}", headers=headers_b)
            self.assertEqual(actions_a_resp.status_code, 200, actions_a_resp.text)
            self.assertEqual(actions_b_resp.status_code, 200, actions_b_resp.text)
            self.assertIn("data_status", actions_a_resp.json())
            self.assertIn("data_status", actions_b_resp.json())
            actions_a = actions_a_resp.json().get("actions", [])
            actions_b = actions_b_resp.json().get("actions", [])
            keys_a = {row["action_key"] for row in actions_a}
            keys_b = {row["action_key"] for row in actions_b}
            self.assertIn("isolation_action", keys_a)
            self.assertNotIn("isolation_action", keys_b)
            target_row = next((row for row in actions_a if row.get("action_key") == "isolation_action"), None)
            self.assertIsNotNone(target_row)
            self.assertTrue(str(target_row.get("occurred_at", "")).strip())

    def test_login_rate_limit(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            username = f"limit_{suffix}"
            password = "pass_123456"
            self._register(client, username, password)

            status_codes: list[int] = []
            for _ in range(6):
                resp = client.post("/api/auth/login", json={"username": username, "password": "wrong-password"})
                status_codes.append(resp.status_code)

            self.assertEqual(status_codes[:5], [401, 401, 401, 401, 401])
            self.assertEqual(status_codes[5], 429)

            blocked_resp = client.post("/api/auth/login", json={"username": username, "password": "wrong-password"})
            self.assertEqual(blocked_resp.status_code, 429, blocked_resp.text)
            self.assertIn("Retry-After", blocked_resp.headers)

    def test_estimate_has_coverage_and_yesterday_source(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token = self._register(client, f"cov_{suffix}", "pass_123456")
            headers = {"Authorization": f"Bearer {token}"}

            estimate_resp = client.get("/api/estimate", headers=headers)
            self.assertEqual(estimate_resp.status_code, 200, estimate_resp.text)
            body = estimate_resp.json()
            self.assertIn("data_status", body)
            self.assertIn("status", body.get("data_status", {}))
            self.assertIn("asof", body.get("data_status", {}))
            self.assertIn("note", body.get("data_status", {}))

            coverage = body.get("coverage", {})
            self.assertIn("total", coverage)
            self.assertIn("ok", coverage)
            self.assertIn("failed", coverage)
            self.assertEqual(int(coverage["total"]), int(coverage["ok"]) + int(coverage["failed"]))
            self.assertIn("as_of", body)
            self.assertIn("updated_at", body)
            self.assertIn("confirm_state", body)

            funds = body.get("funds", [])
            self.assertTrue(isinstance(funds, list))
            for row in funds:
                self.assertIn("yesterday_profit_source", row)
                self.assertIn("as_of", row)
                self.assertIn("updated_at", row)
                self.assertIn("confirm_state", row)

    def test_fund_search_contract(self) -> None:
        with TestClient(app) as client:
            suffix = uuid.uuid4().hex[:8]
            token = self._register(client, f"fund_{suffix}", "pass_123456")
            headers = {"Authorization": f"Bearer {token}"}

            suggest_resp = client.get("/api/funds/suggest?keyword=&limit=5", headers=headers)
            self.assertEqual(suggest_resp.status_code, 200, suggest_resp.text)
            suggest_body = suggest_resp.json()
            suggest_items = suggest_body.get("items")
            self.assertTrue(isinstance(suggest_items, list))
            self.assertIn("data_status", suggest_body)

            search_resp = client.get("/api/funds/search?q=&limit=5", headers=headers)
            self.assertEqual(search_resp.status_code, 200, search_resp.text)
            search_body = search_resp.json()
            search_items = search_body.get("items")
            self.assertTrue(isinstance(search_items, list))
            self.assertIn("data_status", search_body)

            if search_items:
                target = search_items[0]
                fund_id = target.get("fund_id")
                self.assertIn("market_group", target)
                self.assertIn("fund_type", target)
                self.assertIn("bucket", target)
                self.assertIn("tags", target)
                self.assertIn("aliases", target)

                detail_resp = client.get(f"/api/funds/{fund_id}", headers=headers)
                self.assertEqual(detail_resp.status_code, 200, detail_resp.text)
                detail_json = detail_resp.json()
                self.assertIn("data_status", detail_json)
                detail_body = detail_json.get("fund", {})
                self.assertEqual(detail_body.get("fund_id"), fund_id)
                self.assertIn("market_group", detail_body)
                self.assertIn("fund_type", detail_body)
                self.assertIn("bucket", detail_body)
                self.assertIn("tags", detail_body)
                self.assertIn("aliases", detail_body)
                self.assertIn("source", detail_body)

                latest_nav_resp = client.get(f"/api/funds/{fund_id}/nav/latest", headers=headers)
                self.assertEqual(latest_nav_resp.status_code, 200, latest_nav_resp.text)
                latest_nav_body = latest_nav_resp.json()
                self.assertIn("available", latest_nav_body)
                self.assertIn("latest", latest_nav_body)
                self.assertIn("data_status", latest_nav_body)

                history_nav_resp = client.get(f"/api/funds/{fund_id}/nav/history?limit=10", headers=headers)
                self.assertEqual(history_nav_resp.status_code, 200, history_nav_resp.text)
                history_nav_body = history_nav_resp.json()
                self.assertIn("items", history_nav_body)
                self.assertTrue(isinstance(history_nav_body.get("items"), list))
                self.assertIn("data_status", history_nav_body)

            alias_search_resp = client.get("/api/funds/search?q=纳指&limit=10", headers=headers)
            self.assertEqual(alias_search_resp.status_code, 200, alias_search_resp.text)
            alias_search_body = alias_search_resp.json()
            alias_items = alias_search_body.get("items", [])
            self.assertTrue(isinstance(alias_items, list))
            self.assertGreater(len(alias_items), 0)
            self.assertTrue(
                any(
                    "纳指" in [str(alias) for alias in item.get("alias_hits", [])]
                    for item in alias_items
                    if isinstance(item, dict)
                )
            )

    def test_fund_sync_admin_job_contract(self) -> None:
        with TestClient(app) as client:
            headers = {"Authorization": f"Bearer {API_TOKEN}"}
            with patch(
                "app.api.routers.funds.EastMoneyQuoteProvider.get_fund_quote",
                return_value={
                    "estimate_nav": 1.2345,
                    "nav": 1.22,
                    "asof": "2026-02-07T10:30:00+08:00",
                    "source": "mock_provider",
                },
            ):
                sync_resp = client.post(
                    "/api/funds/sync",
                    headers=headers,
                    json={"fund_ids": ["013491", "016453"], "limit": 10},
                )
            self.assertEqual(sync_resp.status_code, 200, sync_resp.text)
            sync_body = sync_resp.json()
            self.assertIn("data_status", sync_body)
            job = sync_body.get("job", {})
            self.assertEqual(job.get("status"), "done")
            self.assertEqual(int(job.get("total_count", -1)), 2)
            self.assertGreaterEqual(int(job.get("log_count", 0)), 2)
            self.assertTrue(isinstance(job.get("recent_logs", []), list))

            job_id = str(job.get("job_id", ""))
            self.assertTrue(job_id)
            job_resp = client.get(f"/api/funds/sync/jobs/{job_id}", headers=headers)
            self.assertEqual(job_resp.status_code, 200, job_resp.text)
            self.assertIn("data_status", job_resp.json())
            fetched_job = job_resp.json().get("job", {})
            self.assertGreaterEqual(int(fetched_job.get("log_count", 0)), 2)
            self.assertTrue(isinstance(fetched_job.get("recent_logs", []), list))

            latest_resp = client.get("/api/funds/013491/nav/latest", headers=headers)
            self.assertEqual(latest_resp.status_code, 200, latest_resp.text)
            latest_payload = latest_resp.json().get("latest", {})
            self.assertEqual(str(latest_payload.get("source")), "mock_provider")

    def test_fund_sync_retry_and_failure_isolation(self) -> None:
        with TestClient(app) as client:
            headers = {"Authorization": f"Bearer {API_TOKEN}"}
            call_stats: dict[str, int] = {}

            def fake_get_fund_quote(*args: object) -> dict | None:
                fund_id = str(args[-1] if args else "")
                current = int(call_stats.get(fund_id, 0)) + 1
                call_stats[fund_id] = current
                if fund_id == "013491":
                    if current == 1:
                        raise RuntimeError("temporary")
                    return {
                        "estimate_nav": 1.3012,
                        "nav": 1.29,
                        "asof": "2026-02-08T10:35:00+08:00",
                        "source": "retry_mock_provider",
                    }
                return None

            with patch(
                "app.api.routers.funds.EastMoneyQuoteProvider.get_fund_quote",
                side_effect=fake_get_fund_quote,
            ):
                sync_resp = client.post(
                    "/api/funds/sync",
                    headers=headers,
                    json={"fund_ids": ["013491", "016453"], "limit": 10},
                )

            self.assertEqual(sync_resp.status_code, 200, sync_resp.text)
            sync_body = sync_resp.json()
            job = sync_body.get("job", {})
            self.assertEqual(int(job.get("total_count", -1)), 2)
            self.assertEqual(int(job.get("success_count", -1)), 1)
            self.assertEqual(int(job.get("failed_count", -1)), 1)
            self.assertIn("016453", str(job.get("error_summary", "")))
            self.assertEqual(int(call_stats.get("013491", 0)), 2)
            self.assertEqual(int(call_stats.get("016453", 0)), 3)

            logs = [row for row in job.get("recent_logs", []) if isinstance(row, dict)]
            success_log = next((row for row in logs if row.get("fund_id") == "013491"), None)
            failed_log = next((row for row in logs if row.get("fund_id") == "016453"), None)
            self.assertIsNotNone(success_log)
            self.assertIsNotNone(failed_log)
            self.assertEqual(success_log.get("status"), "success")
            self.assertEqual(int(success_log.get("attempts", 0)), 2)
            self.assertEqual(failed_log.get("status"), "failed")
            self.assertEqual(int(failed_log.get("attempts", 0)), 3)


if __name__ == "__main__":
    unittest.main()
