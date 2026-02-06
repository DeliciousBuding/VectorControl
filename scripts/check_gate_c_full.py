from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from urllib import request


ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
BACKEND_PORT = int(os.getenv("VECTORCONTROL_GATE_C_BACKEND_PORT", "21446"))
BASE_BACKEND = f"http://127.0.0.1:{BACKEND_PORT}"


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

        print("[INFO] 执行 Gate-C 自动验收脚本...")
        env = os.environ.copy()
        env["VECTORCONTROL_BASE_URL"] = BASE_BACKEND
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "check_gate_c.py")],
            cwd=str(ROOT),
            check=False,
            env=env,
        )
        if result.returncode != 0:
            raise RuntimeError("Gate-C 自动验收脚本失败")
        print("[PASS] Gate-C 验收脚本通过")
        print("[INFO] Gate-C 降级可视化检查通过")
        return 0
    finally:
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
