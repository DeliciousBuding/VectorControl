from __future__ import annotations

import os
import platform
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Request

from app.api.deps import get_holdings_user_id, get_snapshot_user_id, get_user_id, get_username, is_admin
from app.storage.db import get_system_status_snapshot

router = APIRouter(prefix="/api/system", tags=["系统"])


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


def _read_version() -> str:
    env_version = str(os.getenv("APP_VERSION", "") or os.getenv("VC_APP_VERSION", "")).strip()
    if env_version:
        return env_version
    version_file = _repo_root() / "VERSION"
    try:
        text = version_file.read_text(encoding="utf-8").strip()
        return text if text else "unknown"
    except Exception:  # noqa: BLE001
        return "unknown"


def _read_commit_short() -> str:
    env_commit = str(os.getenv("APP_COMMIT", "") or os.getenv("VC_APP_COMMIT", "")).strip()
    if env_commit:
        return env_commit[:12]
    return _git_ref_short("HEAD")


def _build_release_compare() -> dict:
    online_version = str(os.getenv("VC_ONLINE_VERSION", "")).strip()
    online_commit_env = str(os.getenv("VC_ONLINE_COMMIT", "")).strip()
    main_ref_commit = _git_ref_short("origin/main") or _git_ref_short("main")
    main_commit = online_commit_env or main_ref_commit

    status = "unknown"
    ahead = 0
    behind = 0
    compare_base = "origin/main" if _git_ref_short("origin/main") else ("main" if _git_ref_short("main") else "")
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

    return {
        "online_reference": {
            "version": online_version,
            "commit": main_commit,
            "source": "env" if online_commit_env else ("git_ref" if main_ref_commit else "unknown"),
        },
        "compare_with_online": {
            "status": status,
            "ahead": ahead,
            "behind": behind,
        },
    }


@router.get("/status")
async def get_system_status(request: Request) -> dict:
    holdings_user_id = get_holdings_user_id(request)
    snapshot_user_id = get_snapshot_user_id(request)
    snapshot = get_system_status_snapshot(
        holdings_user_id=holdings_user_id,
        snapshot_user_id=snapshot_user_id,
    )
    version = _read_version()
    commit = _read_commit_short()
    release_compare = _build_release_compare()

    return {
        "service": "vectorcontrol-backend",
        "version": version,
        "commit": commit,
        "server_time": datetime.now().astimezone().isoformat(),
        "python_version": platform.python_version(),
        "release": {
            "current": {
                "version": version,
                "commit": commit,
            },
            **release_compare,
        },
        "user": {
            "user_id": get_user_id(request),
            "username": get_username(request),
            "is_admin": is_admin(request),
            "holdings_scope_user_id": holdings_user_id,
            "snapshot_scope_user_id": snapshot_user_id,
        },
        "snapshot": snapshot,
    }


@router.get("/diagnostics")
async def get_system_diagnostics(request: Request) -> dict:
    """获取可复制的系统诊断信息（用于问题排查）"""
    version = _read_version()
    commit = _read_commit_short()
    release_compare = _build_release_compare()
    user_id = get_user_id(request)
    username = get_username(request)

    # 构建可复制的诊断文本
    diag_lines = [
        "=== VectorControl Diagnostics ===",
        f"Time: {datetime.now().astimezone().isoformat()}",
        f"Service: vectorcontrol-backend",
        f"Version: {version}",
        f"Commit: {commit}",
        f"Python: {platform.python_version()}",
        f"Platform: {platform.system()} {platform.release()}",
        "",
        "=== Release Compare ===",
        f"Status: {release_compare.get('compare_with_online', {}).get('status', 'unknown')}",
        f"Ahead: {release_compare.get('compare_with_online', {}).get('ahead', 0)}",
        f"Behind: {release_compare.get('compare_with_online', {}).get('behind', 0)}",
        "",
        "=== User Info ===",
        f"Username: {username}",
        f"User ID: {user_id[:8]}..." if len(user_id) > 8 else f"User ID: {user_id}",
        "",
        "=== END ===",
    ]

    return {
        "diagnostic_text": "\n".join(diag_lines),
        "structured": {
            "service": "vectorcontrol-backend",
            "version": version,
            "commit": commit,
            "server_time": datetime.now().astimezone().isoformat(),
            "python_version": platform.python_version(),
            "platform": f"{platform.system()} {platform.release()}",
            "release": release_compare,
            "user": {
                "username": username,
                "user_id_short": user_id[:8] + "..." if len(user_id) > 8 else user_id,
            },
        },
    }
