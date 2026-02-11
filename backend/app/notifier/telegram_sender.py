from __future__ import annotations

import html
import json
import logging
import uuid
from typing import Any
from urllib import request

from .base import NotificationPayload, NotificationResult

LOGGER = logging.getLogger("vectorcontrol.notifier.telegram")
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


def _get_masked_bot_token(bot_token: str) -> str:
    return bot_token[:10] + "***" if len(bot_token) > 10 else bot_token


def _coerce_retry_times(value: Any) -> int:
    try:
        retry_times = int(value)
    except Exception:
        retry_times = DEFAULT_RETRY_TIMES
    return max(0, min(retry_times, MAX_RETRY_TIMES))


def _coerce_timeout(value: Any) -> float:
    try:
        timeout_seconds = float(value)
    except Exception:
        timeout_seconds = DEFAULT_TIMEOUT_SECONDS
    return max(0.5, min(timeout_seconds, 30.0))


def _build_text(payload: NotificationPayload, parse_mode: str) -> str:
    metadata = payload.metadata if isinstance(payload.metadata, dict) else {}
    mode = str(parse_mode or "").strip().upper()

    lines: list[str] = []
    if mode == "HTML":
        if payload.title.strip():
            lines.append(f"<b>{html.escape(payload.title.strip())}</b>")
        if payload.content.strip():
            lines.append(html.escape(payload.content.strip()))
        for key in sorted(metadata.keys()):
            value = metadata.get(key)
            if value is None:
                continue
            value_text = str(value).strip()
            if not value_text:
                continue
            lines.append(f"{html.escape(str(key))}: {html.escape(value_text)}")
    else:
        if payload.title.strip():
            lines.append(f"[{payload.title.strip()}]")
        if payload.content.strip():
            lines.append(payload.content.strip())
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
                message="telegram channel disabled",
            )

        bot_token = str(section.get("bot_token", "")).strip()
        chat_id = str(section.get("chat_id", "")).strip()
        if not bot_token or not chat_id:
            return NotificationResult(
                channel=self.channel,
                success=False,
                skipped=True,
                code="config_missing",
                message="missing telegram bot_token or chat_id",
            )

        # Only HTML is enabled safely (escaped). Other parse modes are treated as plain text.
        raw_parse_mode = str(section.get("parse_mode", "")).strip()
        parse_mode = "HTML" if raw_parse_mode.upper() == "HTML" else ""
        disable_web_page_preview = bool(section.get("disable_web_page_preview", True))

        retry_times = _coerce_retry_times(section.get("retry_times", DEFAULT_RETRY_TIMES))
        timeout_seconds = _coerce_timeout(section.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS))

        text = _build_text(payload=payload, parse_mode=parse_mode)
        api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        req_payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": disable_web_page_preview,
        }
        if parse_mode:
            req_payload["parse_mode"] = parse_mode

       trace_id = uuid.uuid4().hex[:12]
       max_attempts = retry_times + 1
       masked_bot_token = _get_masked_bot_token(bot_token) # Add this line
       for attempt in range(1, max_attempts + 1):
           try:
               status_code, resp_json = _http_post_json(api_url, req_payload, timeout_seconds)
               ok = bool(resp_json.get("ok", False))
               if status_code == 200 and ok:
                   result = resp_json.get("result", {}) if isinstance(resp_json.get("result"), dict) else {}
                   provider_message_id = str(result.get("message_id") or trace_id)
                   LOGGER.info(
                       "telegram notify success trace_id=%s attempt=%s provider_message_id=%s",
                       trace_id,
                       attempt,
                       provider_message_id,
                   )
                   return NotificationResult(
                       channel=self.channel,
                       success=True,
                       skipped=False,
                       code="ok",
                       message=f"telegram sent trace_id={trace_id}",
                       provider_message_id=provider_message_id,
                   )

               description = str(resp_json.get("description") or resp_json.get("message") or "").strip()
               error_code = int(resp_json.get("error_code") or -1)
               
               error_category = "unknown"
               if error_code == 401:
                   error_category = "auth_failed"
               elif error_code == 400 and "chat not found" in description.lower():
                   error_category = "chat_not_found"
               elif error_code == 429:
                   error_category = "rate_limited"
               
               LOGGER.warning(
                   "telegram notify failed trace_id=%s attempt=%s/%s token_prefix=%s error_category=%s description=%s",
                   trace_id,
                   attempt,
                   max_attempts,
                   masked_bot_token,
                   error_category,
                   description,
               )
               if attempt >= max_attempts:
                   return NotificationResult(
                       channel=self.channel,
                       success=False,
                       skipped=False,
                       code=error_category,
                       message=f"telegram send failed trace_id={trace_id} attempts={max_attempts} error={description}",
                       provider_message_id=trace_id,
                   )
           except TimeoutError:
               error_category = "network_error"
               LOGGER.warning(
                   "telegram notify failed trace_id=%s attempt=%s/%s token_prefix=%s error_category=%s message=%s",
                   trace_id,
                   attempt,
                   max_attempts,
                   masked_bot_token,
                   error_category,
                   "timeout",
               )
               if attempt >= max_attempts:
                   return NotificationResult(
                       channel=self.channel,
                       success=False,
                       skipped=False,
                       code=error_category,
                       message=f"telegram send failed trace_id={trace_id} attempts={max_attempts} error=timeout",
                       provider_message_id=trace_id,
                   )
           except Exception as exc:
               error_category = "network_error" # Fallback to network_error for other exceptions
               LOGGER.warning(
                   "telegram notify failed trace_id=%s attempt=%s/%s token_prefix=%s err_class=%s error_category=%s",
                   trace_id,
                   attempt,
                   max_attempts,
                   masked_bot_token,
                   exc.__class__.__name__,
                   error_category,
               )
               if attempt >= max_attempts:
                   return NotificationResult(
                       channel=self.channel,
                       success=False,
                       skipped=False,
                       code=error_category,
                       message=f"telegram send failed trace_id={trace_id} attempts={max_attempts} error={exc.__class__.__name__}",
                       provider_message_id=trace_id,
                   )

       return NotificationResult(
           channel=self.channel,
           success=False,
           skipped=False,
           code="send_failed",
           message=f"telegram send failed trace_id={trace_id} attempts={max_attempts}",
           provider_message_id=trace_id,
       )
