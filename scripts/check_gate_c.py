from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from urllib import error, request


BACKEND_URL = os.getenv("VECTORCONTROL_BASE_URL", "http://127.0.0.1:21345")
ROOT = Path(__file__).resolve().parent.parent


def _http(method: str, url: str, token: str | None = None, payload: dict | None = None) -> tuple[int, dict]:
    data = None
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = request.Request(url=url, method=method.upper(), headers=headers, data=data)
    try:
        with request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, json.loads(text) if text else {}
    except error.HTTPError as exc:
        text = exc.read().decode("utf-8")
        return exc.code, json.loads(text) if text else {}


def _assert(name: str, ok: bool) -> None:
    if not ok:
        raise AssertionError(name)
    print(f"[PASS] {name}")


def _read_runtime_token() -> str:
    token_file = ROOT / "backend" / "data" / "runtime_token.txt"
    if token_file.exists():
        return token_file.read_text(encoding="utf-8").strip()
    return ""


def _get_token() -> str:
    suffix = uuid.uuid4().hex[:8]
    status, body = _http(
        "POST",
        f"{BACKEND_URL}/api/auth/register",
        payload={"username": f"gatec_{suffix}", "password": "pass_123456"},
    )
    if status == 200 and body.get("token"):
        print("[PASS] 注册会话成功")
        return str(body["token"])

    username = os.getenv("VECTORCONTROL_GATE_C_USERNAME", "").strip()
    password = os.getenv("VECTORCONTROL_GATE_C_PASSWORD", "").strip()
    if username and password:
        login_status, login_body = _http(
            "POST",
            f"{BACKEND_URL}/api/auth/login",
            payload={"username": username, "password": password},
        )
        if login_status == 200 and login_body.get("token"):
            print("[PASS] 登录会话成功")
            return str(login_body["token"])

    token = _read_runtime_token()
    _assert("注册受限时可回退 runtime token", bool(token))
    return token


def main() -> int:
    print(f"[INFO] Gate-C 检查目标: backend={BACKEND_URL}")
    token = _get_token()
    today = datetime.now().astimezone().date().isoformat()

    status, body = _http(
        "POST",
        f"{BACKEND_URL}/api/holdings",
        token=token,
        payload={
            "fund_id": "999999",
            "name": "降级测试基金",
            "bucket": "tech",
            "market_group": "us_overseas",
            "market_value_cny": 10,
            "cost_basis_cny": 10,
            "start_date": today,
        },
    )
    _assert(f"/api/holdings 写入降级测试数据成功(status={status}, body={body})", status == 200)

    status, body = _http("GET", f"{BACKEND_URL}/api/estimate", token=token)
    _assert("/api/estimate 可用", status == 200)

    coverage = body.get("coverage", {})
    _assert("coverage 字段存在", all(key in coverage for key in ["total", "ok", "failed"]))
    total = int(coverage.get("total", 0))
    ok = int(coverage.get("ok", 0))
    failed = int(coverage.get("failed", 0))
    _assert("coverage.total = ok + failed", total == ok + failed)
    _assert("存在失败基金用于降级验证", failed >= 1)

    funds = body.get("funds", [])
    failed_funds = [item for item in funds if str(item.get("status")) != "ok"]
    _assert("失败基金包含 reason", any(str(item.get("reason", "")).strip() for item in failed_funds))

    status, _ = _http("GET", f"{BACKEND_URL}/api/advice", token=token)
    _assert("降级后 /api/advice 仍可用", status == 200)
    status, _ = _http("GET", f"{BACKEND_URL}/api/report/daily", token=token)
    _assert("降级后 /api/report/daily 仍可用", status == 200)

    print("[INFO] Gate-C 检查通过（覆盖率可见 + 部分失败不阻断）")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"[FAIL] {exc}")
        raise SystemExit(1)
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] 未预期异常: {exc}")
        raise SystemExit(1)
