#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_SMOKE_TESTS = [
    "backend/app/api/test_healthz_smoke.py",
    "backend/app/api/test_request_id_middleware_smoke.py",
    "backend/app/api/test_app_assembly_smoke.py",
    "backend/app/storage/test_catalog_sync_smoke.py",
    "backend/app/api/test_auth_isolation_smoke.py::AuthIsolationSmokeTest::test_auth_guard_401",
    "backend/app/api/test_secrets_leak_guard_smoke.py",
]



def run_step(name: str, command: list[str], *, env: dict[str, str] | None = None, capture: bool = False):
    printable = " ".join(command)
    print(f"[RUN] {name}: {printable}")
    resolved_env = env.copy() if env is not None else os.environ.copy()
    executable = shutil.which(command[0], path=resolved_env.get("PATH")) or command[0]
    started_at = time.perf_counter()
    completed = subprocess.run(
        [executable, *command[1:]],
        cwd=REPO_ROOT,
        check=False,
        env=resolved_env,
        capture_output=capture,
        text=capture,
        encoding="utf-8" if capture else None,
        errors="replace" if capture else None,
    )
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    if capture:
        return {
            "name": name,
            "returncode": completed.returncode,
            "stdout": completed.stdout or "",
            "stderr": completed.stderr or "",
            "duration_ms": duration_ms,
        }
    if completed.returncode != 0:
        print(f"[FAIL] {name} ({duration_ms}ms)")
        return completed.returncode
    print(f"[OK] {name} ({duration_ms}ms)")
    return 0


def _print_captured_result(result: dict[str, object]) -> int:
    def _safe_write(text: str, *, stream) -> None:
        if not text:
            return
        target = stream.buffer if hasattr(stream, "buffer") else stream
        data = text.encode(getattr(stream, "encoding", "utf-8") or "utf-8", errors="replace")
        if hasattr(target, "write"):
            target.write(data if target is not stream else text)
        if hasattr(target, "flush"):
            target.flush()

    stdout = str(result.get("stdout") or "")
    stderr = str(result.get("stderr") or "")
    if stdout:
        _safe_write(stdout if stdout.endswith("\n") else stdout + "\n", stream=sys.stdout)
    if stderr:
        _safe_write(stderr if stderr.endswith("\n") else stderr + "\n", stream=sys.stderr)
    name = str(result.get("name") or "")
    duration_ms = int(result.get("duration_ms") or 0)
    returncode = int(result.get("returncode") or 0)
    if returncode != 0:
        print(f"[FAIL] {name} ({duration_ms}ms)")
        return returncode
    print(f"[OK] {name} ({duration_ms}ms)")
    return 0



def main() -> int:
    base_env = os.environ.copy()
    backend_pythonpath = str(REPO_ROOT / "backend")
    base_env["PYTHONPATH"] = (
        backend_pythonpath
        if not base_env.get("PYTHONPATH")
        else backend_pythonpath + os.pathsep + base_env["PYTHONPATH"]
    )

    steps = [
        ("Docs Gate", [sys.executable, "scripts/check_docs_gate.py", "--strict"], None),
        ("Secrets Leak Scan", [sys.executable, "scripts/check_secrets_leak.py"], None),
        ("Backend Compileall", [sys.executable, "-m", "compileall", "backend/app"], None),
        (
            "Backend Smoke Tests",
            [sys.executable, "-m", "pytest", "-q", *BACKEND_SMOKE_TESTS],
            base_env,
        ),
        ("Frontend Tests", ["npm", "--prefix", "frontend", "run", "test:run"], None),
        ("Frontend Build", ["npm", "--prefix", "frontend", "run", "build"], None),
    ]

    parallel_steps = steps[:3]
    remaining_steps = steps[3:]

    with ThreadPoolExecutor(max_workers=len(parallel_steps)) as executor:
        futures = [executor.submit(run_step, name, command, env=env, capture=True) for name, command, env in parallel_steps]
        parallel_results = [future.result() for future in futures]

    for result in parallel_results:
        status = _print_captured_result(result)
        if status != 0:
            return status

    for name, command, env in remaining_steps:
        result = run_step(name, command, env=env)
        if result != 0:
            return result

    print("[OK] release preflight 通过。")
    return 0



if __name__ == "__main__":
    sys.exit(main())
