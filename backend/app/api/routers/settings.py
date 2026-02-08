from __future__ import annotations

import datetime
import uuid
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from urllib.parse import urlparse

from app.api.deps import get_holdings_user_id
from app.core.network_benchmark import DEFAULT_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS, run_network_benchmark
from app.notifier import NotificationPayload
from app.notifier import feishu_sender as feishu_mod
from app.notifier import telegram_sender as telegram_mod
from app.storage.db import get_user_settings, upsert_user_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])
# Compatibility routes for historical service paths like `/api/network-benchmark/*`.
compat_router = APIRouter(prefix="/api", tags=["settings-compat"], include_in_schema=False)
MIN_TIMEOUT_SECONDS = 0.5
REDACTED = "<REDACTED>"


def _test_message_error(
    category: str,
    message: str,
    *,
    http_status: int | None = None,
    error_code: Any | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    # Keep a stable, cross-channel error shape for test_message endpoints.
    msg = str(message or "").strip()
    desc = str(description or msg).strip()
    return {
        "category": str(category or "").strip() or "provider_error",
        "message": msg or desc or "unknown",
        "http_status": int(http_status) if http_status is not None else None,
        "error_code": error_code,
        "description": desc or None,
    }


def _now_iso_seconds() -> str:
    # Keep format stable and human-friendly for diagnostics.
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def _persist_last_test_summary(
    *,
    user_id: str,
    channel: Literal["feishu", "telegram", "email"],
    trace_id: str,
    ok: bool,
    sent: bool,
    error_category: str | None,
) -> None:
    # Persist diagnostics only; never store any credentials here.
    upsert_user_settings(
        user_id,
        {
            "notifications": {
                channel: {
                    "last_test_summary": {
                        "time": _now_iso_seconds(),
                        "trace_id": trace_id,
                        "ok": bool(ok),
                        "sent": bool(sent),
                        "error_category": str(error_category) if error_category else None,
                    }
                }
            }
        },
    )


def _persist_last_test_history(
    *,
    user_id: str,
    channel: Literal["feishu", "telegram", "email"],
    trace_id: str,
    ok: bool,
    sent: bool,
    error_category: str | None,
) -> None:
    # Append-only capped history for diagnostics. Never store credentials here.
    current = get_user_settings(user_id)
    notifications = current.get("notifications", {}) if isinstance(current, dict) else {}
    section = notifications.get(channel, {}) if isinstance(notifications, dict) else {}
    existing = section.get("last_test_history") if isinstance(section, dict) else None
    history: list[dict[str, Any]] = list(existing) if isinstance(existing, list) else []

    history.insert(
        0,
        {
            "time": _now_iso_seconds(),
            "trace_id": trace_id,
            "ok": bool(ok),
            "sent": bool(sent),
            "error_category": str(error_category) if error_category else None,
        },
    )
    # Keep newest first and cap to 10.
    history = history[:10]

    upsert_user_settings(
        user_id,
        {
            "notifications": {
                channel: {
                    "last_test_history": history,
                }
            }
        },
    )


def _redact_settings_for_response(settings: dict[str, Any]) -> dict[str, Any]:
    # Only redact a small set of known credentials; keep structure stable.
    if not isinstance(settings, dict):
        return {}
    result: dict[str, Any] = dict(settings)
    notifications = result.get("notifications")
    if not isinstance(notifications, dict):
        return result

    notif_out: dict[str, Any] = dict(notifications)

    feishu = notif_out.get("feishu")
    if isinstance(feishu, dict):
        feishu_out: dict[str, Any] = dict(feishu)
        if str(feishu_out.get("webhook_url", "")).strip():
            feishu_out["webhook_url"] = REDACTED
        notif_out["feishu"] = feishu_out

    telegram = notif_out.get("telegram")
    if isinstance(telegram, dict):
        telegram_out: dict[str, Any] = dict(telegram)
        if str(telegram_out.get("bot_token", "")).strip():
            telegram_out["bot_token"] = REDACTED
        notif_out["telegram"] = telegram_out

    result["notifications"] = notif_out
    return result


def _strip_redacted_credentials_incoming(settings: dict[str, Any]) -> dict[str, Any]:
    # If client sends back redacted placeholder, ignore it to avoid overwriting stored credentials.
    if not isinstance(settings, dict):
        return {}
    notifications = settings.get("notifications")
    if not isinstance(notifications, dict):
        return settings

    feishu = notifications.get("feishu")
    if isinstance(feishu, dict) and feishu.get("webhook_url") == REDACTED:
        feishu.pop("webhook_url", None)

    telegram = notifications.get("telegram")
    if isinstance(telegram, dict) and telegram.get("bot_token") == REDACTED:
        telegram.pop("bot_token", None)

    return settings


class SettingsIn(BaseModel):
    settings: dict[str, Any]


class FeishuWebhookCredentialIn(BaseModel):
    webhook_url: str = Field(min_length=1, max_length=2048)


class TelegramCredentialIn(BaseModel):
    bot_token: str = Field(min_length=1, max_length=256)
    chat_id: str = Field(min_length=1, max_length=64)


class NetworkBenchmarkRunIn(BaseModel):
    profile: Literal["cn_fund", "global"] = "cn_fund"
    timeout_seconds: float = Field(
        default=DEFAULT_TIMEOUT_SECONDS,
        ge=MIN_TIMEOUT_SECONDS,
        le=MAX_TIMEOUT_SECONDS,
    )
    persist: bool = True


@router.get("")
async def get_settings(request: Request) -> dict:
    user_id = get_holdings_user_id(request)
    settings = _redact_settings_for_response(get_user_settings(user_id))
    return {"settings": settings, "user_id": user_id}


@router.put("")
async def put_settings(request: Request, payload: SettingsIn) -> dict:
    user_id = get_holdings_user_id(request)
    incoming = payload.settings if isinstance(payload.settings, dict) else {}
    incoming = _strip_redacted_credentials_incoming(incoming)
    stored = upsert_user_settings(user_id, incoming)
    return {"settings": _redact_settings_for_response(stored), "user_id": user_id}


@router.put("/notifications/feishu/webhook")
async def put_feishu_webhook_credential(request: Request, payload: FeishuWebhookCredentialIn) -> dict:
    user_id = get_holdings_user_id(request)
    trace_id = uuid.uuid4().hex[:12]
    webhook_url = str(payload.webhook_url or "").strip()
    if not webhook_url:
        raise HTTPException(status_code=422, detail=f"webhook_url 不能为空 (reason=empty trace_id={trace_id})")

    parsed = urlparse(webhook_url)
    scheme = str(parsed.scheme or "").lower()
    host = str(parsed.hostname or "").lower()
    if scheme != "https":
        raise HTTPException(
            status_code=422,
            detail=f"webhook_url 仅支持 https (reason=invalid_scheme trace_id={trace_id})",
        )
    if host != "open.feishu.cn":
        raise HTTPException(
            status_code=422,
            detail=f"webhook_url host 必须为 open.feishu.cn (reason=invalid_host trace_id={trace_id})",
        )

    settings = upsert_user_settings(
        user_id,
        {
            "notifications": {
                "feishu": {
                    "webhook_url": webhook_url,
                }
            }
        },
    )
    notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
    feishu = notifications.get("feishu", {}) if isinstance(notifications, dict) else {}
    return {
        "user_id": user_id,
        "updated": True,
        "credential": {
            "channel": "feishu",
            "field": "webhook_url",
            "configured": bool(str(feishu.get("webhook_url", "")).strip()),
        },
        "notifications": {
            "feishu": {
                "enabled": bool(feishu.get("enabled", False)),
                "advice_time": str(feishu.get("advice_time", "")),
                "report_time": str(feishu.get("report_time", "")),
                "timeout_seconds": feishu.get("timeout_seconds"),
                "retry_times": feishu.get("retry_times"),
                "template": str(feishu.get("template", "")),
            }
        },
    }


@router.put("/notifications/telegram/credential")
async def put_telegram_credential(request: Request, payload: TelegramCredentialIn) -> dict:
    user_id = get_holdings_user_id(request)
    bot_token = str(payload.bot_token or "").strip()
    chat_id = str(payload.chat_id or "").strip()
    if not bot_token:
        raise HTTPException(status_code=422, detail="bot_token 不能为空")
    if not chat_id:
        raise HTTPException(status_code=422, detail="chat_id 不能为空")

    settings = upsert_user_settings(
        user_id,
        {
            "notifications": {
                "telegram": {
                    "bot_token": bot_token,
                    "chat_id": chat_id,
                }
            }
        },
    )
    notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
    telegram = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}
    return {
        "user_id": user_id,
        "updated": True,
        "credential": {
            "channel": "telegram",
            "fields": ["bot_token", "chat_id"],
            "configured": bool(str(telegram.get("bot_token", "")).strip() and str(telegram.get("chat_id", "")).strip()),
        },
        "notifications": {
            "telegram": {
                "enabled": bool(telegram.get("enabled", False)),
                "chat_id": str(telegram.get("chat_id", "")),
                "parse_mode": str(telegram.get("parse_mode", "")),
                "disable_web_page_preview": bool(telegram.get("disable_web_page_preview", True)),
                "timeout_seconds": telegram.get("timeout_seconds"),
                "retry_times": telegram.get("retry_times"),
            }
        },
    }



@router.post("/notifications/telegram/test_message")
async def post_telegram_test_message(request: Request) -> dict:
    # Send a fixed test message using saved telegram credentials (bot_token/chat_id).
    # Safety: never echo bot_token in response.
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
    section = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}

    bot_token = str(section.get("bot_token", "")).strip()
    chat_id = str(section.get("chat_id", "")).strip()
    if not bot_token:
        raise HTTPException(status_code=422, detail="bot_token 未配置，请先通过凭据接口更新")
    if not chat_id:
        raise HTTPException(status_code=422, detail="chat_id 未配置，请先通过凭据接口更新")

    trace_id = uuid.uuid4().hex[:12]
    fixed_text = f"VectorControl Telegram 测试消息 (trace_id={trace_id})"

    raw_parse_mode = str(section.get("parse_mode", "")).strip()
    parse_mode = "HTML" if raw_parse_mode.upper() == "HTML" else ""
    disable_web_page_preview = bool(section.get("disable_web_page_preview", True))

    retry_times = telegram_mod._coerce_retry_times(section.get("retry_times", telegram_mod.DEFAULT_RETRY_TIMES))
    timeout_seconds = telegram_mod._coerce_timeout(section.get("timeout_seconds", telegram_mod.DEFAULT_TIMEOUT_SECONDS))

    payload = NotificationPayload(title="VectorControl", content=fixed_text, metadata={})
    text = telegram_mod._build_text(payload=payload, parse_mode=parse_mode)

    api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    req_payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": disable_web_page_preview,
    }
    if parse_mode:
        req_payload["parse_mode"] = parse_mode

    max_attempts = retry_times + 1
    last_error: dict[str, Any] | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            status_code, resp_json = telegram_mod._http_post_json(api_url, req_payload, timeout_seconds)
            ok = bool(resp_json.get("ok", False)) if isinstance(resp_json, dict) else False
            if status_code == 200 and ok:
                result = resp_json.get("result", {}) if isinstance(resp_json.get("result"), dict) else {}
                provider_message_id = str(result.get("message_id") or "")
                _persist_last_test_summary(
                    user_id=user_id,
                    channel="telegram",
                    trace_id=trace_id,
                    ok=True,
                    sent=True,
                    error_category=None,
                )
                _persist_last_test_history(
                    user_id=user_id,
                    channel="telegram",
                    trace_id=trace_id,
                    ok=True,
                    sent=True,
                    error_category=None,
                )
                return {
                    "user_id": user_id,
                    "ok": True,
                    "sent": True,
                    "trace_id": trace_id,
                    "attempts": attempt,
                    "max_attempts": max_attempts,
                    "provider_message_id": provider_message_id,
                }

            error_code = resp_json.get("error_code") if isinstance(resp_json, dict) else None
            description = (
                str(resp_json.get("description") or resp_json.get("message") or "").strip()
                if isinstance(resp_json, dict)
                else ""
            )
            category = "provider_error"
            try:
                code_int = int(error_code)
            except Exception:
                code_int = -1
            if code_int == 401:
                category = "unauthorized"
            elif code_int == 403:
                category = "forbidden"
            elif code_int == 400:
                category = "bad_request"
            last_error = _test_message_error(
                category,
                description or category,
                http_status=int(status_code),
                error_code=error_code,
                description=description or None,
            )
        except TimeoutError:
            last_error = _test_message_error("timeout", "timeout")
        except Exception as exc:
            # Avoid leaking bot_token via exception text (it can include the request URL).
            last_error = _test_message_error("network_error", str(exc.__class__.__name__))

    _persist_last_test_summary(
        user_id=user_id,
        channel="telegram",
        trace_id=trace_id,
        ok=False,
        sent=False,
        error_category=str((last_error or {}).get("category") or "unknown"),
    )
    _persist_last_test_history(
        user_id=user_id,
        channel="telegram",
        trace_id=trace_id,
        ok=False,
        sent=False,
        error_category=str((last_error or {}).get("category") or "unknown"),
    )
    return {
        "user_id": user_id,
        "ok": False,
        "sent": False,
        "trace_id": trace_id,
        "attempts": max_attempts,
        "max_attempts": max_attempts,
        "error": last_error or _test_message_error("provider_error", "unknown"),
    }


@router.post("/notifications/feishu/test_message")
async def post_feishu_test_message(request: Request) -> dict:
    # Send a fixed test message using saved feishu webhook_url.
    # Safety: never echo webhook_url in response.
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
    section = notifications.get("feishu", {}) if isinstance(notifications, dict) else {}

    webhook_url = str(section.get("webhook_url", "")).strip()
    if not webhook_url:
        raise HTTPException(status_code=422, detail="webhook_url 未配置，请先通过凭据接口更新")

    trace_id = uuid.uuid4().hex[:12]
    fixed_text = f"VectorControl 飞书 测试消息 (trace_id={trace_id})"
    payload = NotificationPayload(title="VectorControl", content=fixed_text, metadata={})
    text = feishu_mod.FeishuSender._build_text(payload=payload, template=str(section.get("template", "title_content_metadata")))

    req_payload: dict[str, Any] = {
        "msg_type": "text",
        "content": {"text": text},
    }

    retry_times = feishu_mod.FeishuSender._coerce_retry_times(section.get("retry_times", feishu_mod.DEFAULT_RETRY_TIMES))
    timeout_seconds = feishu_mod.FeishuSender._coerce_timeout(section.get("timeout_seconds", feishu_mod.DEFAULT_TIMEOUT_SECONDS))
    max_attempts = retry_times + 1
    last_error: dict[str, Any] | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            status_code, resp_json = feishu_mod._http_post_json(webhook_url, req_payload, timeout_seconds)
            provider_code = int(resp_json.get("StatusCode", resp_json.get("code", -1))) if isinstance(resp_json, dict) else -1
            if status_code == 200 and provider_code == 0:
                provider_message_id = str(
                    resp_json.get("message_id")
                    or (resp_json.get("data") or {}).get("message_id")
                    or trace_id
                )
                _persist_last_test_summary(
                    user_id=user_id,
                    channel="feishu",
                    trace_id=trace_id,
                    ok=True,
                    sent=True,
                    error_category=None,
                )
                _persist_last_test_history(
                    user_id=user_id,
                    channel="feishu",
                    trace_id=trace_id,
                    ok=True,
                    sent=True,
                    error_category=None,
                )
                return {
                    "user_id": user_id,
                    "ok": True,
                    "sent": True,
                    "trace_id": trace_id,
                    "attempts": attempt,
                    "max_attempts": max_attempts,
                    "provider_message_id": provider_message_id,
                }

            provider_message = str(resp_json.get("StatusMessage") or resp_json.get("msg") or "").strip() if isinstance(resp_json, dict) else ""
            category = "provider_error"
            if int(status_code) == 401:
                category = "unauthorized"
            elif int(status_code) == 403:
                category = "forbidden"
            elif int(status_code) == 400:
                category = "bad_request"
            description = provider_message or f"provider_code={provider_code}"
            last_error = _test_message_error(
                category,
                description or category,
                http_status=int(status_code),
                error_code=provider_code,
                description=description,
            )
        except TimeoutError:
            last_error = _test_message_error("timeout", "timeout")
        except Exception as exc:
            # Avoid leaking webhook_url via exception text.
            last_error = _test_message_error("network_error", str(exc.__class__.__name__))

    _persist_last_test_summary(
        user_id=user_id,
        channel="feishu",
        trace_id=trace_id,
        ok=False,
        sent=False,
        error_category=str((last_error or {}).get("category") or "unknown"),
    )
    _persist_last_test_history(
        user_id=user_id,
        channel="feishu",
        trace_id=trace_id,
        ok=False,
        sent=False,
        error_category=str((last_error or {}).get("category") or "unknown"),
    )
    return {
        "user_id": user_id,
        "ok": False,
        "sent": False,
        "trace_id": trace_id,
        "attempts": max_attempts,
        "max_attempts": max_attempts,
        "error": last_error or _test_message_error("provider_error", "unknown"),
    }


@router.get("/notifications/status")
async def get_notifications_status(request: Request) -> dict:
    # Read-only, redacted diagnostics for notification channels.
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}

    feishu = notifications.get("feishu", {}) if isinstance(notifications, dict) else {}
    telegram = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}
    email = notifications.get("email", {}) if isinstance(notifications, dict) else {}

    def _coerce_summary(section: Any) -> dict[str, Any] | None:
        if not isinstance(section, dict):
            return None
        summary = section.get("last_test_summary")
        return summary if isinstance(summary, dict) else None

    def _coerce_history(section: Any) -> list[dict[str, Any]]:
        if not isinstance(section, dict):
            return []
        raw = section.get("last_test_history")
        if not isinstance(raw, list):
            return []
        # Only keep dict items to keep response shape stable.
        return [item for item in raw if isinstance(item, dict)][:10]

    feishu_last_test_summary = _coerce_summary(feishu)
    telegram_last_test_summary = _coerce_summary(telegram)
    email_last_test_summary = _coerce_summary(email)

    feishu_last_test_history = _coerce_history(feishu)
    telegram_last_test_history = _coerce_history(telegram)
    email_last_test_history = _coerce_history(email)

    feishu_webhook = str(feishu.get("webhook_url", "")).strip()
    telegram_token = str(telegram.get("bot_token", "")).strip()
    telegram_chat = str(telegram.get("chat_id", "")).strip()

    email_host = str(email.get("smtp_host", "")).strip()
    email_sender = str(email.get("sender", "")).strip()
    email_recipients = str(email.get("recipients", "")).strip()

    status: dict[str, Any] = {
        "feishu": {
            "enabled": bool(feishu.get("enabled", False)),
            "credential_configured": bool(feishu_webhook),
            "last_test_summary": feishu_last_test_summary,
            "last_test_history": feishu_last_test_history,
        },
        "telegram": {
            "enabled": bool(telegram.get("enabled", False)),
            "credential_configured": bool(telegram_token and telegram_chat),
            "last_test_summary": telegram_last_test_summary,
            "last_test_history": telegram_last_test_history,
        },
        "email": {
            "enabled": bool(email.get("enabled", False)),
            "credential_configured": bool(email_host and email_sender and email_recipients),
            "last_test_summary": email_last_test_summary,
            "last_test_history": email_last_test_history,
        },
    }

    return {"user_id": user_id, "status": status}

@router.get("/network-benchmark/latest")
async def get_network_benchmark_latest(request: Request) -> dict:
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    section = settings.get("network_benchmark", {}) if isinstance(settings, dict) else {}
    result = section.get("last_result") if isinstance(section, dict) else None
    return {
        "user_id": user_id,
        "available": isinstance(result, dict),
        "result": result if isinstance(result, dict) else None,
    }


# Legacy compatibility: /network_benchmark/latest
@router.get("/network_benchmark/latest", include_in_schema=False)
async def get_network_benchmark_latest_legacy(request: Request) -> dict:
    return await get_network_benchmark_latest(request)


@router.post("/network-benchmark/run")
async def post_network_benchmark_run(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    user_id = get_holdings_user_id(request)
    result = run_network_benchmark(payload.profile, payload.timeout_seconds)

    if payload.persist:
        upsert_user_settings(
            user_id,
            {
                "network_benchmark": {
                    "default_profile": result.get("profile", payload.profile),
                    "timeout_seconds": result.get("timeout_seconds", payload.timeout_seconds),
                    "last_run_at": result.get("generated_at", ""),
                    "last_result": result,
                }
            },
        )

    return {"user_id": user_id, "result": result}


# Legacy compatibility: /network_benchmark/run
@router.post("/network_benchmark/run", include_in_schema=False)
async def post_network_benchmark_run_legacy(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    return await post_network_benchmark_run(request, payload)


@compat_router.get("/network-benchmark/latest")
async def get_network_benchmark_latest_compat(request: Request) -> dict:
    return await get_network_benchmark_latest(request)


@compat_router.get("/network_benchmark/latest")
async def get_network_benchmark_latest_compat_legacy(request: Request) -> dict:
    return await get_network_benchmark_latest(request)


@compat_router.post("/network-benchmark/run")
async def post_network_benchmark_run_compat(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    return await post_network_benchmark_run(request, payload)


@compat_router.post("/network_benchmark/run")
async def post_network_benchmark_run_compat_legacy(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    return await post_network_benchmark_run(request, payload)
