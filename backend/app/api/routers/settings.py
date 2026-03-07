from __future__ import annotations

import datetime
import secrets
import uuid
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from urllib.parse import urlparse

from app.api.deps import get_holdings_user_id
from app.core.network_benchmark import DEFAULT_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS, run_network_benchmark
from app.core.rate_limit import InMemoryRateLimiter
from app.core.settings import get_env
from app.notifier import NotificationPayload
from app.notifier import feishu_sender as feishu_mod
from app.notifier import telegram_sender as telegram_mod
from app.notifier.base import NotifierActionError
from app.storage.db import (
    find_user_settings_by_telegram_discovery_secret,
    get_user_settings,
    list_audit_logs,
    upsert_user_settings,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])
# Compatibility routes for historical service paths like `/api/network-benchmark/*`.
compat_router = APIRouter(prefix="/api", tags=["settings-compat"], include_in_schema=False)
MIN_TIMEOUT_SECONDS = 0.5
REDACTED = "<REDACTED>"

# Test message cooldown: 60 seconds per user per channel
_test_message_limiter = InMemoryRateLimiter()
TEST_MESSAGE_COOLDOWN_SECONDS = 60


def _test_message_error(
    category: str,
    message: str,
    *,
    http_status: int | None = None,
    error_code: Any | None = None,
    description: str | None = None,
) -> NotifierActionError:
    # Keep a stable, cross-channel error shape for test_message endpoints.
    msg = str(message or "").strip()
    desc = str(description or msg).strip()
    return NotifierActionError(
        category=str(category or "").strip() or "provider_error",
        message=msg or desc or "unknown",
        http_status=int(http_status) if http_status is not None else None,
        error_code=error_code,
        description=desc or None,
    )


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


def _build_public_base_url(request: Request | None = None) -> str:
    scheme = str(get_env("VC_SCHEME", "http") or "http").strip().lower() or "http"
    domain = str(get_env("VC_DOMAIN", "") or "").strip().strip("/")
    if not domain and request is not None:
        return str(request.base_url).rstrip("/")
    if not domain:
        return ""
    if domain.startswith("http://") or domain.startswith("https://"):
        return domain.rstrip("/")
    return f"{scheme}://{domain}"


def _build_telegram_discovery_path(secret: str) -> str:
    return f"/api/settings/notifications/telegram/inbound/{secret}"


def _build_telegram_discovery_summary(section: dict[str, Any], request: Request | None = None) -> dict[str, Any]:
    secret = str(section.get("chat_auto_discovery_secret", "")).strip()
    path = _build_telegram_discovery_path(secret) if secret else ""
    base_url = _build_public_base_url(request)
    return {
        "secret_configured": bool(secret),
        "webhook_path": path,
        "webhook_url": f"{base_url}{path}" if base_url and path else "",
        "last_chat_id": str(section.get("chat_auto_discovery_last_chat_id", "")).strip(),
        "last_seen_at": str(section.get("chat_auto_discovery_last_seen_at", "")).strip(),
        "last_chat_type": str(section.get("chat_auto_discovery_last_chat_type", "")).strip(),
        "last_chat_title": str(section.get("chat_auto_discovery_last_chat_title", "")).strip(),
    }


def _extract_telegram_chat(update: dict[str, Any]) -> dict[str, str]:
    if not isinstance(update, dict):
        return {"chat_id": "", "chat_type": "", "chat_title": ""}

    candidates: list[Any] = [
        update.get("message"),
        update.get("edited_message"),
        update.get("channel_post"),
        update.get("edited_channel_post"),
        update.get("my_chat_member"),
        update.get("chat_member"),
    ]
    callback_query = update.get("callback_query")
    if isinstance(callback_query, dict):
        candidates.append(callback_query.get("message"))

    for item in candidates:
        if not isinstance(item, dict):
            continue
        chat = item.get("chat")
        if not isinstance(chat, dict):
            continue
        chat_id = str(chat.get("id", "")).strip()
        if not chat_id:
            continue
        title = str(chat.get("title") or chat.get("username") or "").strip()
        if not title:
            first_name = str(chat.get("first_name") or "").strip()
            last_name = str(chat.get("last_name") or "").strip()
            title = " ".join(part for part in (first_name, last_name) if part).strip()
        return {
            "chat_id": chat_id,
            "chat_type": str(chat.get("type", "")).strip(),
            "chat_title": title,
        }

    return {"chat_id": "", "chat_type": "", "chat_title": ""}


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
        if str(telegram_out.get("chat_auto_discovery_secret", "")).strip():
            telegram_out["chat_auto_discovery_secret"] = REDACTED
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
    if isinstance(telegram, dict) and telegram.get("chat_auto_discovery_secret") == REDACTED:
        telegram.pop("chat_auto_discovery_secret", None)

    return settings


def _validate_and_normalize_dca_plans_incoming(settings: dict[str, Any]) -> dict[str, Any]:
    # Lightweight validation for settings.strategy.dca_plans only.
    if not isinstance(settings, dict):
        return {}

    if "strategy" not in settings:
        return settings
    strategy = settings.get("strategy")
    if strategy is None:
        return settings
    if not isinstance(strategy, dict):
        raise HTTPException(status_code=422, detail="settings.strategy 必须为对象")
    if "dca_plans" not in strategy:
        return settings

    trace_id = uuid.uuid4().hex[:12]
    raw_plans = strategy.get("dca_plans")
    if raw_plans is None:
        raise HTTPException(status_code=422, detail=f"settings.strategy.dca_plans 不能为空 (trace_id={trace_id})")
    if not isinstance(raw_plans, list):
        raise HTTPException(status_code=422, detail=f"settings.strategy.dca_plans 必须为数组 (trace_id={trace_id})")

    allowed_schedules = {"weekly", "biweekly", "monthly"}
    normalized: list[dict[str, Any]] = []
    for i, raw in enumerate(raw_plans):
        if not isinstance(raw, dict):
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}] 必须为对象 (trace_id={trace_id})",
            )

        plan_id = str(raw.get("id", "")).strip()
        if not plan_id:
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}].id 不能为空 (trace_id={trace_id})",
            )
        name = str(raw.get("name", "")).strip()
        if not name:
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}].name 不能为空 (trace_id={trace_id})",
            )

        amount = raw.get("amount")
        if isinstance(amount, bool) or not isinstance(amount, (int, float)):
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}].amount 必须为数字 (trace_id={trace_id})",
            )
        if float(amount) <= 0:
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}].amount 必须 > 0 (trace_id={trace_id})",
            )

        schedule_raw = raw.get("schedule")
        schedule = str(schedule_raw or "").strip().lower()
        if schedule not in allowed_schedules:
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}].schedule 非法 (trace_id={trace_id})",
            )

        fund_id_raw = raw.get("fund_id", "")
        fund_id = "" if fund_id_raw is None else str(fund_id_raw).strip()
        if fund_id and (len(fund_id) != 6 or not fund_id.isdigit()):
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}].fund_id 必须为空或6位数字 (trace_id={trace_id})",
            )

        paused = raw.get("paused")
        if not isinstance(paused, bool):
            raise HTTPException(
                status_code=422,
                detail=f"settings.strategy.dca_plans[{i}].paused 必须为布尔值 (trace_id={trace_id})",
            )

        plan_out: dict[str, Any] = dict(raw)
        plan_out["id"] = plan_id
        plan_out["name"] = name
        plan_out["amount"] = float(amount) if isinstance(amount, int) else amount
        plan_out["schedule"] = schedule
        plan_out["fund_id"] = fund_id
        plan_out["paused"] = paused
        normalized.append(plan_out)

    strategy_out: dict[str, Any] = dict(strategy)
    strategy_out["dca_plans"] = normalized
    settings_out: dict[str, Any] = dict(settings)
    settings_out["strategy"] = strategy_out
    return settings_out


class SettingsIn(BaseModel):
    settings: dict[str, Any]


class FeishuWebhookCredentialIn(BaseModel):
    webhook_url: str = Field(min_length=1, max_length=2048)


class TelegramCredentialIn(BaseModel):
    bot_token: str = Field(min_length=1, max_length=256)
    chat_id: str = Field(default="", max_length=64)


class TelegramDiscoverySecretIn(BaseModel):
    rotate: bool = False


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
    incoming = _validate_and_normalize_dca_plans_incoming(incoming)
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
            "bot_token_configured": bool(str(telegram.get("bot_token", "")).strip()),
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


@router.post("/notifications/telegram/discovery/secret")
async def post_telegram_discovery_secret(request: Request, payload: TelegramDiscoverySecretIn) -> dict:
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
    telegram = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}
    bot_token = str(telegram.get("bot_token", "")).strip()
    if not bot_token:
        raise HTTPException(status_code=422, detail="bot_token 未配置，请先保存 Telegram 凭据")

    current_secret = str(telegram.get("chat_auto_discovery_secret", "")).strip()
    next_secret = current_secret
    updated = False
    if payload.rotate or not current_secret:
        next_secret = secrets.token_urlsafe(24)
        updated = True
        settings = upsert_user_settings(
            user_id,
            {
                "notifications": {
                    "telegram": {
                        "chat_auto_discovery_secret": next_secret,
                    }
                }
            },
        )
        notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}
        telegram = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}

    discovery = _build_telegram_discovery_summary(telegram if isinstance(telegram, dict) else {}, request=request)
    discovery["secret"] = next_secret
    return {
        "user_id": user_id,
        "updated": updated,
        "discovery": discovery,
    }


@router.post("/notifications/telegram/inbound/{discovery_secret}")
async def post_telegram_inbound(discovery_secret: str, request: Request) -> dict:
    clean_secret = str(discovery_secret or "").strip()
    if not clean_secret:
        raise HTTPException(status_code=404, detail="telegram discovery secret not found")

    match = find_user_settings_by_telegram_discovery_secret(clean_secret)
    if not match:
        raise HTTPException(status_code=404, detail="telegram discovery secret not found")

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    chat = _extract_telegram_chat(payload if isinstance(payload, dict) else {})
    chat_id = str(chat.get("chat_id", "")).strip()
    if not chat_id:
        return {"ok": True, "updated": False, "reason": "chat_not_found"}

    user_id, _settings = match
    upsert_user_settings(
        user_id,
        {
            "notifications": {
                "telegram": {
                    "chat_id": chat_id,
                    "chat_auto_discovery_last_chat_id": chat_id,
                    "chat_auto_discovery_last_seen_at": _now_iso_seconds(),
                    "chat_auto_discovery_last_chat_type": str(chat.get("chat_type", "")).strip(),
                    "chat_auto_discovery_last_chat_title": str(chat.get("chat_title", "")).strip(),
                }
            }
        },
    )
    return {
        "ok": True,
        "updated": True,
        "chat_id": chat_id,
    }


@router.post("/notifications/telegram/test_message")
async def post_telegram_test_message(request: Request) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)

    # Cooldown check
    cooldown_key = f"telegram:{user_id}"
    allowed, retry_after = _test_message_limiter.check(cooldown_key)
    if not allowed:
        trace_id = uuid.uuid4().hex[:12]
        raise HTTPException(
            status_code=429,
            detail={
                "message": f"请求过于频繁，请在 {retry_after} 秒后重试",
                "retry_after": retry_after,
                "trace_id": trace_id,
            },
        )

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
    last_error: NotifierActionError | None = None

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
                # Record cooldown
                _test_message_limiter.record_success(cooldown_key)
                return {
                    "ok": True,
                    "sent": True,
                    "trace_id": trace_id,
                    "attempts": attempt,
                    "max_attempts": max_attempts,
                    "error": None,
                }

            error_code = resp_json.get("error_code") if isinstance(resp_json, dict) else None
            description = (
                str(resp_json.get("description") or resp_json.get("message") or "").strip()
                if isinstance(resp_json, dict)
                else ""
            )
            category = "unknown"
            try:
                code_int = int(error_code)
            except Exception:
                code_int = -1
            if code_int == 401:
                category = "auth_failed"
            elif code_int == 403:
                category = "forbidden"
            elif code_int == 400 and "chat not found" in description.lower():
                category = "chat_not_found"
            elif code_int == 429:
                category = "rate_limited"
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
        error_category=str(last_error.category if last_error else "unknown"),
    )
    _persist_last_test_history(
        user_id=user_id,
        channel="telegram",
        trace_id=trace_id,
        ok=False,
        sent=False,
        error_category=str(last_error.category if last_error else "unknown"),
    )
    return {
        "ok": False,
        "sent": False,
        "trace_id": trace_id,
        "attempts": max_attempts,
        "max_attempts": max_attempts,
        "error": (last_error or _test_message_error("provider_error", "unknown")).model_dump(),
    }


@router.post("/notifications/feishu/test_message")
async def post_feishu_test_message(request: Request) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)

    # Cooldown check
    cooldown_key = f"feishu:{user_id}"
    allowed, retry_after = _test_message_limiter.check(cooldown_key)
    if not allowed:
        trace_id = uuid.uuid4().hex[:12]
        raise HTTPException(
            status_code=429,
            detail={
                "message": f"请求过于频繁，请在 {retry_after} 秒后重试",
                "retry_after": retry_after,
                "trace_id": trace_id,
            },
        )

    # Send a fixed test message using saved feishu webhook_url.
    # Safety: never echo webhook_url in response.
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
    last_error: NotifierActionError | None = None

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
                # Record cooldown on success
                _test_message_limiter.record_success(cooldown_key)
                return {
                    "ok": True,
                    "sent": True,
                    "trace_id": trace_id,
                    "attempts": attempt,
                    "max_attempts": max_attempts,
                    "error": None,
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
        error_category=str(last_error.category if last_error else "unknown"),
    )
    _persist_last_test_history(
        user_id=user_id,
        channel="feishu",
        trace_id=trace_id,
        ok=False,
        sent=False,
        error_category=str(last_error.category if last_error else "unknown"),
    )
    return {
        "ok": False,
        "sent": False,
        "trace_id": trace_id,
        "attempts": max_attempts,
        "max_attempts": max_attempts,
        "error": (last_error or _test_message_error("provider_error", "unknown")).model_dump(),
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
    telegram_discovery = _build_telegram_discovery_summary(telegram if isinstance(telegram, dict) else {}, request=request)

    email_host = str(email.get("smtp_host", "")).strip()
    email_sender = str(email.get("sender", "")).strip()
    email_recipients = str(email.get("recipients", "")).strip()

    # Cooldown info
    import time
    now = time.time()

    feishu_cooldown_key = f"feishu:{user_id}"
    telegram_cooldown_key = f"telegram:{user_id}"

    feishu_cooldown_remaining = 0
    telegram_cooldown_remaining = 0

    # Check if user is in cooldown
    feishu_allowed, feishu_retry_after = _test_message_limiter.check(feishu_cooldown_key)
    telegram_allowed, telegram_retry_after = _test_message_limiter.check(telegram_cooldown_key)

    if not feishu_allowed:
        feishu_cooldown_remaining = feishu_retry_after
    if not telegram_allowed:
        telegram_cooldown_remaining = telegram_retry_after

    status: dict[str, Any] = {
        "feishu": {
            "enabled": bool(feishu.get("enabled", False)),
            "credential_configured": bool(feishu_webhook),
            "last_test_summary": feishu_last_test_summary,
            "last_test_history": feishu_last_test_history,
            "cooldown_seconds": TEST_MESSAGE_COOLDOWN_SECONDS,
            "cooldown_remaining": feishu_cooldown_remaining,
        },
        "telegram": {
            "enabled": bool(telegram.get("enabled", False)),
            "bot_token_configured": bool(telegram_token),
            "credential_configured": bool(telegram_token and telegram_chat),
            "last_test_summary": telegram_last_test_summary,
            "last_test_history": telegram_last_test_history,
            "cooldown_seconds": TEST_MESSAGE_COOLDOWN_SECONDS,
            "cooldown_remaining": telegram_cooldown_remaining,
            "discovery": telegram_discovery,
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


@router.post("/notifications/test_all")
async def post_notifications_test_all(request: Request) -> dict:
    """一键测试所有通知通道（Telegram、飞书）"""
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    notifications = settings.get("notifications", {}) if isinstance(settings, dict) else {}

    results: dict[str, Any] = {}

    # 测试 Telegram
    telegram_section = notifications.get("telegram", {}) if isinstance(notifications, dict) else {}
    telegram_enabled = bool(telegram_section.get("enabled"))
    telegram_bot_token = str(telegram_section.get("bot_token", "")).strip()
    telegram_chat_id = str(telegram_section.get("chat_id", "")).strip()

    telegram_result: dict[str, Any] = {
        "enabled": telegram_enabled,
        "credential_configured": bool(telegram_bot_token and telegram_chat_id),
        "tested": False,
        "ok": False,
        "sent": False,
        "trace_id": None,
        "error": None,
    }

    if telegram_enabled and telegram_bot_token and telegram_chat_id:
        try:
            # 复用现有逻辑
            telegram_result["tested"] = True
            telegram_result["trace_id"] = uuid.uuid4().hex[:12]
            # 简化：直接调用 test_message 端点逻辑
            test_resp = await post_telegram_test_message(request)
            telegram_result["ok"] = test_resp.get("ok", False)
            telegram_result["sent"] = test_resp.get("sent", False)
            telegram_result["trace_id"] = test_resp.get("trace_id")
            telegram_result["error"] = test_resp.get("error")
        except HTTPException as e:
            telegram_result["error"] = {"category": "http_error", "message": str(e.detail)}
        except Exception as e:
            telegram_result["error"] = {"category": "unknown", "message": str(e)}
    else:
        telegram_result["error"] = {"category": "not_configured", "message": "Telegram 未配置或未启用"}

    results["telegram"] = telegram_result

    # 测试飞书
    feishu_section = notifications.get("feishu", {}) if isinstance(notifications, dict) else {}
    feishu_enabled = bool(feishu_section.get("enabled"))
    feishu_webhook = str(feishu_section.get("webhook_url", "")).strip()

    feishu_result: dict[str, Any] = {
        "enabled": feishu_enabled,
        "credential_configured": bool(feishu_webhook),
        "tested": False,
        "ok": False,
        "sent": False,
        "trace_id": None,
        "error": None,
    }

    if feishu_enabled and feishu_webhook:
        try:
            feishu_result["tested"] = True
            test_resp = await post_feishu_test_message(request)
            feishu_result["ok"] = test_resp.get("ok", False)
            feishu_result["sent"] = test_resp.get("sent", False)
            feishu_result["trace_id"] = test_resp.get("trace_id")
            feishu_result["error"] = test_resp.get("error")
        except HTTPException as e:
            feishu_result["error"] = {"category": "http_error", "message": str(e.detail)}
        except Exception as e:
            feishu_result["error"] = {"category": "unknown", "message": str(e)}
    else:
        feishu_result["error"] = {"category": "not_configured", "message": "飞书未配置或未启用"}

    results["feishu"] = feishu_result

    # 汇总
    all_ok = all(r.get("ok", False) for r in results.values() if r.get("tested"))
    any_tested = any(r.get("tested", False) for r in results.values())

    return {
        "user_id": user_id,
        "ok": all_ok if any_tested else False,
        "channels": results,
        "summary": {
            "total": len(results),
            "tested": sum(1 for r in results.values() if r.get("tested")),
            "passed": sum(1 for r in results.values() if r.get("ok")),
            "failed": sum(1 for r in results.values() if r.get("tested") and not r.get("ok")),
        },
    }


@router.get("/audit_logs")
async def get_settings_audit_logs(request: Request, limit: int = 20) -> dict:
    """获取设置变更审计日志"""
    user_id = get_holdings_user_id(request)
    safe_limit = max(1, min(int(limit), 100))
    logs = list_audit_logs(
        user_id=user_id,
        entity_type="settings",
        entity_id=user_id,
        limit=safe_limit,
    )
    return {
        "user_id": user_id,
        "logs": logs,
        "count": len(logs),
    }


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
