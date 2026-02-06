from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from urllib import error, request


BACKEND_URL = os.getenv("VECTORCONTROL_BASE_URL", "http://127.0.0.1:21345")
FRONTEND_URL = os.getenv("VECTORCONTROL_FRONTEND_URL", "http://127.0.0.1:5173")
ROOT = Path(__file__).resolve().parent.parent


def _http(method: str, url: str, token: str | None = None, payload: dict | None = None) -> tuple[int, dict, dict]:
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
            body = json.loads(text) if text else {}
            return resp.status, body, dict(resp.headers)
    except error.HTTPError as exc:
        text = exc.read().decode("utf-8")
        body = json.loads(text) if text else {}
        return exc.code, body, dict(exc.headers)


def _assert(name: str, condition: bool) -> None:
    if not condition:
        raise AssertionError(name)
    print(f"[PASS] {name}")


def _assert_status(name: str, status: int, expect: int, body: dict, headers: dict | None = None) -> None:
    if status != expect:
        detail = body.get("detail") if isinstance(body, dict) else body
        allow = ""
        if headers:
            allow = headers.get("allow") or headers.get("Allow") or ""
        extra = f"，Allow={allow}" if allow else ""
        raise AssertionError(f"{name}（状态码={status}，响应={detail}{extra}）")
    print(f"[PASS] {name}")


def _check_frontend(url: str) -> bool:
    try:
        with request.urlopen(f"{url}/", timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def _read_runtime_token() -> str:
    token_file = ROOT / "backend" / "data" / "runtime_token.txt"
    if not token_file.exists():
        return ""
    return token_file.read_text(encoding="utf-8").strip()


def main() -> int:
    print(f"[INFO] Gate-B 检查目标: backend={BACKEND_URL}, frontend={FRONTEND_URL}")

    _assert("首页可访问（前端服务）", _check_frontend(FRONTEND_URL))

    suffix = uuid.uuid4().hex[:8]
    username = f"gateb_{suffix}"
    password = "pass_123456"

    status, body, headers = _http(
        "POST",
        f"{BACKEND_URL}/api/auth/register",
        payload={"username": username, "password": password},
    )
    if status == 200 and body.get("token"):
        token = str(body["token"])
        print("[PASS] 注册成功")
    else:
        token = _read_runtime_token()
        _assert("注册受限时可回退运行时 token", bool(token))

    status, body, headers = _http("GET", f"{BACKEND_URL}/api/config", token=token)
    _assert_status("/api/config 可用", status, 200, body, headers)

    status, body, headers = _http("GET", f"{BACKEND_URL}/api/estimate", token=token)
    _assert_status("/api/estimate 可用", status, 200, body, headers)
    funds = body.get("funds", []) if isinstance(body, dict) else []
    _assert("/api/estimate 返回 funds 列表", isinstance(funds, list))

    status, body, headers = _http("GET", f"{BACKEND_URL}/api/advice", token=token)
    _assert_status("/api/advice 可用", status, 200, body, headers)

    action_key = "gateb_action"
    date_str = datetime.now().astimezone().date().isoformat()
    status, body, headers = _http(
        "POST",
        f"{BACKEND_URL}/api/actions",
        token=token,
        payload={"date": date_str, "action_key": action_key, "amount": 10, "done": True},
    )
    _assert_status("交易动作写入成功", status, 200, body, headers)

    status, body, headers = _http("GET", f"{BACKEND_URL}/api/actions?date={date_str}", token=token)
    _assert_status("交易记录可查询", status, 200, body, headers)
    listed = body.get("actions", []) if isinstance(body, dict) else []
    has_action = any(str(row.get("action_key")) == action_key for row in listed)
    _assert("交易记录包含刚写入动作", has_action)

    status, body, headers = _http("GET", f"{BACKEND_URL}/api/report/daily", token=token)
    _assert_status("/api/report/daily 可用", status, 200, body, headers)

    print("[INFO] Gate-B 检查通过（首页->估值->建议->执行->记录->日报）")
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
