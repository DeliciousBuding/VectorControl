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
APP_FILE = ROOT / "frontend" / "src" / "App.jsx"
METRICS_FILE = ROOT / "frontend" / "src" / "utils" / "metrics.js"

BACKEND_PORT = int(os.getenv("VECTORCONTROL_PERF_BACKEND_PORT", "21447"))
FRONTEND_PORT = int(os.getenv("VECTORCONTROL_PERF_FRONTEND_PORT", "5179"))
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


def _assert(name: str, ok: bool) -> None:
    if not ok:
        raise RuntimeError(name)
    print(f"[PASS] {name}")


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
        time.sleep(0.8)
        _assert_process_running("后端", backend)
        _assert("后端健康检查可用", _wait_http(f"{BASE_BACKEND}/api/health", timeout=25))

        print(f"[INFO] 启动前端服务（端口 {FRONTEND_PORT}）...")
        frontend = _run(["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(FRONTEND_PORT)], FRONTEND_DIR)
        time.sleep(1.0)
        _assert_process_running("前端", frontend)
        _assert("前端首页可访问", _wait_http(BASE_FRONTEND, timeout=40))

        source = APP_FILE.read_text(encoding="utf-8")
        metrics_source = METRICS_FILE.read_text(encoding="utf-8")
        _assert("存在骨架状态控制", "skeletonLock" in source)
        _assert("存在3秒骨架定时器", "setTimeout(() => {" in source and "}, 3000)" in source)
        _assert("存在5秒降级定时器", "}, 5000)" in source)
        _assert("存在5秒降级状态控制", "assetTimedOut" in source)
        _assert("存在性能埋点记录", "recordMetric(" in source)
        _assert("埋点事件: 首屏加载开始", "recordMetric('首屏加载开始'" in source)
        _assert("埋点事件: 首屏加载超时", "recordMetric('首屏加载超时'" in source)
        _assert("埋点事件: 资产卡更新完成", "recordMetric('资产卡更新完成'" in source)
        _assert("埋点存储键已定义", "vectorcontrol_frontend_metrics" in metrics_source)
        _assert("埋点读取接口已定义", "listMetrics" in metrics_source)

        print("[INFO] 首屏性能可测化检查通过")
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
