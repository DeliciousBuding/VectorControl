#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config_loader import load_all  # noqa: E402
from app.storage.db import (  # noqa: E402
    create_user,
    init_db,
    reset_user_password,
    seed_user_holdings_if_empty,
    username_exists,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="创建或重置演示账号，并导入真实持仓。")
    parser.add_argument("--username", default="admin", help="账号名，默认 admin")
    parser.add_argument(
        "--password",
        default="Admin@VectorControl#2026",
        help="密码，默认使用高强度示例密码",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    username = str(args.username).strip().lower()
    password = str(args.password)
    if not username:
        print("错误：用户名不能为空")
        return 1

    init_db()

    if username_exists(username):
        user = reset_user_password(username, password)
        if not user:
            print("错误：账号存在但重置密码失败")
            return 1
        mode = "重置密码"
    else:
        user = create_user(username, password)
        mode = "创建账号"

    config = load_all()
    inserted = seed_user_holdings_if_empty(user["id"], config.get("portfolio", {}))

    print(f"结果：{mode}成功")
    print(f"账号：{user['username']}")
    print(f"密码：{password}")
    print(f"导入持仓：{inserted} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
