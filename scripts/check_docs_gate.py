#!/usr/bin/env python3
"""
文档门禁检查脚本

功能：
- 检查关键文档是否存在
- 检查文档内容是否符合规范
- 支持严格模式

用法：
    python scripts/check_docs_gate.py
    python scripts/check_docs_gate.py --strict
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REQUIRED_DOCS = [
    "README.md",
    "ROADMAP.md",
    "docs/架构说明.md",
    "docs/开发规范.md",
    "docs/接口契约.md",
    "docs/部署与运行.md",
]

OPTIONAL_DOCS = [
    "docs/交易流水YAML导入规范.md",
    "docs/P0线上故障排查SOP.md",
    "docs/状态解释验收样例.md",
    "docs/最新进度.md",
    "docs/Git工作流.md",
]


def check_doc_exists(repo_root: Path, doc_path: str) -> tuple[bool, str]:
    """检查文档是否存在"""
    full_path = repo_root / doc_path
    if not full_path.exists():
        return False, f"文档不存在: {doc_path}"
    return True, ""


def check_doc_content(repo_root: Path, doc_path: str, strict: bool) -> list[str]:
    """检查文档内容"""
    errors = []
    full_path = repo_root / doc_path
    
    if not full_path.exists():
        return [f"文档不存在: {doc_path}"]
    
    try:
        content = full_path.read_text(encoding='utf-8')
    except Exception as e:
        return [f"读取文档失败: {doc_path} - {e}"]
    
    if len(content.strip()) < 100:
        errors.append(f"文档内容过短: {doc_path} (少于100字符)")
    
    if strict:
        if doc_path == "README.md":
            if "## " not in content:
                errors.append(f"README.md 缺少章节标题")
        
        if doc_path.startswith("docs/"):
            if "## " not in content and "# " not in content:
                errors.append(f"{doc_path} 缺少章节标题")
    
    return errors


def main():
    parser = argparse.ArgumentParser(description="文档门禁检查")
    parser.add_argument("--strict", action="store_true", help="严格模式")
    args = parser.parse_args()
    
    repo_root = Path(__file__).parent.parent
    
    print("检查文档门禁...")
    print(f"模式: {'严格' if args.strict else '普通'}")
    print()
    
    all_errors = []
    
    for doc_path in REQUIRED_DOCS:
        exists, error = check_doc_exists(repo_root, doc_path)
        if not exists:
            all_errors.append(error)
            print(f"  ✗ {doc_path}: 不存在")
        else:
            content_errors = check_doc_content(repo_root, doc_path, args.strict)
            if content_errors:
                all_errors.extend(content_errors)
                print(f"  ✗ {doc_path}: {', '.join(content_errors)}")
            else:
                print(f"  ✓ {doc_path}")
    
    print()
    
    if all_errors:
        print("=" * 60)
        print("文档门禁检查失败:")
        for error in all_errors:
            print(f"  - {error}")
        return 1
    
    print("文档门禁检查通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
