from __future__ import annotations

import hashlib
import json
import logging
import uuid
from time import monotonic
from typing import Any
from urllib import request
from urllib.error import HTTPError

from .base import NotificationPayload, NotificationResult
from urllib.parse import urlparse

FEISHU_WEBHOOK_HOST = "open.feishu.cn"

def _validate_feishu_webhook_url(webhook_url: str) -> None:
    # URL validation: only allow https protocol, host whitelist open.feishu.cn
    parsed = urlparse(webhook_url)
    scheme = str(parsed.scheme or "").lower()
    host = str(parsed.hostname or "").lower()
    if scheme != "https":
        raise ValueError("webhook_url 仅支持 https 协议")
    if host != FEISHU_WEBHOOK_HOST:
        raise ValueError(f"webhook_url host 必须为 {FEISHU_WEBHOOK_HOST}")

LOGGER = logging.getLogger("vectorcontrol.notifier.feishu")
DEFAULT_TIMEOUT_SECONDS = 3.0
DEFAULT_RETRY_TIMES = 2
MAX_RETRY_TIMES = 5
MAX_TEXT_LENGTH = 4096
FEISHU_GOVERNANCE_MIN_INTERVAL_SECONDS = 5.0
FEISHU_GOVERNANCE_OPEN_SECONDS = 60.0
FEISHU_GOVERNANCE_MAX_FAILURES = 3
FEISHU_GOVERNANCE_STATE_TTL_SECONDS = 600.0
_GOVERNANCE_STATE: dict[str, dict[str, Any]] = {}


def _governance_now() -> float:
    return monotonic()


def _governance_key(webhook_url: str) -> str:
    return hashlib.sha256(str(webhook_url).encode("utf-8")).hexdigest()[:16]


def _prune_governance_state(now: float) -> None:
    stale_keys = [
        key
        for key, value in _GOVERNANCE_STATE.items()
        if now - float(value.get("updated_at", 0.0) or 0.0) > FEISHU_GOVERNANCE_STATE_TTL_SECONDS
    ]
    for key in stale_keys:
        _GOVERNANCE_STATE.pop(key, None)


def _get_governance_state(key: str) -> dict[str, Any]:
    state = _GOVERNANCE_STATE.get(key)
    if state is None:
        state = {
            "last_attempt_at": 0.0,
            "last_success_at": 0.0,
            "last_failure_at": 0.0,
            "consecutive_failures": 0,
            "blocked_until": 0.0,
            "updated_at": 0.0,
        }
        _GOVERNANCE_STATE[key] = state
    return state


def _mark_governance_success(state: dict[str, Any], now: float) -> None:
    state["last_attempt_at"] = now
    state["last_success_at"] = now
    state["consecutive_failures"] = 0
    state["blocked_until"] = 0.0
    state["updated_at"] = now


def _mark_governance_failure(state: dict[str, Any], now: float) -> None:
    state["last_attempt_at"] = now
    state["last_failure_at"] = now
    state["consecutive_failures"] = int(state.get("consecutive_failures") or 0) + 1
    if int(state["consecutive_failures"]) >= FEISHU_GOVERNANCE_MAX_FAILURES:
        state["blocked_until"] = now + FEISHU_GOVERNANCE_OPEN_SECONDS
    state["updated_at"] = now


def _clear_governance_state() -> None:
    _GOVERNANCE_STATE.clear()


def _http_post_json(url: str, payload: dict[str, Any], timeout_seconds: float) -> tuple[int, dict[str, Any]]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url=url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with request.urlopen(req, timeout=timeout_seconds) as resp:
            status_code = int(getattr(resp, "status", 200))
            raw = resp.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        # Keep response body for diagnostics without raising; caller decides category.
        status_code = int(getattr(exc, "code", 0) or 0)
        raw = exc.read().decode("utf-8", errors="replace")
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
        trace_id = uuid.uuid4().hex[:12]
        
        if not enabled:
            return NotificationResult(
                ok=False,
                sent=False,
                trace_id=trace_id,
                attempts=1,
                error="feishu channel disabled",
                channel=self.channel,
            )

        webhook_url = str(section.get("webhook_url", "")).strip()
        if not webhook_url:
            return NotificationResult(
                ok=False,
                sent=False,
                trace_id=trace_id,
                attempts=1,
                error="missing feishu webhook_url",
                channel=self.channel,
            )
        try:
            _validate_feishu_webhook_url(webhook_url)
        except ValueError as exc:
            # Sensitive info (webhook_url) should be masked in logs.
            LOGGER.error(
                "feishu webhook_url validation failed webhook_url_prefix=%s error=%s",
                webhook_url[:10] + "***",
                exc,
            )
            return NotificationResult(
                ok=False,
                sent=False,
                trace_id=trace_id,
                attempts=1,
                error=f"invalid feishu webhook_url: {exc}",
                channel=self.channel,
            )

        retry_times = self._coerce_retry_times(section.get("retry_times", DEFAULT_RETRY_TIMES))
        timeout_seconds = self._coerce_timeout(section.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS))
        text = self._build_text(payload=payload, template=str(section.get("template", "title_content_metadata")))
        request_payload = {
            "msg_type": "text",
            "content": {"text": text},
        }
        max_attempts = retry_times + 1
        governance_key = _governance_key(webhook_url)
        current_time = _governance_now()
        _prune_governance_state(current_time)
        governance_state = _get_governance_state(governance_key)

        blocked_until = float(governance_state.get("blocked_until") or 0.0)
        if blocked_until > current_time:
            retry_after = max(1, int(blocked_until - current_time))
            LOGGER.warning(
                "feishu governance isolate trace_id=%s key=%s retry_after=%ss consecutive_failures=%s",
                trace_id,
                governance_key,
                retry_after,
                governance_state.get("consecutive_failures"),
            )
            return NotificationResult(
                ok=False,
                sent=False,
                trace_id=trace_id,
                attempts=0,
                error=f"feishu sender isolated temporarily, retry after {retry_after}s",
                channel=self.channel,
            )

        last_attempt_at = float(governance_state.get("last_attempt_at") or 0.0)
        if last_attempt_at > 0 and current_time - last_attempt_at < FEISHU_GOVERNANCE_MIN_INTERVAL_SECONDS:
            retry_after = max(1, int(FEISHU_GOVERNANCE_MIN_INTERVAL_SECONDS - (current_time - last_attempt_at)))
            governance_state["updated_at"] = current_time
            LOGGER.info(
                "feishu governance throttle trace_id=%s key=%s retry_after=%ss",
                trace_id,
                governance_key,
                retry_after,
            )
            return NotificationResult(
                ok=False,
                sent=False,
                trace_id=trace_id,
                attempts=0,
                error=f"feishu sender throttled, retry after {retry_after}s",
                channel=self.channel,
            )

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
                    _mark_governance_success(governance_state, _governance_now())
                    return NotificationResult(
                        ok=True,
                        sent=True,
                        trace_id=provider_message_id,
                        attempts=attempt,
                        error="",
                        channel=self.channel,
                    )

                provider_message = str(
                    response_json.get("StatusMessage")
                    or response_json.get("msg")
                    or f"http_status={status_code}"
                ).strip()
                raise RuntimeError(f"provider_error code={provider_code} message={provider_message}")
            except Exception as exc:
                LOGGER.warning(
                    "feishu notify failed trace_id=%s attempt=%s/%s err_class=%s",
                    trace_id,
                    attempt,
                    max_attempts,
                    exc.__class__.__name__,
                )
                if attempt >= max_attempts:
                    failed_now = _governance_now()
                    _mark_governance_failure(governance_state, failed_now)
                    LOGGER.warning(
                        "feishu governance failure trace_id=%s key=%s consecutive_failures=%s blocked_until=%s",
                        trace_id,
                        governance_key,
                        governance_state.get("consecutive_failures"),
                        governance_state.get("blocked_until"),
                    )
                    return NotificationResult(
                        ok=False,
                        sent=False,
                        trace_id=trace_id,
                        attempts=max_attempts,
                        error=f"feishu send failed after {max_attempts} attempts: {exc}",
                        channel=self.channel,
                    )

        return NotificationResult(
            ok=False,
            sent=False,
            trace_id=trace_id,
            attempts=max_attempts,
            error=f"feishu send failed after {max_attempts} attempts",
            channel=self.channel,
        )
