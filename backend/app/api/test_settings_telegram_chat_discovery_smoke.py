from __future__ import annotations

import os
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.storage.db import get_user_settings


class SettingsTelegramChatDiscoverySmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "tgdisc") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_issue_secret_requires_saved_bot_token(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            resp = client.post(
                "/api/settings/notifications/telegram/discovery/secret",
                headers=headers,
                json={},
            )
            self.assertEqual(resp.status_code, 422, resp.text)

    def test_issue_secret_and_inbound_bind_chat_id(self) -> None:
        with patch.dict(os.environ, {"VC_SCHEME": "https", "VC_DOMAIN": "vectorcontrol.test"}, clear=False):
            with TestClient(app) as client:
                headers = self._register_headers(client)

                cred_resp = client.put(
                    "/api/settings/notifications/telegram/credential",
                    headers=headers,
                    json={"bot_token": "bot_token_discovery", "chat_id": ""},
                )
                self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

                secret_resp = client.post(
                    "/api/settings/notifications/telegram/discovery/secret",
                    headers=headers,
                    json={},
                )
                self.assertEqual(secret_resp.status_code, 200, secret_resp.text)
                discovery = secret_resp.json().get("discovery", {})
                secret = str(discovery.get("secret", ""))
                webhook_path = str(discovery.get("webhook_path", ""))
                self.assertTrue(secret)
                self.assertEqual(
                    str(discovery.get("webhook_url", "")),
                    f"https://vectorcontrol.test{webhook_path}",
                )

                settings_resp = client.get("/api/settings", headers=headers)
                self.assertEqual(settings_resp.status_code, 200, settings_resp.text)
                telegram = settings_resp.json().get("settings", {}).get("notifications", {}).get("telegram", {})
                self.assertEqual(str(telegram.get("chat_auto_discovery_secret", "")), "<REDACTED>")

                inbound_resp = client.post(
                    webhook_path,
                    json={
                        "message": {
                            "chat": {
                                "id": -1001234567890,
                                "type": "supergroup",
                                "title": "VC Alert Group",
                            },
                            "text": "/start",
                        }
                    },
                )
                self.assertEqual(inbound_resp.status_code, 200, inbound_resp.text)
                self.assertEqual(bool(inbound_resp.json().get("updated")), True)

                user_id = str(client.get("/api/auth/me", headers=headers).json().get("user", {}).get("id") or "")
                stored = get_user_settings(user_id)
                telegram_settings = stored.get("notifications", {}).get("telegram", {})
                self.assertEqual(str(telegram_settings.get("chat_id", "")), "-1001234567890")
                self.assertEqual(str(telegram_settings.get("chat_auto_discovery_last_chat_id", "")), "-1001234567890")
                self.assertEqual(str(telegram_settings.get("chat_auto_discovery_last_chat_type", "")), "supergroup")
                self.assertEqual(str(telegram_settings.get("chat_auto_discovery_last_chat_title", "")), "VC Alert Group")
                self.assertTrue(str(telegram_settings.get("chat_auto_discovery_last_seen_at", "")))

                status_resp = client.get("/api/settings/notifications/status", headers=headers)
                self.assertEqual(status_resp.status_code, 200, status_resp.text)
                telegram_status = status_resp.json().get("status", {}).get("telegram", {})
                self.assertEqual(bool(telegram_status.get("bot_token_configured")), True)
                self.assertEqual(bool(telegram_status.get("credential_configured")), True)
                discovery_status = telegram_status.get("discovery", {})
                self.assertEqual(bool(discovery_status.get("secret_configured")), True)
                self.assertEqual(str(discovery_status.get("last_chat_id", "")), "-1001234567890")
                self.assertEqual(str(discovery_status.get("last_chat_title", "")), "VC Alert Group")
                self.assertTrue(str(discovery_status.get("last_seen_at", "")))
                self.assertIn(secret, webhook_path)

    def test_inbound_rejects_invalid_secret(self) -> None:
        with TestClient(app) as client:
            resp = client.post(
                "/api/settings/notifications/telegram/inbound/invalid-secret",
                json={"message": {"chat": {"id": 1}}},
            )
            self.assertEqual(resp.status_code, 404, resp.text)


if __name__ == "__main__":
    unittest.main()
