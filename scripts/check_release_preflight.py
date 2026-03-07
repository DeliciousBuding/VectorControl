#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
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



def run_step(name: str, command: list[str], *, env: dict[str, str] | None = None) -> int:
    printable = " ".join(command)
    print(f"[RUN] {name}: {printable}")
    resolved_env = env.copy() if env is not None else os.environ.copy()
    executable = shutil.which(command[0], path=resolved_env.get("PATH")) or command[0]
    completed = subprocess.run([executable, *command[1:]], cwd=REPO_ROOT, check=False, env=resolved_env)
    if completed.returncode != 0:
        print(f"[FAIL] {name}")
        return completed.returncode
    print(f"[OK] {name}")
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

    for name, command, env in steps:
        result = run_step(name, command, env=env)
        if result != 0:
            return result

    print("[OK] release preflight 通过。")
    return 0



if __name__ == "__main__":
    sys.exit(main())
