from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

# Windows 终端 UTF-8 支持：修复中文输出乱码
if sys.platform == "win32":
    try:
        import locale
        import os

        # 尝试设置控制台代码页为 UTF-8
        os.system("chcp 65001 >nul 2>&1")
        # 强制 Python stdout/stderr 使用 UTF-8
        if sys.stdout.encoding != "utf-8":
            sys.stdout.reconfigure(encoding="utf-8")
        if sys.stderr.encoding != "utf-8":
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        # 如果失败，继续执行但可能显示乱码
        pass


ROOT_DIR = Path(__file__).resolve().parents[1]


def _run_step(name: str, cmd: list[str]) -> bool:
    print(f"[STEP] {name}")
    print(f"[CMD] {' '.join(cmd)}")
    try:
        proc = subprocess.run(
            cmd,
            cwd=ROOT_DIR,
            check=False,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError:
        if cmd and cmd[0] == "npm":
            fallback = ["npm.cmd", *cmd[1:]]
            print(f"[WARN] 未找到 npm，尝试回退命令: {' '.join(fallback)}")
            try:
                proc = subprocess.run(
                    fallback,
                    cwd=ROOT_DIR,
                    check=False,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                )
            except FileNotFoundError:
                print("[FAIL] 命令不存在，请确认已安装 Node.js/npm 并在 PATH 中。")
                return False
        else:
            print(f"[FAIL] 命令不存在，请确认已安装并在 PATH 中: {cmd[0]}")
            return False

    if proc.returncode != 0:
        print(f"[FAIL] {name} 未通过，退出码: {proc.returncode}")
        return False

    print(f"[PASS] {name} 通过")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="发布前本地预检：文档门禁 + 后端编译检查 + 前端构建检查。"
    )
    parser.add_argument("--skip-secrets", action="store_true", help="跳过敏感信息泄露扫描。")
    parser.add_argument("--skip-docs", action="store_true", help="跳过文档门禁检查。")
    parser.add_argument("--skip-backend", action="store_true", help="跳过后端 compileall。")
    parser.add_argument("--skip-frontend", action="store_true", help="跳过前端 build。")
    args = parser.parse_args()

    steps: list[tuple[str, list[str]]] = []
    if not args.skip_secrets:
        steps.append(("Secrets Leak Guard", [sys.executable, "scripts/check_secrets_leak.py"]))
    if not args.skip_docs:
        steps.append(
            ("文档门禁（严格）", [sys.executable, "scripts/check_docs_gate.py", "--strict"])
        )
    if not args.skip_backend:
        steps.append(("后端 compileall", [sys.executable, "-m", "compileall", "backend/app"]))
    if not args.skip_frontend:
        steps.append(("前端构建", ["npm", "--prefix", "frontend", "run", "build"]))

    if not steps:
        print("[WARN] 未选择任何检查项。")
        return 0

    print("[INFO] 开始发布前预检")
    for name, cmd in steps:
        if not _run_step(name, cmd):
            print("[FAIL] 发布前预检失败")
            return 1

    print("[PASS] 发布前预检全部通过")
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        # 最小自测：验证脚本可以正常加载并输出中文
        print("[SELFTEST] 检查发布前预检脚本...")
        print("[SELFTEST] 中文测试：文档门禁、后端编译、前端构建")
        print("[SELFTEST] 脚本加载成功")
        sys.exit(0)
    raise SystemExit(main())
