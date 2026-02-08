from __future__ import annotations

import unittest
from unittest.mock import patch

from app.notifier import NotificationPayload
from app.notifier.telegram_sender import TelegramSender


class NotifierTelegramSenderSmokeTest(unittest.TestCase):
    def test_disabled_skips(self) -> None:
        sender = TelegramSender()
        payload = NotificationPayload(title="Daily", content="Hello")
        result = sender.send(payload=payload, settings={"notifications": {"telegram": {"enabled": False}}})
        self.assertEqual(result.channel, "telegram")
        self.assertEqual(bool(result.success), False)
        self.assertEqual(bool(result.skipped), True)
        self.assertEqual(str(result.code), "disabled")

    def test_missing_config_skips(self) -> None:
        sender = TelegramSender()
        payload = NotificationPayload(title="Daily", content="Hello")
        result = sender.send(payload=payload, settings={"notifications": {"telegram": {"enabled": True}}})
        self.assertEqual(bool(result.success), False)
        self.assertEqual(bool(result.skipped), True)
        self.assertEqual(str(result.code), "config_missing")

    def test_send_success_mocked(self) -> None:
        sender = TelegramSender()
        payload = NotificationPayload(title="Daily", content="Hello", metadata={"k": "v"})
        settings = {
            "notifications": {
                "telegram": {
                    "enabled": True,
                    "bot_token": "bot_token_example",
                    "chat_id": "123456",
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                    "timeout_seconds": 1,
                    "retry_times": 0,
                }
            }
        }
        with patch("app.notifier.telegram_sender._http_post_json", return_value=(200, {"ok": True, "result": {"message_id": 7}})):
            result = sender.send(payload=payload, settings=settings)
        self.assertEqual(bool(result.success), True)
        self.assertEqual(bool(result.skipped), False)
        self.assertEqual(str(result.code), "ok")
        self.assertEqual(str(result.provider_message_id), "7")

    def test_send_failure_retries_and_fails(self) -> None:
        sender = TelegramSender()
        payload = NotificationPayload(title="Daily", content="Hello")
        settings = {
            "notifications": {
                "telegram": {
                    "enabled": True,
                    "bot_token": "bot_token_example",
                    "chat_id": "123456",
                    "retry_times": 1,
                    "timeout_seconds": 1,
                }
            }
        }

        # Always fail.
        with patch("app.notifier.telegram_sender._http_post_json", return_value=(500, {"ok": False, "description": "fail"})):
            result = sender.send(payload=payload, settings=settings)
        self.assertEqual(bool(result.success), False)
        self.assertEqual(bool(result.skipped), False)
        self.assertEqual(str(result.code), "send_failed")


if __name__ == "__main__":
    unittest.main()

