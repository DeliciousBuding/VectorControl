#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RELEASE_TITLE_PATTERN = re.compile(r"^发布[:：] (v\d+\.\d+\.\d+) - .+")
SECTION_PATTERN = re.compile(r"^(新增|修复|优化|文档)[:：]\s*(.+)$")
DOC_SECTION_REQUIRED_TERMS = ("检查范围", "更新结论", "延后项")



def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="校验 main 发布提交与 Tag 一致性。")
    parser.add_argument("--commit", default="HEAD", help="要校验的提交，默认 HEAD。")
    parser.add_argument("--check-remote-tag", action="store_true", help="校验远端是否存在对应 Tag。")
    parser.add_argument("--remote", default="origin", help="远端名称，默认 origin。")
    return parser.parse_args()



def git(*args: str) -> str:
    completed = subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip() or "git 命令执行失败")
    return completed.stdout.strip()



def validate_release_message(message: str) -> tuple[str | None, list[str]]:
    lines = [line.rstrip() for line in message.replace("\r\n", "\n").split("\n") if line.strip()]
    if not lines:
        return None, ["发布提交消息为空。"]

    title = lines[0]
    errors: list[str] = []
    match = RELEASE_TITLE_PATTERN.match(title)
    if not match:
        return None, ["发布提交标题格式必须为：发布: vX.Y.Z - 一句话摘要"]

    sections: dict[str, str] = {}
    for line in lines[1:]:
        section_match = SECTION_PATTERN.match(line)
        if section_match and section_match.group(1) not in sections:
            sections[section_match.group(1)] = section_match.group(2)

    for name in ("新增", "修复", "优化", "文档"):
        if name not in sections:
            errors.append(f"发布提交缺少 {name}: 段。")

    doc_section = sections.get("文档", "")
    if doc_section:
        for term in DOC_SECTION_REQUIRED_TERMS:
            if term not in doc_section:
                errors.append(f"发布提交的 文档: 段缺少“{term}”。")

    return match.group(1), errors



def main() -> int:
    args = parse_args()
    errors: list[str] = []

    try:
        commit_message = git("show", "-s", "--format=%B", args.commit)
        commit_hash = git("rev-parse", "--short", args.commit)
    except RuntimeError as exc:
        print(f"[FAIL] 无法读取提交信息: {exc}")
        return 1

    version, message_errors = validate_release_message(commit_message)
    errors.extend(message_errors)

    if version:
        try:
            tags = {line.strip() for line in git("tag", "--points-at", args.commit).splitlines() if line.strip()}
        except RuntimeError as exc:
            errors.append(f"无法读取本地 Tag: {exc}")
            tags = set()

        if version not in tags:
            errors.append(f"提交 {args.commit} 未绑定预期 Tag：{version}")

        if args.check_remote_tag:
            try:
                remote_refs = git(
                    "ls-remote",
                    "--tags",
                    args.remote,
                    f"refs/tags/{version}",
                    f"refs/tags/{version}^{{}}",
                )
                if f"refs/tags/{version}" not in remote_refs:
                    errors.append(f"远端 {args.remote} 不存在 Tag：{version}")
            except RuntimeError as exc:
                errors.append(f"远端 Tag 校验失败: {exc}")

    if errors:
        print("[FAIL] main 发布一致性校验未通过。")
        for item in errors:
            print(f"- {item}")
        return 1

    print("[OK] main 发布一致性校验通过。")
    print(f"- Commit: {commit_hash}")
    print(f"- Tag: {version}")
    print("- Release notes validated")
    if args.check_remote_tag:
        print(f"- Remote tag verified: {args.remote}/{version}")
    return 0



if __name__ == "__main__":
    sys.exit(main())
