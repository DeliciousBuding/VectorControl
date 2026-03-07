from __future__ import annotations

import copy
import os
import platform
import subprocess
from datetime import datetime
from pathlib import Path
from threading import Lock
from time import monotonic, perf_counter
from typing import Any

from fastapi import APIRouter, Request

from app.api.deps import get_holdings_user_id, get_snapshot_user_id, get_user_id, get_username, is_admin
from app.core.request_metrics import get_recent_request_metrics
from app.storage.db import get_sqlite_observability_snapshot, get_system_status_snapshot

router = APIRouter(prefix="/api/system", tags=["系统"])

SERVICE_NAME = "vectorcontrol-backend"
SCHEMA_VERSION = "system-observability.v1"


def _read_release_cache_ttl_seconds() -> int:
    raw_value = str(os.getenv("VC_SYSTEM_RELEASE_CACHE_TTL_SECONDS", "30")).strip()
    try:
        return max(1, int(raw_value))
    except Exception:  # noqa: BLE001
        return 30


RELEASE_CACHE_TTL_SECONDS = _read_release_cache_ttl_seconds()
_RELEASE_CACHE_LOCK = Lock()
_RELEASE_CACHE: dict[str, Any] = {
    "expires_at": 0.0,
    "value": None,
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _run_git(args: list[str]) -> str:
    root = _repo_root()
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=str(root),
            check=True,
            capture_output=True,
            text=True,
        )
        return str(proc.stdout or "").strip()
    except Exception:  # noqa: BLE001
        return ""


def _git_ref_short(ref_name: str) -> str:
    clean_ref = str(ref_name or "").strip()
    if not clean_ref:
        return ""
    return _run_git(["rev-parse", "--short", clean_ref])


def _read_version_info() -> tuple[str, str]:
    for env_name in ("APP_VERSION", "VC_APP_VERSION"):
        env_version = str(os.getenv(env_name, "")).strip()
        if env_version:
            return env_version, f"env:{env_name}"
    version_file = _repo_root() / "VERSION"
    try:
        text = version_file.read_text(encoding="utf-8").strip()
        if text:
            return text, "file:VERSION"
    except Exception:  # noqa: BLE001
        pass
    return "unknown", "unknown"


def _read_commit_info() -> tuple[str, str]:
    for env_name in ("APP_COMMIT", "VC_APP_COMMIT"):
        env_commit = str(os.getenv(env_name, "")).strip()
        if env_commit:
            return env_commit[:12], f"env:{env_name}"
    commit = _git_ref_short("HEAD")
    if commit:
        return commit, "git:HEAD"
    return "", "unknown"


def _resolve_compare_base() -> tuple[str, str]:
    origin_main_commit = _git_ref_short("origin/main")
    if origin_main_commit:
        return "origin/main", origin_main_commit
    main_commit = _git_ref_short("main")
    if main_commit:
        return "main", main_commit
    return "", ""


def _build_release_metadata_uncached() -> dict[str, Any]:
    version, version_source = _read_version_info()
    commit, commit_source = _read_commit_info()
    branch = _run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    online_version = str(os.getenv("VC_ONLINE_VERSION", "")).strip()
    online_commit_env = str(os.getenv("VC_ONLINE_COMMIT", "")).strip()
    compare_base, compare_base_commit = _resolve_compare_base()
    main_commit = online_commit_env or compare_base_commit

    status = "unknown"
    ahead = 0
    behind = 0
    if compare_base:
        counts_raw = _run_git(["rev-list", "--left-right", "--count", f"{compare_base}...HEAD"])
        chunks = counts_raw.split()
        if len(chunks) == 2 and chunks[0].isdigit() and chunks[1].isdigit():
            behind = int(chunks[0])
            ahead = int(chunks[1])
            if ahead == 0 and behind == 0:
                status = "same"
            elif ahead > 0 and behind == 0:
                status = "ahead"
            elif ahead == 0 and behind > 0:
                status = "behind"
            else:
                status = "diverged"

    online_commit_source = "env:VC_ONLINE_COMMIT" if online_commit_env else ("git_ref" if compare_base_commit else "unknown")

    return {
        "current": {
            "version": version,
            "commit": commit,
            "version_source": version_source,
            "commit_source": commit_source,
            "branch": branch,
        },
        "online_reference": {
            "version": online_version,
            "version_source": "env:VC_ONLINE_VERSION" if online_version else "unknown",
            "commit": main_commit,
            "commit_source": online_commit_source,
            "ref": compare_base,
            "source": online_commit_source,
        },
        "compare_with_online": {
            "status": status,
            "ahead": ahead,
            "behind": behind,
            "base_ref": compare_base,
        },
        "cache": {
            "generated_at": datetime.now().astimezone().isoformat(),
            "ttl_seconds": RELEASE_CACHE_TTL_SECONDS,
        },
    }


def _clear_release_metadata_cache() -> None:
    with _RELEASE_CACHE_LOCK:
        _RELEASE_CACHE["expires_at"] = 0.0
        _RELEASE_CACHE["value"] = None


def _get_cached_release_metadata() -> dict[str, Any]:
    now = monotonic()
    cached_value = _RELEASE_CACHE.get("value")
    cached_expires_at = float(_RELEASE_CACHE.get("expires_at") or 0.0)
    if isinstance(cached_value, dict) and cached_expires_at > now:
        return copy.deepcopy(cached_value)

    with _RELEASE_CACHE_LOCK:
        now = monotonic()
        cached_value = _RELEASE_CACHE.get("value")
        cached_expires_at = float(_RELEASE_CACHE.get("expires_at") or 0.0)
        if isinstance(cached_value, dict) and cached_expires_at > now:
            return copy.deepcopy(cached_value)

        fresh_value = _build_release_metadata_uncached()
        _RELEASE_CACHE["value"] = fresh_value
        _RELEASE_CACHE["expires_at"] = now + RELEASE_CACHE_TTL_SECONDS
        return copy.deepcopy(fresh_value)


def _platform_label() -> str:
    platform_parts = [str(platform.system() or "").strip(), str(platform.release() or "").strip()]
    label = " ".join(part for part in platform_parts if part).strip()
    return label or platform.platform()


def _short_user_id(user_id: str) -> str:
    clean_user_id = str(user_id or "")
    return f"{clean_user_id[:8]}..." if len(clean_user_id) > 8 else clean_user_id


def _build_runtime_metadata() -> dict[str, str]:
    return {
        "python_version": platform.python_version(),
        "platform": _platform_label(),
        "platform_system": str(platform.system() or ""),
        "platform_release": str(platform.release() or ""),
    }


def _build_user_metadata(request: Request, holdings_user_id: str, snapshot_user_id: str) -> dict[str, Any]:
    user_id = get_user_id(request)
    return {
        "user_id": user_id,
        "user_id_short": _short_user_id(user_id),
        "username": get_username(request),
        "is_admin": is_admin(request),
        "holdings_scope_user_id": holdings_user_id,
        "snapshot_scope_user_id": snapshot_user_id,
    }


def _build_system_observation(
    request: Request,
    *,
    release: dict[str, Any],
    holdings_user_id: str,
    snapshot_user_id: str,
    snapshot: dict[str, Any] | None,
) -> dict[str, Any]:
    runtime = _build_runtime_metadata()
    current_release = release.get("current") if isinstance(release, dict) else None
    current_release = current_release if isinstance(current_release, dict) else {}
    version = str(current_release.get("version") or "unknown")
    commit = str(current_release.get("commit") or "")

    return {
        "schema_version": SCHEMA_VERSION,
        "service": SERVICE_NAME,
        "version": version,
        "commit": commit,
        "server_time": datetime.now().astimezone().isoformat(),
        "request_id": str(getattr(request.state, "request_id", "") or ""),
        "server_elapsed_ms": 0,
        "python_version": runtime["python_version"],
        "platform": runtime["platform"],
        "runtime": runtime,
        "release": release,
        "user": _build_user_metadata(request, holdings_user_id, snapshot_user_id),
        "snapshot": snapshot,
        "recent_requests": get_recent_request_metrics(limit=5),
    }


def _set_server_elapsed_ms(payload: dict[str, Any], started_at: float) -> None:
    payload["server_elapsed_ms"] = max(0, int((perf_counter() - started_at) * 1000))


def _build_diagnostic_text(payload: dict[str, Any]) -> str:
    release = payload.get("release") if isinstance(payload.get("release"), dict) else {}
    release = release if isinstance(release, dict) else {}
    current_release = release.get("current") if isinstance(release.get("current"), dict) else {}
    current_release = current_release if isinstance(current_release, dict) else {}
    online_reference = release.get("online_reference") if isinstance(release.get("online_reference"), dict) else {}
    online_reference = online_reference if isinstance(online_reference, dict) else {}
    compare_with_online = release.get("compare_with_online") if isinstance(release.get("compare_with_online"), dict) else {}
    compare_with_online = compare_with_online if isinstance(compare_with_online, dict) else {}
    cache_info = release.get("cache") if isinstance(release.get("cache"), dict) else {}
    cache_info = cache_info if isinstance(cache_info, dict) else {}
    user = payload.get("user") if isinstance(payload.get("user"), dict) else {}
    user = user if isinstance(user, dict) else {}
    sqlite = payload.get("sqlite") if isinstance(payload.get("sqlite"), dict) else {}
    sqlite = sqlite if isinstance(sqlite, dict) else {}
    sqlite_db = sqlite.get("db_file") if isinstance(sqlite.get("db_file"), dict) else {}
    sqlite_db = sqlite_db if isinstance(sqlite_db, dict) else {}
    sqlite_derived = sqlite.get("derived") if isinstance(sqlite.get("derived"), dict) else {}
    sqlite_derived = sqlite_derived if isinstance(sqlite_derived, dict) else {}
    observations = sqlite_derived.get("observations") if isinstance(sqlite_derived.get("observations"), list) else []
    observations = [str(item) for item in observations if str(item).strip()]
    recent_requests = payload.get("recent_requests") if isinstance(payload.get("recent_requests"), list) else []
    recent_requests = [item for item in recent_requests if isinstance(item, dict)]

    diag_lines = [
        "=== VectorControl Diagnostics ===",
        f"Time: {payload.get('server_time', '')}",
        f"Request ID: {payload.get('request_id', '')}",
        f"Schema: {payload.get('schema_version', '')}",
        f"Service: {payload.get('service', '')}",
        f"Version: {payload.get('version', '')}",
        f"Commit: {payload.get('commit', '')}",
        f"Branch: {current_release.get('branch', '') or 'unknown'}",
        f"Python: {payload.get('python_version', '')}",
        f"Platform: {payload.get('platform', '')}",
        f"Server Elapsed: {payload.get('server_elapsed_ms', 0)}ms",
        "",
        "=== Release Compare ===",
        f"Online Version: {online_reference.get('version', '') or 'unknown'}",
        f"Online Commit: {online_reference.get('commit', '') or 'unknown'}",
        f"Compare Base: {compare_with_online.get('base_ref', '') or 'unknown'}",
        f"Status: {compare_with_online.get('status', 'unknown')}",
        f"Ahead: {compare_with_online.get('ahead', 0)}",
        f"Behind: {compare_with_online.get('behind', 0)}",
        f"Release Cache Generated: {cache_info.get('generated_at', '') or 'unknown'}",
        "",
        "=== User Info ===",
        f"Username: {user.get('username', '')}",
        f"User ID: {user.get('user_id_short', '')}",
        f"Is Admin: {'true' if user.get('is_admin') else 'false'}",
        "",
        "=== SQLite ===",
        f"DB Path: {sqlite_db.get('path', '')}",
        f"DB Exists: {'true' if sqlite_db.get('exists') else 'false'}",
        f"DB Size Bytes: {sqlite_db.get('size_bytes', 0)}",
        f"DB Modified At: {sqlite_db.get('modified_at', '') or 'unknown'}",
        f"DB Dir Writable: {'true' if sqlite.get('db_dir', {}).get('writable') else 'false'}",
        f"Journal Mode: {sqlite.get('journal_mode', '') or 'unknown'}",
        f"Busy Timeout: {sqlite.get('busy_timeout_ms', 0)}ms",
        f"Synchronous: {sqlite.get('synchronous', '') or 'unknown'}",
        f"WAL Autocheckpoint Pages: {sqlite.get('wal_autocheckpoint_pages', 0)}",
        f"Page Size: {sqlite.get('page_size', 0)}",
        f"Page Count: {sqlite.get('page_count', 0)}",
        f"Freelist Count: {sqlite.get('freelist_count', 0)}",
        f"Free Ratio: {sqlite_derived.get('free_ratio_pct', 0)}%",
        f"Persistence Mode: {sqlite_derived.get('persistence_mode', '') or 'unknown'}",
        f"WAL State: {sqlite_derived.get('wal_state', '') or 'unknown'}",
        f"Lock Risk: {sqlite_derived.get('lock_risk', '') or 'unknown'}",
        f"Observations: {', '.join(observations) if observations else 'none'}",
        "",
        "=== Recent Requests ===",
        *(
            [
                f"{str(item.get('time') or '')} | {str(item.get('method') or '').upper()} {str(item.get('path') or '')} | status={item.get('status_code')} | elapsed={item.get('server_elapsed_ms')}ms | request_id={item.get('request_id')}"
                for item in recent_requests
            ]
            or ["none"]
        ),
        "",
        "=== END ===",
    ]
    return "\n".join(diag_lines)


@router.get("/status")
async def get_system_status(request: Request) -> dict[str, Any]:
    request_started = perf_counter()
    holdings_user_id = get_holdings_user_id(request)
    snapshot_user_id = get_snapshot_user_id(request)
    snapshot = get_system_status_snapshot(
        holdings_user_id=holdings_user_id,
        snapshot_user_id=snapshot_user_id,
    )
    release = _get_cached_release_metadata()
    payload = _build_system_observation(
        request,
        release=release,
        holdings_user_id=holdings_user_id,
        snapshot_user_id=snapshot_user_id,
        snapshot=snapshot,
    )
    payload["sqlite"] = get_sqlite_observability_snapshot()
    _set_server_elapsed_ms(payload, request_started)
    return payload


@router.get("/diagnostics")
async def get_system_diagnostics(request: Request) -> dict[str, Any]:
    """获取可复制的系统诊断信息（用于问题排查）"""
    request_started = perf_counter()
    holdings_user_id = get_holdings_user_id(request)
    snapshot_user_id = get_snapshot_user_id(request)
    release = _get_cached_release_metadata()
    structured = _build_system_observation(
        request,
        release=release,
        holdings_user_id=holdings_user_id,
        snapshot_user_id=snapshot_user_id,
        snapshot=None,
    )
    structured["sqlite"] = get_sqlite_observability_snapshot()
    _set_server_elapsed_ms(structured, request_started)
    diagnostic_text = _build_diagnostic_text(structured)

    return {
        "diagnostic_text": diagnostic_text,
        "request_id": structured["request_id"],
        "server_time": structured["server_time"],
        "server_elapsed_ms": structured["server_elapsed_ms"],
        "structured": structured,
    }
