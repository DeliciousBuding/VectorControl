from __future__ import annotations

import os
import platform
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Query, Request

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


@router.get("/backup/status")
async def get_backup_status(request: Request) -> dict:
    """获取数据备份状态"""
    from app.core.settings import DATA_DIR
    from app.storage.db import DB_PATH
    
    backup_dir = DATA_DIR / "backups"
    backups = []
    
    if backup_dir.exists():
        for backup_file in sorted(backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True):
            stat = backup_file.stat()
            backups.append({
                "filename": backup_file.name,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(),
            })
    
    return {
        "db_path": str(DB_PATH),
        "db_exists": DB_PATH.exists(),
        "backup_dir": str(backup_dir),
        "backup_count": len(backups),
        "backups": backups[:20],
    }


@router.post("/backup/create")
async def create_backup(request: Request) -> dict:
    """创建数据备份"""
    import shutil
    from app.core.settings import DATA_DIR
    from app.storage.db import DB_PATH
    
    if not DB_PATH.exists():
        return {
            "success": False,
            "error": "数据库文件不存在",
        }
    
    backup_dir = DATA_DIR / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"app_backup_{timestamp}.db"
    backup_path = backup_dir / backup_filename
    
    try:
        shutil.copy2(DB_PATH, backup_path)
        stat = backup_path.stat()
        
        return {
            "success": True,
            "backup": {
                "filename": backup_filename,
                "path": str(backup_path),
                "size_bytes": stat.st_size,
                "created_at": datetime.now().astimezone().isoformat(),
            },
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/backup/restore")
async def restore_backup(request: Request, backup_filename: str) -> dict:
    """从备份恢复数据"""
    import shutil
    from app.core.settings import DATA_DIR
    from app.storage.db import DB_PATH
    
    backup_dir = DATA_DIR / "backups"
    backup_path = backup_dir / backup_filename
    
    if not backup_path.exists():
        return {
            "success": False,
            "error": f"备份文件不存在: {backup_filename}",
        }
    
    try:
        if DB_PATH.exists():
            pre_restore_backup = DB_PATH.with_suffix(".db.pre_restore")
            shutil.copy2(DB_PATH, pre_restore_backup)
        
        shutil.copy2(backup_path, DB_PATH)
        
        return {
            "success": True,
            "restored_from": backup_filename,
            "restored_at": datetime.now().astimezone().isoformat(),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.delete("/backup/{backup_filename}")
async def delete_backup(request: Request, backup_filename: str) -> dict:
    """删除备份文件"""
    from app.core.settings import DATA_DIR
    
    backup_dir = DATA_DIR / "backups"
    backup_path = backup_dir / backup_filename
    
    if not backup_path.exists():
        return {
            "success": False,
            "error": f"备份文件不存在: {backup_filename}",
        }
    
    try:
        backup_path.unlink()
        return {
            "success": True,
            "deleted": backup_filename,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/logs")
async def get_system_logs(
    request: Request,
    lines: int = Query(default=100, ge=1, le=1000, description="返回的日志行数"),
    level: str = Query(default="all", description="日志级别过滤: all/debug/info/warning/error"),
) -> dict:
    """获取系统日志"""
    from app.core.settings import DATA_DIR
    
    log_files = [
        DATA_DIR / "logs" / "backend.log",
        DATA_DIR / "logs" / "app.log",
        DATA_DIR.parent / "backend" / "backend.log",
    ]
    
    log_content = []
    log_file_used = None
    
    for log_file in log_files:
        if log_file.exists():
            log_file_used = log_file
            try:
                with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                    all_lines = f.readlines()
                    log_content = all_lines[-lines:] if len(all_lines) > lines else all_lines
                break
            except Exception:
                continue
    
    if level != "all":
        level_upper = level.upper()
        log_content = [
            line for line in log_content
            if f" {level_upper}:" in line or f":{level_upper}:" in line
        ]
    
    return {
        "log_file": str(log_file_used) if log_file_used else None,
        "lines_requested": lines,
        "lines_returned": len(log_content),
        "level_filter": level,
        "logs": [line.rstrip("\n\r") for line in log_content],
    }


@router.get("/logs/files")
async def get_log_files(request: Request) -> dict:
    """获取日志文件列表"""
    from app.core.settings import DATA_DIR
    
    log_dirs = [
        DATA_DIR / "logs",
        DATA_DIR.parent / "backend",
    ]
    
    files = []
    for log_dir in log_dirs:
        if log_dir.exists():
            for log_file in log_dir.glob("*.log"):
                stat = log_file.stat()
                files.append({
                    "path": str(log_file),
                    "name": log_file.name,
                    "size_bytes": stat.st_size,
                    "modified_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(),
                })
    
    return {
        "files": sorted(files, key=lambda x: x["modified_at"], reverse=True),
        "count": len(files),
    }


@router.get("/request-stats")
async def get_request_stats(request: Request) -> dict:
    """获取 API 请求统计"""
    from app.main import _request_stats
    return _request_stats.get_stats()


@router.post("/request-stats/reset")
async def reset_request_stats(request: Request) -> dict:
    """重置 API 请求统计"""
    from app.main import _request_stats
    _request_stats.reset()
    return {"success": True, "message": "请求统计已重置"}
