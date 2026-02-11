from __future__ import annotations

import unittest
from unittest.mock import patch

from app.notifier import NotificationPayload
from app.notifier.feishu_sender import FeishuSender


class FeishuSenderSmokeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.sender = FeishuSender()
        self.payload = NotificationPayload(
            title="daily_report",
            content="profit +1.28%",
            metadata={"account": "alpha", "level": "normal"},
        )

    def test_disabled_channel_returns_skipped(self) -> None:
        result = self.sender.send(
            payload=self.payload,
            settings={"notifications": {"feishu": {"enabled": False}}},
        )
        self.assertEqual(result.channel, "feishu")
        self.assertEqual(result.ok, False)
        self.assertEqual(result.sent, False)
        self.assertIn("disabled", result.error)

    def test_missing_webhook_returns_skipped(self) -> None:
        result = self.sender.send(
            payload=self.payload,
            settings={"notifications": {"feishu": {"enabled": True, "webhook_url": ""}}},
        )
        self.assertEqual(result.channel, "feishu")
        self.assertEqual(result.ok, False)
        self.assertEqual(result.sent, False)
        self.assertIn("missing", result.error)

    def test_retry_and_success(self) -> None:
        with patch("app.notifier.feishu_sender._http_post_json") as mocked_post:
            mocked_post.side_effect = [
                RuntimeError("timeout"),
                (200, {"StatusCode": 0, "StatusMessage": "success", "data": {"message_id": "msg-001"}}),
            ]
            result = self.sender.send(
                payload=self.payload,
                settings={
                    "notifications": {
                        "feishu": {
                            "enabled": True,
                            "webhook_url": "https://open.feishu.cn/webhook",
                            "retry_times": 2,
                            "timeout_seconds": 1.5,
                            "template": "title_content_metadata",
                        }
                    }
                },
            )

        self.assertEqual(mocked_post.call_count, 2)
        self.assertEqual(result.ok, True)
        self.assertEqual(result.sent, True)
        self.assertEqual(result.trace_id, "msg-001")
        self.assertEqual(result.attempts, 2)

    def test_exhaust_retries_returns_failed(self) -> None:
        with patch("app.notifier.feishu_sender._http_post_json") as mocked_post:
            mocked_post.side_effect = RuntimeError("network down")
            result = self.sender.send(
                payload=self.payload,
                settings={
                    "notifications": {
                        "feishu": {
                            "enabled": True,
                            "webhook_url": "https://open.feishu.cn/webhook",
                            "retry_times": 1,
                        }
                    }
                },
            )

        self.assertEqual(mocked_post.call_count, 2)
        self.assertEqual(result.ok, False)
        self.assertEqual(result.sent, False)
        self.assertIn("feishu send failed", result.error)
        self.assertEqual(result.attempts, 2)

    def test_content_only_template(self) -> None:
        with patch("app.notifier.feishu_sender._http_post_json", return_value=(200, {"StatusCode": 0})) as mocked_post:
            result = self.sender.send(
                payload=self.payload,
                settings={
                    "notifications": {
                        "feishu": {
                            "enabled": True,
                            "webhook_url": "https://open.feishu.cn/webhook",
                            "template": "content_only",
                        }
                    }
                },
            )

        self.assertEqual(result.ok, True)
        sent_payload = mocked_post.call_args.args[1]
        sent_text = sent_payload["content"]["text"]
        self.assertIn("profit +1.28%", sent_text)
        self.assertNotIn("account:", sent_text)


if __name__ == "__main__":
    unittest.main()
