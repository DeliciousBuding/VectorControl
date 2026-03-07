#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEPLOY_DIR = REPO_ROOT / "deploy"
NGINX_DIR = DEPLOY_DIR / "nginx"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="按环境渲染生产 Nginx 站点配置。")
    parser.add_argument("--env-file", required=True, help="环境变量文件路径")
    parser.add_argument("--output", required=True, help="渲染输出路径")
    return parser.parse_args()


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def is_truthy(value: str) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def main() -> int:
    args = parse_args()
    env_file = Path(args.env_file).resolve()
    output = Path(args.output).resolve()
    env = load_env_file(env_file)

    enable_tls = is_truthy(env.get("VC_ENABLE_TLS", "false"))
    domain = str(env.get("VC_DOMAIN", "")).strip() or "127.0.0.1"

    if enable_tls and domain == "127.0.0.1":
        raise SystemExit("VC_ENABLE_TLS=true 时必须配置 VC_DOMAIN。")

    template_name = "site.conf" if enable_tls else "site.http.conf"
    template_path = NGINX_DIR / template_name
    rendered = template_path.read_text(encoding="utf-8").replace("__VC_DOMAIN__", domain)

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"[OK] rendered {template_name} -> {output}")
    print(f"- VC_DOMAIN={domain}")
    print(f"- VC_ENABLE_TLS={'true' if enable_tls else 'false'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
