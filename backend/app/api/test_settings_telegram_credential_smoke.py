from __future__ import annotations

import json
import unittest
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.storage.db import get_user_settings


class SettingsTelegramCredentialSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "tgcred") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_put_telegram_credential_updates_without_plaintext_echo(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            bot_token = "bot_token_example_secret"
            chat_id = "123456"

            resp = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": bot_token, "chat_id": chat_id},
            )
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("updated")), True)
            self.assertEqual(str(body.get("credential", {}).get("channel")), "telegram")
            self.assertEqual(bool(body.get("credential", {}).get("configured")), True)
            self.assertNotIn(bot_token, json.dumps(body, ensure_ascii=False))

            user_id = str(client.get("/api/auth/me", headers=headers).json().get("user", {}).get("id") or "")
            stored = get_user_settings(user_id)
            self.assertEqual(str(stored.get("notifications", {}).get("telegram", {}).get("bot_token", "")), bot_token)
            self.assertEqual(str(stored.get("notifications", {}).get("telegram", {}).get("chat_id", "")), chat_id)

            # GET /api/settings should not leak plaintext credentials.
            settings_resp = client.get("/api/settings", headers=headers)
            self.assertEqual(settings_resp.status_code, 200, settings_resp.text)
            saved = settings_resp.json().get("settings", {}).get("notifications", {}).get("telegram", {})
            self.assertEqual(str(saved.get("bot_token", "")), "<REDACTED>")
            self.assertEqual(str(saved.get("chat_id", "")), chat_id)

            other_headers = self._register_headers(client, prefix="tgcred_other")
            other_settings = client.get("/api/settings", headers=other_headers).json()
            self.assertEqual(
                str(other_settings.get("settings", {}).get("notifications", {}).get("telegram", {}).get("bot_token", "")),
                "",
            )

    def test_put_telegram_credential_validates_non_empty(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            resp = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": "   ", "chat_id": "1"},
            )
            self.assertEqual(resp.status_code, 422, resp.text)

    def test_put_telegram_credential_keeps_non_secret_fields(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)

            seed_payload = {
                "settings": {
                    "notifications": {
                        "telegram": {
                            "enabled": True,
                            "parse_mode": "Markdown",
                            "disable_web_page_preview": False,
                            "timeout_seconds": 9,
                            "retry_times": 4,
                        }
                    }
                }
            }
            seed_resp = client.put("/api/settings", headers=headers, json=seed_payload)
            self.assertEqual(seed_resp.status_code, 200, seed_resp.text)

            bot_token = "bot_token_credential_only"
            chat_id = "999"
            cred_resp = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": bot_token, "chat_id": chat_id},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            settings_resp = client.get("/api/settings", headers=headers)
            self.assertEqual(settings_resp.status_code, 200, settings_resp.text)
            telegram = settings_resp.json().get("settings", {}).get("notifications", {}).get("telegram", {})
            self.assertEqual(bool(telegram.get("enabled")), True)
            self.assertEqual(str(telegram.get("parse_mode", "")), "Markdown")
            self.assertEqual(bool(telegram.get("disable_web_page_preview")), False)
            self.assertEqual(int(telegram.get("timeout_seconds", 0)), 9)
            self.assertEqual(int(telegram.get("retry_times", 0)), 4)
            self.assertEqual(str(telegram.get("bot_token", "")), "<REDACTED>")
            self.assertEqual(str(telegram.get("chat_id", "")), chat_id)

            user_id = str(client.get("/api/auth/me", headers=headers).json().get("user", {}).get("id") or "")
            stored = get_user_settings(user_id)
            self.assertEqual(str(stored.get("notifications", {}).get("telegram", {}).get("bot_token", "")), bot_token)
            self.assertEqual(str(stored.get("notifications", {}).get("telegram", {}).get("chat_id", "")), chat_id)

    def test_put_settings_with_redacted_token_does_not_overwrite(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            user_id = str(client.get("/api/auth/me", headers=headers).json().get("user", {}).get("id") or "")

            original = "bot_token_original_secret"
            chat_id = "777"
            cred_resp = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": original, "chat_id": chat_id},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            put_resp = client.put(
                "/api/settings",
                headers=headers,
                json={
                    "settings": {
                        "notifications": {
                            "telegram": {
                                "bot_token": "<REDACTED>",
                                "enabled": True,
                            }
                        }
                    }
                },
            )
            self.assertEqual(put_resp.status_code, 200, put_resp.text)
            self.assertEqual(
                str(
                    put_resp.json()
                    .get("settings", {})
                    .get("notifications", {})
                    .get("telegram", {})
                    .get("bot_token", "")
                ),
                "<REDACTED>",
            )

            stored = get_user_settings(user_id)
            self.assertEqual(str(stored.get("notifications", {}).get("telegram", {}).get("bot_token", "")), original)
            self.assertEqual(str(stored.get("notifications", {}).get("telegram", {}).get("chat_id", "")), chat_id)


if __name__ == "__main__":
    unittest.main()
