from __future__ import annotations

import json
import os
import sys
import uuid
from urllib import error, request


BASE_URL = os.getenv("VECTORCONTROL_BASE_URL", "http://127.0.0.1:21345")


def _http(method: str, path: str, token: str | None = None, payload: dict | None = None) -> tuple[int, dict]:
    url = f"{BASE_URL}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, method=method.upper(), headers=headers, data=data)
    try:
        with request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8")
            body = json.loads(text) if text else {}
            return resp.status, body
    except error.HTTPError as exc:
        text = exc.read().decode("utf-8")
        body = json.loads(text) if text else {}
        return exc.code, body


def _assert(name: str, cond: bool) -> None:
    if not cond:
        raise AssertionError(name)
    print(f"[PASS] {name}")


def main() -> int:
    print(f"[INFO] Gate-A 检查目标: {BASE_URL}")

    status, _ = _http("GET", "/api/health")
    _assert("/api/health = 200", status == 200)

    status, _ = _http("GET", "/api/config")
    _assert("未登录访问 /api/config = 401", status == 401)

    suffix = uuid.uuid4().hex[:8]
    user_a = f"gatea_{suffix}_a"
    user_b = f"gatea_{suffix}_b"
    password = "pass_123456"

    status, body = _http("POST", "/api/auth/register", payload={"username": user_a, "password": password})
    _assert("用户A注册成功", status == 200 and bool(body.get("token")))
    token_a = str(body["token"])

    status, body = _http("POST", "/api/auth/register", payload={"username": user_b, "password": password})
    _assert("用户B注册成功", status == 200 and bool(body.get("token")))
    token_b = str(body["token"])

    fund_id = f"G{uuid.uuid4().hex[:5].upper()}"
    status, _ = _http(
        "POST",
        "/api/holdings",
        token=token_a,
        payload={
            "fund_id": fund_id,
            "name": "GateA隔离验证基金",
            "bucket": "consumer",
            "market_group": "cn_hk",
            "market_value_cny": 100,
            "cost_basis_cny": 90,
        },
    )
    _assert("用户A创建持仓成功", status == 200)

    status, body = _http("GET", "/api/holdings", token=token_a)
    ids_a = {row.get("fund_id") for row in body.get("holdings", [])}
    _assert("用户A能看到自己的持仓", status == 200 and fund_id in ids_a)

    status, body = _http("GET", "/api/holdings", token=token_b)
    ids_b = {row.get("fund_id") for row in body.get("holdings", [])}
    _assert("用户B看不到用户A持仓", status == 200 and fund_id not in ids_b)

    print("[INFO] Gate-A 检查通过")
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

