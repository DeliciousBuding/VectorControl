from __future__ import annotations

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


def _read_version() -> str:
    version_file = _repo_root() / "VERSION"
    try:
        text = version_file.read_text(encoding="utf-8").strip()
        return text if text else "unknown"
    except Exception:  # noqa: BLE001
        return "unknown"


def _read_commit_short() -> str:
    root = _repo_root()
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(root),
            check=True,
            capture_output=True,
            text=True,
        )
        return str(proc.stdout or "").strip()
    except Exception:  # noqa: BLE001
        return ""


@router.get("/status")
async def get_system_status(request: Request) -> dict:
    holdings_user_id = get_holdings_user_id(request)
    snapshot_user_id = get_snapshot_user_id(request)
    snapshot = get_system_status_snapshot(
        holdings_user_id=holdings_user_id,
        snapshot_user_id=snapshot_user_id,
    )

    return {
        "service": "vectorcontrol-backend",
        "version": _read_version(),
        "commit": _read_commit_short(),
        "server_time": datetime.now().astimezone().isoformat(),
        "python_version": platform.python_version(),
        "user": {
            "user_id": get_user_id(request),
            "username": get_username(request),
            "is_admin": is_admin(request),
            "holdings_scope_user_id": holdings_user_id,
            "snapshot_scope_user_id": snapshot_user_id,
        },
        "snapshot": snapshot,
    }
