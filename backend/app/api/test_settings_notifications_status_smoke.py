from __future__ import annotations

import json
import re
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class SettingsNotificationsStatusSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "nst") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_get_notifications_status_has_redacted_shape(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            bot_token = "DUMMY_TELEGRAM_TOKEN"
            chat_id = "10001"
            webhook_url = "https://open.feishu.cn/REDACTED"

            # Enable channels via settings.
            put_resp = client.put(
                "/api/settings",
                headers=headers,
                json={"settings": {"notifications": {"feishu": {"enabled": True}, "telegram": {"enabled": True}}}},
            )
            self.assertEqual(put_resp.status_code, 200, put_resp.text)

            # Configure credentials via dedicated endpoints.
            cred_fs = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(cred_fs.status_code, 200, cred_fs.text)

            cred_tg = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": bot_token, "chat_id": chat_id},
            )
            self.assertEqual(cred_tg.status_code, 200, cred_tg.text)

            resp = client.get("/api/settings/notifications/status", headers=headers)
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertIn("user_id", body)
            status = body.get("status", {})
            self.assertIsInstance(status, dict)

            feishu = status.get("feishu", {})
            telegram = status.get("telegram", {})
            email = status.get("email", {})
            self.assertEqual(bool(feishu.get("enabled")), True)
            self.assertEqual(bool(feishu.get("credential_configured")), True)
            self.assertIn("last_test_summary", feishu)
            self.assertIsNone(feishu.get("last_test_summary"))

            self.assertEqual(bool(telegram.get("enabled")), True)
            self.assertEqual(bool(telegram.get("credential_configured")), True)
            self.assertIn("last_test_summary", telegram)
            self.assertIsNone(telegram.get("last_test_summary"))

            self.assertIn("enabled", email)
            self.assertIn("credential_configured", email)
            self.assertIn("last_test_summary", email)

            # Response must not include any credential plaintext.
            dumped = json.dumps(body, ensure_ascii=False)
            self.assertNotIn(bot_token, dumped)
            self.assertNotIn(webhook_url, dumped)

    def test_last_test_summary_persisted_after_test_message(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client, prefix="nst_sum")
            bot_token = "DUMMY_TELEGRAM_TOKEN"
            chat_id = "10001"
            webhook_url = "https://open.feishu.cn/REDACTED"

            put_resp = client.put(
                "/api/settings",
                headers=headers,
                json={"settings": {"notifications": {"feishu": {"enabled": True}, "telegram": {"enabled": True}}}},
            )
            self.assertEqual(put_resp.status_code, 200, put_resp.text)

            cred_fs = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(cred_fs.status_code, 200, cred_fs.text)

            cred_tg = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": bot_token, "chat_id": chat_id},
            )
            self.assertEqual(cred_tg.status_code, 200, cred_tg.text)

            with patch("app.api.routers.settings.feishu_mod._http_post_json") as mocked_post_fs:
                mocked_post_fs.return_value = (200, {"StatusCode": 0, "StatusMessage": "success", "data": {"message_id": "m1"}})
                fs_resp = client.post("/api/settings/notifications/feishu/test_message", headers=headers)
            self.assertEqual(fs_resp.status_code, 200, fs_resp.text)
            fs_body = fs_resp.json()
            self.assertEqual(bool(fs_body.get("ok")), True)

            with patch("app.api.routers.settings.telegram_mod._http_post_json") as mocked_post_tg:
                mocked_post_tg.return_value = (200, {"ok": True, "result": {"message_id": 123}})
                tg_resp = client.post("/api/settings/notifications/telegram/test_message", headers=headers)
            self.assertEqual(tg_resp.status_code, 200, tg_resp.text)
            tg_body = tg_resp.json()
            self.assertEqual(bool(tg_body.get("ok")), True)

            status_resp = client.get("/api/settings/notifications/status", headers=headers)
            self.assertEqual(status_resp.status_code, 200, status_resp.text)
            status = status_resp.json().get("status", {})
            feishu = status.get("feishu", {})
            telegram = status.get("telegram", {})

            fs_sum = feishu.get("last_test_summary")
            tg_sum = telegram.get("last_test_summary")
            self.assertIsInstance(fs_sum, dict)
            self.assertIsInstance(tg_sum, dict)

            iso_pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$"

            self.assertEqual(str(fs_sum.get("trace_id")), str(fs_body.get("trace_id")))
            self.assertTrue(re.match(iso_pattern, str(fs_sum.get("time") or "")))
            self.assertEqual(bool(fs_sum.get("ok")), True)
            self.assertEqual(bool(fs_sum.get("sent")), True)
            self.assertIsNone(fs_sum.get("error_category"))

            self.assertEqual(str(tg_sum.get("trace_id")), str(tg_body.get("trace_id")))
            self.assertTrue(re.match(iso_pattern, str(tg_sum.get("time") or "")))
            self.assertEqual(bool(tg_sum.get("ok")), True)
            self.assertEqual(bool(tg_sum.get("sent")), True)
            self.assertIsNone(tg_sum.get("error_category"))

            dumped = json.dumps(status_resp.json(), ensure_ascii=False)
            self.assertNotIn(bot_token, dumped)
            self.assertNotIn(webhook_url, dumped)

    def test_get_notifications_status_isolated_between_users(self) -> None:
        with TestClient(app) as client:
            headers_a = self._register_headers(client, prefix="nst_a")
            headers_b = self._register_headers(client, prefix="nst_b")

            resp_a = client.get("/api/settings/notifications/status", headers=headers_a)
            resp_b = client.get("/api/settings/notifications/status", headers=headers_b)
            self.assertEqual(resp_a.status_code, 200, resp_a.text)
            self.assertEqual(resp_b.status_code, 200, resp_b.text)

            st_a = resp_a.json().get("status", {})
            st_b = resp_b.json().get("status", {})
            self.assertEqual(bool(st_a.get("feishu", {}).get("credential_configured")), False)
            self.assertEqual(bool(st_b.get("feishu", {}).get("credential_configured")), False)
            self.assertEqual(bool(st_a.get("telegram", {}).get("credential_configured")), False)
            self.assertEqual(bool(st_b.get("telegram", {}).get("credential_configured")), False)


if __name__ == "__main__":
    unittest.main()
