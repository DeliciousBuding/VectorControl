from __future__ import annotations

import unittest
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.storage.db import list_audit_logs, upsert_fund_nav_daily


class TransactionsImportSmokeTest(unittest.TestCase):
    def _register_and_token(self, client: TestClient) -> str:
        username = f"tx_{uuid.uuid4().hex[:10]}"
        password = "pass_123456"
        resp = client.post("/api/auth/register", json={"username": username, "password": password})
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertIn("token", body)
        return str(body["token"])

    def _get_user_id(self, client: TestClient, token: str) -> str:
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/auth/me", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        user = resp.json().get("user", {})
        user_id = str(user.get("id") or "")
        self.assertTrue(user_id)
        return user_id

    def test_import_yaml_and_list(self) -> None:
        with TestClient(app) as client:
            token = self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            yaml_text = """
version: "1.0"
default_status: "pending"
source: "smoke-test"
transactions:
  - idempotency_key: "demo-tx-001"
    fund_id: "012345"
    action: "buy"
    occurred_at: "2026-02-07T10:00:00+08:00"
    amount_cny: 1000
    status: "pending"
  - idempotency_key: "demo-tx-002"
    fund_id: "012346"
    action: "redeem"
    occurred_at: "2026-02-07T11:00:00+08:00"
    amount_cny: 800
    status: "confirmed"
    confirmed_at: "2026-02-08T21:00:00+08:00"
  - idempotency_key: "demo-tx-001"
    fund_id: "012345"
    action: "buy"
    occurred_at: "2026-02-07T10:00:00+08:00"
    amount_cny: 1000
    status: "pending"
  - idempotency_key: "demo-tx-003"
    fund_id: "012347"
    action: "sip"
    occurred_at: "2026-02-07T12:30:00+08:00"
    amount_cny: 500
    status: "confirmed"
  - idempotency_key: "demo-tx-004"
    fund_id: "012348"
    action: "buy"
    occurred_at: "2026-02-07T13:00:00+08:00"
    amount_cny: -1
"""
            import_resp = client.post(
                "/api/transactions/import_yaml",
                headers=headers,
                json={"yaml": yaml_text},
            )
            self.assertEqual(import_resp.status_code, 200, import_resp.text)
            import_body = import_resp.json()
            result = import_body.get("result", {})
            self.assertEqual(int(result.get("added", -1)), 3)
            self.assertEqual(int(result.get("skipped", -1)), 1)
            self.assertEqual(int(result.get("conflicted", -1)), 1)
            self.assertEqual(int(result.get("warnings", -1)), 1)
            self.assertIn("data_status", import_body)

            list_resp = client.get("/api/transactions", headers=headers)
            self.assertEqual(list_resp.status_code, 200, list_resp.text)
            list_body = list_resp.json()
            self.assertEqual(int(list_body.get("count", -1)), 3)
            self.assertIn("data_status", list_body)
            self.assertEqual(str(list_body["data_status"].get("status")), "partial")

            pending_resp = client.get("/api/transactions?status=pending", headers=headers)
            self.assertEqual(pending_resp.status_code, 200, pending_resp.text)
            pending_items = pending_resp.json().get("items", [])
            self.assertTrue(len(pending_items) >= 1)
            for item in pending_items:
                self.assertEqual(str(item.get("status")), "pending")

            fund_resp = client.get("/api/transactions?fund_id=012345&status=all", headers=headers)
            self.assertEqual(fund_resp.status_code, 200, fund_resp.text)
            fund_body = fund_resp.json()
            self.assertEqual(int(fund_body.get("count", -1)), 1)
            self.assertEqual(str(fund_body.get("fund_id") or ""), "012345")

            token_other = self._register_and_token(client)
            other_headers = {"Authorization": f"Bearer {token_other}"}
            other_list = client.get("/api/transactions", headers=other_headers)
            self.assertEqual(other_list.status_code, 200, other_list.text)
            self.assertEqual(int(other_list.json().get("count", -1)), 0)

    def test_idempotency_conflict(self) -> None:
        with TestClient(app) as client:
            token = self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            first_yaml = """
transactions:
  - idempotency_key: "demo-idem-conflict"
    fund_id: "022222"
    action: "buy"
    occurred_at: "2026-02-07T14:00:00+08:00"
    amount_cny: 100
"""
            second_yaml = """
transactions:
  - idempotency_key: "demo-idem-conflict"
    fund_id: "022222"
    action: "buy"
    occurred_at: "2026-02-07T14:00:00+08:00"
    amount_cny: 200
"""
            first_resp = client.post("/api/transactions/import_yaml", headers=headers, json={"yaml": first_yaml})
            self.assertEqual(first_resp.status_code, 200, first_resp.text)
            self.assertEqual(int(first_resp.json().get("result", {}).get("added", -1)), 1)

            second_resp = client.post("/api/transactions/import_yaml", headers=headers, json={"yaml": second_yaml})
            self.assertEqual(second_resp.status_code, 200, second_resp.text)
            second_result = second_resp.json().get("result", {})
            self.assertEqual(int(second_result.get("conflicted", -1)), 1)

    def test_api_import_idempotency(self) -> None:
        with TestClient(app) as client:
            token = self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "idempotency_key": "api-idem-001",
                "fund_id": "000001",
                "action": "buy",
                "occurred_at": "2026-02-07T10:00:00+08:00",
                "amount_cny": 1000,
            }

            # First import
            resp1 = client.post("/api/transactions/import", headers=headers, json=payload)
            self.assertEqual(resp1.status_code, 200, resp1.text)
            self.assertEqual(resp1.json().get("result"), "added")

            # Duplicate import (same key, same content)
            resp2 = client.post("/api/transactions/import", headers=headers, json=payload)
            self.assertEqual(resp2.status_code, 200, resp2.text)
            self.assertEqual(resp2.json().get("result"), "skipped")

            # Duplicate key, different content (conflict)
            payload_diff = payload.copy()
            payload_diff["amount_cny"] = 2000
            resp3 = client.post("/api/transactions/import", headers=headers, json=payload_diff)
            self.assertEqual(resp3.status_code, 409, resp3.text)

            # Header idempotency key
            payload_no_key = payload.copy()
            payload_no_key.pop("idempotency_key")
            payload_no_key["fund_id"] = "000002"
            headers_with_key = headers.copy()
            headers_with_key["X-Idempotency-Key"] = "api-idem-header-001"
            resp4 = client.post("/api/transactions/import", headers=headers_with_key, json=payload_no_key)
            self.assertEqual(resp4.status_code, 200, resp4.text)
            self.assertEqual(resp4.json().get("result"), "added")

    def test_sync_pending_transitions_to_confirmed(self) -> None:
        with TestClient(app) as client:
            token = self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            holding_resp = client.post(
                "/api/holdings",
                headers=headers,
                json={
                    "fund_id": "099999",
                    "name": "测试基金099999",
                    "bucket": "tech",
                    "market_value_cny": 1200,
                    "cost_basis_cny": 1000,
                },
            )
            self.assertEqual(holding_resp.status_code, 200, holding_resp.text)

            yaml_text = """
transactions:
  - idempotency_key: "sync-tx-001"
    fund_id: "099999"
    action: "buy"
    occurred_at: "2026-02-07T10:30:00+08:00"
    amount_cny: 1200
    status: "pending"
  - idempotency_key: "sync-tx-002"
    fund_id: "088888"
    action: "buy"
    occurred_at: "2026-02-07T11:00:00+08:00"
    amount_cny: 500
    status: "pending"
"""
            import_resp = client.post("/api/transactions/import_yaml", headers=headers, json={"yaml": yaml_text})
            self.assertEqual(import_resp.status_code, 200, import_resp.text)
            self.assertEqual(int(import_resp.json().get("result", {}).get("added", -1)), 2)

            estimate_before_sync = client.get("/api/estimate?force_refresh=true", headers=headers)
            self.assertEqual(estimate_before_sync.status_code, 200, estimate_before_sync.text)
            before_payload = estimate_before_sync.json()
            self.assertFalse(bool(before_payload.get("cache_hit")))
            before_fund = next(
                (
                    row
                    for row in before_payload.get("funds", [])
                    if str(row.get("fund_id") or "") == "099999"
                ),
                None,
            )
            self.assertIsNotNone(before_fund)
            self.assertEqual(int((before_fund or {}).get("transaction_pending_count", -1)), 1)
            self.assertEqual(int((before_fund or {}).get("transaction_confirmed_count", -1)), 0)

            estimate_cached = client.get("/api/estimate", headers=headers)
            self.assertEqual(estimate_cached.status_code, 200, estimate_cached.text)
            self.assertTrue(bool(estimate_cached.json().get("cache_hit")))

            upsert_fund_nav_daily(
                fund_id="099999",
                trade_date="2026-02-08",
                estimate_nav=1.2,
                unit_nav=1.2,
                asof="2026-02-08T21:00:00+08:00",
                source="test_nav",
                confirm_state="confirmed",
            )

            sync_resp = client.post(
                "/api/transactions/sync_pending",
                headers=headers,
                json={"limit": 100, "fund_id": "099999"},
            )
            self.assertEqual(sync_resp.status_code, 200, sync_resp.text)
            sync_body = sync_resp.json()
            result = sync_body.get("result", {})
            self.assertEqual(int(result.get("total_pending", -1)), 1)
            self.assertEqual(int(result.get("synced", -1)), 1)
            self.assertEqual(int(result.get("errors", -1)), 0)
            self.assertEqual(str(sync_body.get("fund_id") or ""), "099999")
            self.assertIn("data_status", sync_body)

            list_resp = client.get("/api/transactions?status=confirmed", headers=headers)
            self.assertEqual(list_resp.status_code, 200, list_resp.text)
            items = list_resp.json().get("items", [])
            self.assertEqual(len(items), 1)
            self.assertEqual(str(items[0].get("status")), "confirmed")
            self.assertGreater(float(items[0].get("nav") or 0), 0)
            self.assertGreater(float(items[0].get("shares") or 0), 0)

            pending_left = client.get("/api/transactions?status=pending&fund_id=088888", headers=headers)
            self.assertEqual(pending_left.status_code, 200, pending_left.text)
            self.assertEqual(int(pending_left.json().get("count", -1)), 1)

            estimate_after_sync = client.get("/api/estimate", headers=headers)
            self.assertEqual(estimate_after_sync.status_code, 200, estimate_after_sync.text)
            after_payload = estimate_after_sync.json()
            self.assertFalse(bool(after_payload.get("cache_hit")))
            after_fund = next(
                (
                    row
                    for row in after_payload.get("funds", [])
                    if str(row.get("fund_id") or "") == "099999"
                ),
                None,
            )
            self.assertIsNotNone(after_fund)
            self.assertEqual(int((after_fund or {}).get("transaction_pending_count", -1)), 0)
            self.assertEqual(int((after_fund or {}).get("transaction_confirmed_count", -1)), 1)

            report_resp = client.get("/api/report/daily", headers=headers)
            self.assertEqual(report_resp.status_code, 200, report_resp.text)
            report_body = report_resp.json()
            sections = report_body.get("sections", [])
            sync_section = next((item for item in sections if str(item.get("title") or "") == "对账入账"), None)
            self.assertIsNotNone(sync_section)
            sync_lines = [str(line) for line in (sync_section or {}).get("lines", [])]
            self.assertTrue(any("pending 1 笔，confirmed 1 笔" in line for line in sync_lines))
            self.assertTrue(any("sync_pending 累计入账 1 笔" in line for line in sync_lines))

    def test_patch_transaction_and_audit_log(self) -> None:
        with TestClient(app) as client:
            token = self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}
            user_id = self._get_user_id(client, token)

            yaml_text = """
transactions:
  - idempotency_key: "patch-tx-001"
    fund_id: "066666"
    action: "buy"
    occurred_at: "2026-02-07T10:30:00+08:00"
    amount_cny: 960
    status: "pending"
"""
            import_resp = client.post("/api/transactions/import_yaml", headers=headers, json={"yaml": yaml_text})
            self.assertEqual(import_resp.status_code, 200, import_resp.text)
            self.assertEqual(int(import_resp.json().get("result", {}).get("added", -1)), 1)

            list_resp = client.get("/api/transactions?fund_id=066666&status=all", headers=headers)
            self.assertEqual(list_resp.status_code, 200, list_resp.text)
            items = list_resp.json().get("items", [])
            self.assertEqual(len(items), 1)
            tx_id = int(items[0].get("id") or 0)
            self.assertGreater(tx_id, 0)

            patch_resp = client.patch(
                f"/api/transactions/{tx_id}",
                headers=headers,
                json={
                    "status": "confirmed",
                    "nav": 1.2,
                    "confirmed_at": "2026-02-08T21:00:00+08:00",
                    "occurred_at": "2026-02-07T11:35:00+08:00",
                    "note": "手工修正确认时间与净值",
                    "audit_note": "回填漏记确认信息",
                },
            )
            self.assertEqual(patch_resp.status_code, 200, patch_resp.text)
            patch_body = patch_resp.json()
            self.assertTrue(bool(patch_body.get("changed")))
            self.assertTrue(bool(patch_body.get("audit_logged")))
            tx = patch_body.get("transaction", {})
            self.assertEqual(str(tx.get("status")), "confirmed")
            self.assertGreater(float(tx.get("shares") or 0), 0)
            self.assertIn("manual_patch", str(tx.get("source") or ""))
            self.assertEqual(str(patch_body.get("data_status", {}).get("status")), "confirmed")

            audit_resp = client.get(f"/api/transactions/{tx_id}/audit?limit=5", headers=headers)
            self.assertEqual(audit_resp.status_code, 200, audit_resp.text)
            audit_body = audit_resp.json()
            self.assertEqual(int(audit_body.get("transaction_id") or 0), tx_id)
            self.assertGreaterEqual(int(audit_body.get("count") or 0), 1)
            self.assertIn("data_status", audit_body)
            self.assertEqual(str(audit_body.get("data_status", {}).get("status")), "confirmed")

            logs = list_audit_logs(
                user_id=user_id,
                entity_type="fund_transaction",
                entity_id=str(tx_id),
                limit=5,
            )
            self.assertGreaterEqual(len(logs), 1)
            latest = logs[0]
            self.assertEqual(str(latest.get("action")), "patch")
            self.assertEqual(str(latest.get("entity_id")), str(tx_id))
            self.assertIn("fields=", str(latest.get("note") or ""))
            self.assertEqual(str(latest.get("before", {}).get("status")), "pending")
            self.assertEqual(str(latest.get("after", {}).get("status")), "confirmed")


if __name__ == "__main__":
    unittest.main()
