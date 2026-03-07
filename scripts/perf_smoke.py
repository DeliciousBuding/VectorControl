#!/usr/bin/env python3
from __future__ import annotations

import http.client
import json
import os
import socket
import subprocess
import sys
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"
OUTPUT_DIR = REPO_ROOT / ".perf" / "perf_smoke"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_http(url: str, timeout_seconds: float = 30.0) -> None:
    deadline = time.time() + timeout_seconds
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=2) as response:
                if 200 <= int(response.status) < 500:
                    return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
        time.sleep(0.5)
    raise RuntimeError(f"等待服务超时: {url}; last_error={last_error}")


def ensure_frontend_dist() -> None:
    npm_executable = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.run([npm_executable, "--prefix", "frontend", "run", "build"], cwd=REPO_ROOT, check=True)


def spawn_backend(port: int) -> subprocess.Popen:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT / "backend")
    env.pop("API_TOKEN", None)
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=REPO_ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


class ProxyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIST), **kwargs)

    def log_message(self, format, *args):  # noqa: A003
        return

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/api/"):
            self._proxy_request()
            return
        return super().do_GET()

    def do_POST(self):  # noqa: N802
        if self.path.startswith("/api/"):
            self._proxy_request()
            return
        self.send_error(405, "Method Not Allowed")

    def send_head(self):
        target_path = Path(self.translate_path(self.path))
        if self.path == "/" or (not target_path.exists() and not self.path.startswith("/api/")):
            self.path = "/index.html"
        return super().send_head()

    def _proxy_request(self) -> None:
        connection = http.client.HTTPConnection("127.0.0.1", self.server.backend_port, timeout=15)
        try:
            headers = {key: value for key, value in self.headers.items()}
            body = None
            content_length = int(self.headers.get("Content-Length", "0") or "0")
            if content_length > 0:
                body = self.rfile.read(content_length)
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            payload = response.read()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() in {"transfer-encoding", "connection"}:
                    continue
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(payload)
        finally:
            connection.close()


def start_frontend_server(frontend_port: int, backend_port: int) -> tuple[ThreadingHTTPServer, threading.Thread]:
    server = ThreadingHTTPServer(("127.0.0.1", frontend_port), ProxyHandler)
    server.backend_port = backend_port  # type: ignore[attr-defined]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def register_user(backend_port: int) -> str:
    username = f"perf_{uuid.uuid4().hex[:10]}"
    password = "pass_123456"
    request = Request(
        f"http://127.0.0.1:{backend_port}/api/auth/register",
        data=json.dumps({"username": username, "password": password}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return str(payload["token"])


def run_runner(config_path: Path) -> Path:
    completed = subprocess.run(
        ["node", str(REPO_ROOT / "scripts" / "perf_smoke_runner.cjs"), str(config_path)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or "perf_smoke_runner failed").strip())
    return Path(str(completed.stdout).strip().splitlines()[-1])


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ensure_frontend_dist()
    backend_port = find_free_port()
    frontend_port = find_free_port()
    base_url = f"http://127.0.0.1:{frontend_port}"

    backend_proc = spawn_backend(backend_port)
    frontend_server, frontend_thread = start_frontend_server(frontend_port, backend_port)
    try:
        wait_http(f"http://127.0.0.1:{backend_port}/api/healthz")
        wait_http(base_url)
        token = register_user(backend_port)

        latest_output = OUTPUT_DIR / "latest.json"
        timestamped_output = OUTPUT_DIR / f"perf-smoke-{time.strftime('%Y%m%d-%H%M%S')}.json"
        config_path = OUTPUT_DIR / "runner-config.json"
        config = {
            "baseUrl": base_url,
            "token": token,
            "outputPath": str(latest_output),
            "routes": [
                {"name": "home", "path": "/", "selector": "[data-testid='portfolio-returns-panel']"},
                {"name": "fund_detail", "path": "/fund/016453", "selector": ".fund-detail-page"},
                {"name": "system_status", "path": "/system/status", "selector": ".trade-grid button.primary"},
            ],
        }
        config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
        result_path = run_runner(config_path)
        payload = json.loads(result_path.read_text(encoding="utf-8"))
        timestamped_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[OK] perf_smoke 完成: {timestamped_output}")
        for route in payload.get("routes", []):
            print(
                f"- {route.get('name')}: ready={route.get('readyMs')}ms "
                f"domContentLoaded={route.get('domContentLoadedMs')}ms load={route.get('loadEventMs')}ms"
            )
        return 0
    finally:
        try:
            frontend_server.shutdown()
            frontend_server.server_close()
        except Exception:  # noqa: BLE001
            pass
        if frontend_thread.is_alive():
            frontend_thread.join(timeout=1)
        try:
            backend_proc.terminate()
        except Exception:  # noqa: BLE001
            pass
        time.sleep(0.5)
        try:
            backend_proc.kill()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    raise SystemExit(main())
