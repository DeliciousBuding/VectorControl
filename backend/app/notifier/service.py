from __future__ import annotations

from typing import Any

from .base import NotificationPayload, NotificationResult, NotificationSender
from .feishu_sender import FeishuSender
from .telegram_sender import TelegramSender


class NotificationDispatcher:
    def __init__(self, senders: list[NotificationSender] | None = None) -> None:
        sender_list = senders or []
        self._senders: dict[str, NotificationSender] = {
            str(sender.channel).strip().lower(): sender for sender in sender_list if str(sender.channel).strip()
        }

    def channels(self) -> list[str]:
        return sorted(self._senders.keys())

    def send(self, channel: str, payload: NotificationPayload, settings: dict[str, Any] | None = None) -> NotificationResult:
        channel_key = str(channel or "").strip().lower()
        sender = self._senders.get(channel_key)
        if sender is None:
            return NotificationResult(
                channel=channel_key or "unknown",
                success=False,
                skipped=True,
                code="channel_not_supported",
                message=f"未找到消息通道: {channel_key or 'unknown'}",
            )
        return sender.send(payload=payload, settings=settings or {})


def build_default_dispatcher() -> NotificationDispatcher:
    return NotificationDispatcher(senders=[FeishuSender(), TelegramSender()])
