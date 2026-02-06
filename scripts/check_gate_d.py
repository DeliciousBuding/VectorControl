from __future__ import annotations

import json
import os
import subprocess
import sys
from urllib import error, request


def _get_text(url: str) -> tuple[int, str]:
    req = request.Request(url)
    with request.urlopen(req, timeout=10) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        return resp.status, body


def _expect_status(url: str, expected: int) -> str | None:
    try:
        code, _ = _get_text(url)
        if code != expected:
            return f"{url} 状态码异常: {code} != {expected}"
        return None
    except error.HTTPError as exc:
        if exc.code == expected:
            return None
        return f"{url} HTTP 错误: {exc.code}, 期望 {expected}"
    except Exception as exc:  # noqa: BLE001
        return f"{url} 请求失败: {exc}"


def _check_compose_services() -> str | None:
    compose_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "deploy", "docker-compose.prod.yml")
    cmd = ["docker", "compose", "-f", compose_file, "ps", "--format", "json"]
    try:
        proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
    except FileNotFoundError:
        return "未检测到 docker 命令，无法检查容器状态。"

    if proc.returncode != 0:
        fallback = subprocess.run(
            ["docker", "compose", "-f", compose_file, "ps"],
            check=False,
            capture_output=True,
            text=True,
        )
        if fallback.returncode != 0:
            return f"docker compose ps 执行失败: {proc.stderr.strip()}"
        output = fallback.stdout.lower()
        required = ["vectorcontrol-nginx", "vectorcontrol-backend", "vectorcontrol-postgres"]
        missing = [item for item in required if item not in output]
        if missing:
            return f"以下服务未运行: {', '.join(missing)}"
        return None

    lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    if not lines:
        return "未读取到容器状态。"

    running = set()
    for line in lines:
        try:
            item = json.loads(line)
            if item.get("State") == "running":
                running.add(item.get("Service", ""))
        except json.JSONDecodeError:
            return "docker compose ps 输出格式异常。"

    required = {"nginx", "backend", "postgres"}
    missing = sorted(s for s in required if s not in running)
    if missing:
        return f"以下服务未运行: {', '.join(missing)}"
    return None


def main() -> int:
    domain = os.getenv("VC_DOMAIN", "").strip()
    scheme = os.getenv("VC_SCHEME", "https").strip().lower()
    if not domain:
        print("[FAIL] 缺少 VC_DOMAIN 环境变量。示例：VC_DOMAIN=vc.example.com")
        return 1

    base = f"{scheme}://{domain}"
    failures: list[str] = []

    try:
        code, html = _get_text(f"{base}/")
        if code != 200:
            failures.append(f"{base}/ 状态码异常: {code}")
        if "VectorControl" not in html and "vectorcontrol" not in html.lower():
            failures.append("首页未检测到 VectorControl 关键标识。")
    except Exception as exc:  # noqa: BLE001
        failures.append(f"首页访问失败: {exc}")

    err = _expect_status(f"{base}/api/healthz", 200)
    if err:
        failures.append(err)

    err = _expect_status(f"{base}/api/auth/me", 401)
    if err:
        failures.append(err)

    compose_err = _check_compose_services()
    if compose_err:
        failures.append(compose_err)

    if failures:
        print("[FAIL] Gate-D 检查失败：")
        for item in failures:
            print(f"- {item}")
        return 1

    print("[PASS] Gate-D 检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
