from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from urllib import error, request


ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
BASE_BACKEND = "http://127.0.0.1:21345"
BASE_FRONTEND = "http://127.0.0.1:5173"


def _wait_http(url: str, timeout: float = 30.0) -> bool:
    started = time.time()
    while time.time() - started < timeout:
        try:
            with request.urlopen(url, timeout=3) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def _run(cmd: list[str], cwd: Path) -> subprocess.Popen:
    real_cmd = cmd
    if os.name == "nt" and cmd and cmd[0].lower() in {"npm", "npx"}:
        real_cmd = ["cmd", "/c", *cmd]
    return subprocess.Popen(
        real_cmd,
        cwd=str(cwd),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )


def _check_frontend() -> None:
    try:
        with request.urlopen(BASE_FRONTEND, timeout=5) as resp:
            if resp.status != 200:
                raise RuntimeError(f"前端状态码异常: {resp.status}")
    except error.URLError as exc:
        raise RuntimeError(f"前端访问失败: {exc}") from exc


def main() -> int:
    backend = None
    frontend = None
    try:
        print("[INFO] 启动后端服务...")
        backend = _run(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "21345"],
            BACKEND_DIR,
        )
        if not _wait_http(f"{BASE_BACKEND}/api/health", timeout=25):
            raise RuntimeError("后端未在预期时间内就绪")
        print("[PASS] 后端健康检查就绪")

        print("[INFO] 启动前端服务...")
        frontend = _run(["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], FRONTEND_DIR)
        if not _wait_http(BASE_FRONTEND, timeout=40):
            raise RuntimeError("前端未在预期时间内就绪")
        _check_frontend()
        print("[PASS] 前端页面可访问")

        print("[INFO] 执行 Gate-A 自动验收脚本...")
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "check_gate_a.py")],
            cwd=str(ROOT),
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError("Gate-A 自动验收脚本失败")
        print("[PASS] Gate-A 验收脚本通过")

        print("[INFO] Gate-A 新机器复现闭环检查通过")
        return 0
    finally:
        if frontend and frontend.poll() is None:
            frontend.terminate()
            try:
                frontend.wait(timeout=5)
            except subprocess.TimeoutExpired:
                frontend.kill()
        if backend and backend.poll() is None:
            backend.terminate()
            try:
                backend.wait(timeout=5)
            except subprocess.TimeoutExpired:
                backend.kill()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] {exc}")
        raise SystemExit(1)
