from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from urllib import request


ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

BACKEND_PORT = int(os.getenv("VECTORCONTROL_GATE_B_BACKEND_PORT", "21445"))
FRONTEND_PORT = int(os.getenv("VECTORCONTROL_GATE_B_FRONTEND_PORT", "5178"))
BASE_BACKEND = f"http://127.0.0.1:{BACKEND_PORT}"
BASE_FRONTEND = f"http://127.0.0.1:{FRONTEND_PORT}"


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


def _assert_process_running(name: str, process: subprocess.Popen) -> None:
    rc = process.poll()
    if rc is not None:
        raise RuntimeError(f"{name}启动失败（进程提前退出，返回码={rc}）")


def main() -> int:
    backend = None
    frontend = None
    try:
        print(f"[INFO] 启动后端服务（端口 {BACKEND_PORT}）...")
        backend = _run(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(BACKEND_PORT),
            ],
            BACKEND_DIR,
        )
        time.sleep(0.6)
        _assert_process_running("后端", backend)
        if not _wait_http(f"{BASE_BACKEND}/api/health", timeout=25):
            raise RuntimeError("后端未在预期时间内就绪")
        print("[PASS] 后端健康检查就绪")

        print(f"[INFO] 启动前端服务（端口 {FRONTEND_PORT}）...")
        frontend = _run(["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(FRONTEND_PORT)], FRONTEND_DIR)
        time.sleep(1.0)
        _assert_process_running("前端", frontend)
        if not _wait_http(BASE_FRONTEND, timeout=50):
            raise RuntimeError("前端未在预期时间内就绪")
        print("[PASS] 前端页面可访问")

        print("[INFO] 执行 Gate-B 自动验收脚本...")
        env = os.environ.copy()
        env["VECTORCONTROL_BASE_URL"] = BASE_BACKEND
        env["VECTORCONTROL_FRONTEND_URL"] = BASE_FRONTEND
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "check_gate_b.py")],
            cwd=str(ROOT),
            check=False,
            env=env,
        )
        if result.returncode != 0:
            raise RuntimeError("Gate-B 自动验收脚本失败")
        print("[PASS] Gate-B 验收脚本通过")

        print("[INFO] Gate-B 主路径闭环检查通过")
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
