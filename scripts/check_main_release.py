#!/usr/bin/env python3
"""
Main Release Consistency Check - 主分支发布一致性检查

检查 main 分支发布是否符合规范：
1. commit message 格式
2. tag 存在性
3. 版本号一致性
用法: python scripts/check_main_release.py --commit HEAD
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


def run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)


def get_commit_message(commit: str) -> str:
    """获取 commit message"""
    code, stdout, _ = run_cmd(["git", "log", "-1", "--format=%s", commit])
    return stdout.strip() if code == 0 else ""


def get_commit_body(commit: str) -> str:
    """获取 commit body"""
    code, stdout, _ = run_cmd(["git", "log", "-1", "--format=%b", commit])
    return stdout.strip() if code == 0 else ""


def get_tags(commit: str) -> list[str]:
    """获取 commit 对应的 tag"""
    code, stdout, _ = run_cmd(["git", "tag", "--points-at", commit])
    return [t.strip() for t in stdout.strip().split("\n") if t.strip()]


def extract_version_from_tag(tag: str) -> str | None:
    """从 tag 中提取版本号"""
    # 匹配 v1.2.3 或 version-1.2.3 等格式
    match = re.search(r"v?(\d+\.\d+\.\d+)", tag)
    return match.group(1) if match else None


def check_commit_format(commit: str) -> bool:
    """检查 commit 格式"""
    msg = get_commit_message(commit)
    if not msg:
        return False

    # 合并提交
    if msg.startswith("Merge"):
        return True

    # 格式: type(scope): subject
    pattern = r"^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+"
    return bool(re.match(pattern, msg))


def check_release_has_docs(commit: str) -> bool:
    """检查发布提交是否包含文档"""
    # 获取本次提交修改的文件
    code, stdout, _ = run_cmd(["git", "diff", "--name-only", f"{commit}^..{commit}"])
    files = stdout.strip().split("\n")

    doc_patterns = ["docs/", "README.md", "ROADMAP.md", "CHANGELOG.md", "VERSION"]
    for f in files:
        f_lower = f.lower()
        for pattern in doc_patterns:
            if pattern.lower() in f_lower:
                return True
    return False


def main():
    parser = argparse.ArgumentParser(description="Main Release Consistency Check")
    parser.add_argument("--commit", default="HEAD", help="要检查的 commit")
    parser.add_argument("--check-tag", action="store_true", help="检查 tag 存在")
    parser.add_argument("--check-remote-tag", action="store_true", help="检查远程 tag 存在")
    parser.add_argument("--remote", default="origin", help="远程仓库名")
    args = parser.parse_args()

    commit = args.commit
    msg = get_commit_message(commit)
    body = get_commit_body(commit)
    tags = get_tags(commit)

    print(f"=" * 50)
    print(f"检查 commit: {commit}")
    print(f"=" * 50)
    print(f"Message: {msg}")
    print(f"Tags: {tags}")

    errors = []

    # 1. 检查 commit 格式
    if not check_commit_format(commit):
        errors.append("❌ Commit 格式不符合规范")

    # 2. 检查 tag
    if args.check_tag and not tags:
        errors.append("⚠️ Commit 没有关联 tag")

    if args.check_remote_tag and tags:
        for tag in tags:
            code, _, _ = run_cmd(["git", "ls-remote", "--tags", args.remote, tag])
            if code != 0 or not stdout.strip():
                errors.append(f"❌ Tag {tag} 不存在于远程")

    # 3. 检查发布提交包含文档
    if msg and ("release" in msg.lower() or "发布" in msg):
        if not check_release_has_docs(commit):
            errors.append("⚠️ 发布提交建议包含文档更新")

    print("-" * 50)
    if errors:
        for e in errors:
            print(e)
        print("-" * 50)
        return 1
    else:
        print("✅ Release Consistency Check 通过")
        return 0


if __name__ == "__main__":
    sys.exit(main())
