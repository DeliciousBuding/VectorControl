from __future__ import annotations

from typing import Any

from .base import NotificationPayload, NotificationResult


class FeishuSender:
    channel = "feishu"

    def send(self, payload: NotificationPayload, settings: dict[str, Any] | None = None) -> NotificationResult:
        notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
        section = notifications.get("feishu", {}) if isinstance(notifications, dict) else {}
        enabled = bool(section.get("enabled", False))
        if not enabled:
            return NotificationResult(
                channel=self.channel,
                success=False,
                skipped=True,
                code="disabled",
                message="feishu 通道已关闭",
            )

        webhook_url = str(section.get("webhook_url", "")).strip()
        if not webhook_url:
            return NotificationResult(
                channel=self.channel,
                success=False,
                skipped=True,
                code="config_missing",
                message="feishu 缺少 webhook_url 配置",
            )

        # 占位实现：统一消息通道接口已建立，实际发送链路在后续任务完善。
        _ = payload
        return NotificationResult(
            channel=self.channel,
            success=False,
            skipped=True,
            code="reserved",
            message="feishu 通道占位实现，待完善发送链路",
        )
