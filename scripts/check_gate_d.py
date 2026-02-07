from __future__ import annotations

import json
import os
import subprocess
from urllib import error, request


def _run_cmd(cmd: list[str]) -> subprocess.CompletedProcess:
    """Run command with robust decoding across Windows/WSL locales."""
    return subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


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
    compose_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "deploy",
        "docker-compose.prod.yml",
    )

    # Newer docker compose supports JSON output.
    json_proc = _run_cmd(
        ["docker", "compose", "-f", compose_file, "ps", "--format", "json"]
    )
    if json_proc.returncode == 0:
        lines = [line.strip() for line in json_proc.stdout.splitlines() if line.strip()]
        if not lines:
            return "未读取到容器状态。"
        running = set()
        for line in lines:
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                return "docker compose ps JSON 输出解析失败。"
            if item.get("State") == "running":
                running.add(item.get("Service", ""))
        required = {"nginx", "backend", "postgres"}
        missing = sorted(s for s in required if s not in running)
        if missing:
            return f"以下服务未运行: {', '.join(missing)}"
        return None

    # Fallback plain table parsing.
    text_proc = _run_cmd(["docker", "compose", "-f", compose_file, "ps"])
    if text_proc.returncode != 0:
        return f"docker compose ps 执行失败: {json_proc.stderr.strip() or text_proc.stderr.strip()}"

    output = text_proc.stdout.lower()
    required_names = [
        "vectorcontrol-nginx",
        "vectorcontrol-backend",
        "vectorcontrol-postgres",
    ]
    missing_names = [name for name in required_names if name not in output]
    if missing_names:
        return f"以下服务未运行: {', '.join(missing_names)}"
    return None


def main() -> int:
    domain = os.getenv("VC_DOMAIN", "").strip()
    scheme = os.getenv("VC_SCHEME", "https").strip().lower()
    if not domain:
        print("[FAIL] 缺少 VC_DOMAIN 环境变量，例如: VC_DOMAIN=vc.example.com")
        return 1

    base = f"{scheme}://{domain}"
    failures: list[str] = []

    try:
        code, html = _get_text(f"{base}/")
        if code != 200:
            failures.append(f"{base}/ 状态码异常: {code}")
        if "VectorControl" not in html and "vectorcontrol" not in html.lower():
            failures.append("首页未检测到 VectorControl 标识。")
    except Exception as exc:  # noqa: BLE001
        failures.append(f"首页访问失败: {exc}")

    err = _expect_status(f"{base}/api/healthz", 200)
    if err:
        failures.append(err)

    # 主校验：/api/auth/me 未登录应返回 401
    auth_err = _expect_status(f"{base}/api/auth/me", 401)
    if auth_err:
        # 兼容回退：若该端点不存在，要求 /api/config 至少受保护返回 401。
        fallback_err = _expect_status(f"{base}/api/config", 401)
        if fallback_err:
            failures.append(auth_err)

    compose_err = _check_compose_services()
    if compose_err:
        failures.append(compose_err)

    if failures:
        print("[FAIL] Gate-D 检查失败:")
        for item in failures:
            print(f"- {item}")
        return 1

    print("[PASS] Gate-D 检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
