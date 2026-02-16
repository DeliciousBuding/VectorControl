#!/usr/bin/env python3
"""
Docs Gate - 文档门禁检查脚本

检查提交是否包含必要的文档更新
用法: python scripts/check_docs_gate.py --diff-base origin/main
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# 需要检查文档变更的目录/文件
DOC_PATHS = [
    "docs/",
    "README.md",
    "ROADMAP.md",
    "AGENTS.md",
    "VERSION",
]

# 代码变更类型
CODE_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".vue", ".css", ".scss", ".yml", ".yaml", ".json", ".toml", ".sh"}


def get_changed_files(base: str) -> list[str]:
    """获取变更的文件列表"""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", f"{base}...HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
    except subprocess.CalledProcessError:
        # 尝试其他方式
        try:
            result = subprocess.run(
                ["git", "diff", "--name-only", base],
                capture_output=True,
                text=True,
            )
            return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
        except Exception:
            return []


def is_doc_file(path: str) -> bool:
    """判断是否为文档文件"""
    path_lower = path.lower()
    for doc_path in DOC_PATHS:
        if path_lower.startswith(doc_path.lower().rstrip("/")):
            return True
    return False


def is_code_file(path: str) -> bool:
    """判断是否为代码文件"""
    ext = Path(path).suffix.lower()
    return ext in CODE_EXTENSIONS


def has_frontend_change(files: list[str]) -> bool:
    """检查是否有前端变更"""
    return any(f.startswith("frontend/") for f in files)


def has_backend_change(files: list[str]) -> bool:
    """检查是否有后端变更"""
    return any(f.startswith("backend/") for f in files)


def main():
    parser = argparse.ArgumentParser(description="Docs Gate 检查")
    parser.add_argument("--diff-base", default="origin/main", help="对比的基准分支")
    parser.add_argument("--strict", action="store_true", help="严格模式：代码变更必须包含文档")
    parser.add_argument("--verbose", action="store_true", help="详细输出")
    args = parser.parse_args()

    files = get_changed_files(args.diff_base)

    if args.verbose:
        print(f"Changed files ({len(files)}):")
        for f in files:
            print(f"  {f}")

    if not files:
        print("No changes detected.")
        return 0

    # 检查是否有文档变更
    doc_files = [f for f in files if is_doc_file(f)]
    code_files = [f for f in files if is_code_file(f)]

    has_doc = len(doc_files) > 0
    has_code = len(code_files) > 0

    if args.verbose:
        print(f"\nDoc files: {len(doc_files)}")
        print(f"Code files: {len(code_files)}")

    # 严格模式：代码变更必须有文档
    if args.strict and has_code and not has_doc:
        print("\n❌ [GATE] 严格模式阻断：代码变更但无文档更新")
        print("请在提交中包含相关文档更新。")
        return 1

    # 非严格模式：警告但不阻断
    if has_code and not has_doc:
        print("\n⚠️ [GATE] 警告：代码变更但无文档更新")
        print("建议在提交中包含相关文档更新。")
        # 不阻断，允许通过
        return 0

    print("\n✅ [GATE] Docs Gate 通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
