from __future__ import annotations

import unittest
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.notifier import NotificationPayload, build_default_dispatcher


class NotifierChannelsSmokeTest(unittest.TestCase):
    def _register_and_token(self, client: TestClient) -> str:
        username = f"notify_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        return str(resp.json()["token"])

    def test_settings_has_telegram_placeholder_disabled(self) -> None:
        with TestClient(app) as client:
            token = self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}
            resp = client.get("/api/settings", headers=headers)
            self.assertEqual(resp.status_code, 200, resp.text)
            settings = resp.json().get("settings", {})
            notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
            telegram = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}
            self.assertEqual(bool(telegram.get("enabled")), False)
            self.assertIn("bot_token", telegram)
            self.assertIn("chat_id", telegram)
            self.assertIn("parse_mode", telegram)
            self.assertIn("disable_web_page_preview", telegram)

    def test_dispatcher_telegram_disabled_and_unknown_channel(self) -> None:
        dispatcher = build_default_dispatcher()
        self.assertIn("telegram", dispatcher.channels())
        self.assertIn("feishu", dispatcher.channels())

        payload = NotificationPayload(title="日报", content="测试消息")
        telegram_result = dispatcher.send(
            channel="telegram",
            payload=payload,
            settings={"notifications": {"telegram": {"enabled": False}}},
        )
        self.assertEqual(telegram_result.channel, "telegram")
        self.assertEqual(bool(telegram_result.success), False)
        self.assertEqual(bool(telegram_result.skipped), True)
        self.assertEqual(str(telegram_result.code), "disabled")

        unknown_result = dispatcher.send(channel="slack", payload=payload, settings={})
        self.assertEqual(bool(unknown_result.success), False)
        self.assertEqual(bool(unknown_result.skipped), True)
        self.assertEqual(str(unknown_result.code), "channel_not_supported")


if __name__ == "__main__":
    unittest.main()
