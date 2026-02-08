from __future__ import annotations

import json
import logging
import uuid
from typing import Any
from urllib import request

from .base import NotificationPayload, NotificationResult

LOGGER = logging.getLogger("vectorcontrol.notifier.feishu")
DEFAULT_TIMEOUT_SECONDS = 3.0
DEFAULT_RETRY_TIMES = 2
MAX_RETRY_TIMES = 5
MAX_TEXT_LENGTH = 4096


def _http_post_json(url: str, payload: dict[str, Any], timeout_seconds: float) -> tuple[int, dict[str, Any]]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url=url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with request.urlopen(req, timeout=timeout_seconds) as resp:
        status_code = int(getattr(resp, "status", 200))
        raw = resp.read().decode("utf-8", errors="replace")
    try:
        parsed = json.loads(raw) if raw else {}
    except Exception:
        parsed = {}
    return status_code, parsed


class FeishuSender:
    channel = "feishu"

    @staticmethod
    def _coerce_retry_times(value: Any) -> int:
        try:
            retry_times = int(value)
        except Exception:
            retry_times = DEFAULT_RETRY_TIMES
        return max(0, min(retry_times, MAX_RETRY_TIMES))

    @staticmethod
    def _coerce_timeout(value: Any) -> float:
        try:
            timeout_seconds = float(value)
        except Exception:
            timeout_seconds = DEFAULT_TIMEOUT_SECONDS
        return max(0.5, min(timeout_seconds, 30.0))

    @staticmethod
    def _build_text(payload: NotificationPayload, template: str) -> str:
        template_key = str(template or "").strip().lower()
        metadata = payload.metadata if isinstance(payload.metadata, dict) else {}
        lines: list[str] = []
        if payload.title.strip():
            lines.append(f"[{payload.title.strip()}]")
        if payload.content.strip():
            lines.append(payload.content.strip())
        if template_key != "content_only":
            for key in sorted(metadata.keys()):
                value = metadata.get(key)
                if value is None:
                    continue
                value_text = str(value).strip()
                if not value_text:
                    continue
                lines.append(f"{key}: {value_text}")
        text = "\n".join(lines).strip() or "VectorControl notification"
        if len(text) > MAX_TEXT_LENGTH:
            return text[: MAX_TEXT_LENGTH - 3] + "..."
        return text

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
                message="feishu channel disabled",
            )

        webhook_url = str(section.get("webhook_url", "")).strip()
        if not webhook_url:
            return NotificationResult(
                channel=self.channel,
                success=False,
                skipped=True,
                code="config_missing",
                message="missing feishu webhook_url",
            )

        trace_id = uuid.uuid4().hex[:12]
        retry_times = self._coerce_retry_times(section.get("retry_times", DEFAULT_RETRY_TIMES))
        timeout_seconds = self._coerce_timeout(section.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS))
        text = self._build_text(payload=payload, template=str(section.get("template", "title_content_metadata")))
        request_payload = {
            "msg_type": "text",
            "content": {"text": text},
        }
        max_attempts = retry_times + 1

        for attempt in range(1, max_attempts + 1):
            try:
                status_code, response_json = _http_post_json(
                    webhook_url,
                    request_payload,
                    timeout_seconds,
                )
                provider_code = int(response_json.get("StatusCode", response_json.get("code", -1)))
                if status_code == 200 and provider_code == 0:
                    provider_message_id = str(
                        response_json.get("message_id")
                        or (response_json.get("data") or {}).get("message_id")
                        or trace_id
                    )
                    LOGGER.info(
                        "feishu notify success trace_id=%s attempt=%s provider_message_id=%s",
                        trace_id,
                        attempt,
                        provider_message_id,
                    )
                    return NotificationResult(
                        channel=self.channel,
                        success=True,
                        skipped=False,
                        code="ok",
                        message=f"feishu sent trace_id={trace_id}",
                        provider_message_id=provider_message_id,
                    )

                provider_message = str(
                    response_json.get("StatusMessage")
                    or response_json.get("msg")
                    or f"http_status={status_code}"
                ).strip()
                raise RuntimeError(f"provider_error code={provider_code} message={provider_message}")
            except Exception as exc:
                LOGGER.warning(
                    "feishu notify failed trace_id=%s attempt=%s/%s err=%s",
                    trace_id,
                    attempt,
                    max_attempts,
                    exc,
                )
                if attempt >= max_attempts:
                    return NotificationResult(
                        channel=self.channel,
                        success=False,
                        skipped=False,
                        code="send_failed",
                        message=f"feishu send failed trace_id={trace_id} attempts={max_attempts}",
                        provider_message_id=trace_id,
                    )

        return NotificationResult(
            channel=self.channel,
            success=False,
            skipped=False,
            code="send_failed",
            message=f"feishu send failed trace_id={trace_id} attempts={max_attempts}",
            provider_message_id=trace_id,
        )
