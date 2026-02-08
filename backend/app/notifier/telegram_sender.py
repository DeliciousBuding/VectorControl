from __future__ import annotations

from typing import Any

from .base import NotificationPayload, NotificationResult


class TelegramSender:
    channel = "telegram"

    def send(self, payload: NotificationPayload, settings: dict[str, Any] | None = None) -> NotificationResult:
        notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
        section = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}
        enabled = bool(section.get("enabled", False))
        if not enabled:
            return NotificationResult(
                channel=self.channel,
                success=False,
                skipped=True,
                code="disabled",
                message="telegram 通道已关闭",
            )

        bot_token = str(section.get("bot_token", "")).strip()
        chat_id = str(section.get("chat_id", "")).strip()
        if not bot_token or not chat_id:
            return NotificationResult(
                channel=self.channel,
                success=False,
                skipped=True,
                code="config_missing",
                message="telegram 缺少 bot_token 或 chat_id 配置",
            )

        # 通道占位：当前阶段仅预留统一接口和配置，不发起真实网络请求。
        _ = payload
        return NotificationResult(
            channel=self.channel,
            success=False,
            skipped=True,
            code="reserved",
            message="telegram 通道已预留，默认关闭且未启用实际发送",
        )
