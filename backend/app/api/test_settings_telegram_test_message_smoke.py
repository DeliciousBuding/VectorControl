from __future__ import annotations

import json
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class SettingsTelegramTestMessageSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "tgtst") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_post_telegram_test_message_success_and_no_token_echo(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            bot_token = "DUMMY_TELEGRAM_TOKEN"
            chat_id = "10001"

            cred_resp = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": bot_token, "chat_id": chat_id},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            with patch("app.api.routers.settings.telegram_mod._http_post_json") as mocked_post:
                mocked_post.return_value = (200, {"ok": True, "result": {"message_id": 999}})
                resp = client.post(
                    "/api/settings/notifications/telegram/test_message",
                    headers=headers,
                )

            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), True)
            self.assertEqual(bool(body.get("sent")), True)
            self.assertEqual(str(body.get("provider_message_id")), "999")
            self.assertNotIn(bot_token, json.dumps(body, ensure_ascii=False))

    def test_post_telegram_test_message_unauthorized_is_explainable(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            bot_token = "DUMMY_TELEGRAM_TOKEN"
            chat_id = "10001"

            cred_resp = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": bot_token, "chat_id": chat_id},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            with patch("app.api.routers.settings.telegram_mod._http_post_json") as mocked_post:
                mocked_post.return_value = (200, {"ok": False, "error_code": 401, "description": "Unauthorized"})
                resp = client.post(
                    "/api/settings/notifications/telegram/test_message",
                    headers=headers,
                )

            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), False)
            self.assertEqual(bool(body.get("sent")), False)
            self.assertEqual(str(body.get("error", {}).get("category")), "unauthorized")

    def test_post_telegram_test_message_timeout_is_explainable(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            bot_token = "DUMMY_TELEGRAM_TOKEN"
            chat_id = "10001"

            cred_resp = client.put(
                "/api/settings/notifications/telegram/credential",
                headers=headers,
                json={"bot_token": bot_token, "chat_id": chat_id},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            with patch("app.api.routers.settings.telegram_mod._http_post_json", side_effect=TimeoutError()):
                resp = client.post(
                    "/api/settings/notifications/telegram/test_message",
                    headers=headers,
                )

            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), False)
            self.assertEqual(str(body.get("error", {}).get("category")), "timeout")


if __name__ == "__main__":
    unittest.main()

