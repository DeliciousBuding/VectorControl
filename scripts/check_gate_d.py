#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from urllib.parse import urljoin



def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="执行 Gate-D 最小部署验收。")
    parser.add_argument("--base-url", default="http://127.0.0.1", help="被测服务基地址，默认 http://127.0.0.1")
    parser.add_argument("--timeout", type=float, default=10.0, help="请求超时时间，默认 10 秒")
    return parser.parse_args()



def request(url: str, timeout: float) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, body



def ensure(ok: bool, errors: list[str], message: str) -> None:
    if not ok:
        errors.append(message)



def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/") + "/"
    errors: list[str] = []

    home_status, _ = request(base_url, args.timeout)
    ensure(200 <= home_status < 400, errors, f"首页检查失败，状态码：{home_status}")

    health_status, health_body = request(urljoin(base_url, "api/healthz"), args.timeout)
    ensure(health_status == 200, errors, f"/api/healthz 状态码异常：{health_status}")
    if health_status == 200:
        try:
            payload = json.loads(health_body)
            ensure(payload.get("status") == "ok", errors, "/api/healthz 返回体缺少 status=ok")
        except json.JSONDecodeError:
            errors.append("/api/healthz 返回的不是合法 JSON")

    auth_status, _ = request(urljoin(base_url, "api/auth/me"), args.timeout)
    ensure(auth_status == 401, errors, f"/api/auth/me 未登录状态应返回 401，实际为 {auth_status}")

    if errors:
        print("[FAIL] Gate-D 最小验收未通过。")
        for item in errors:
            print(f"- {item}")
        return 1

    print("[OK] Gate-D 最小验收通过。")
    print(f"- Base URL: {args.base_url}")
    print("- 首页：PASS")
    print("- /api/healthz：PASS")
    print("- /api/auth/me 未登录保护：PASS")
    return 0



if __name__ == "__main__":
    sys.exit(main())
