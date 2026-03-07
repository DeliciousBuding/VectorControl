#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ALLOWED_PREFIXES = ("功能", "修复", "优化", "重构", "文档", "测试", "构建")
FORBIDDEN_ENGLISH_PREFIXES = (
    "feat",
    "fix",
    "docs",
    "style",
    "refactor",
    "test",
    "chore",
    "perf",
    "ci",
    "build",
    "revert",
)
RELEASE_TITLE_PATTERN = re.compile(r"^发布[:：] (v\d+\.\d+\.\d+) - .+")
NORMAL_TITLE_PATTERN = re.compile(rf"^({'|'.join(ALLOWED_PREFIXES)})(\([^)]+\))?[:：] .+")
FORBIDDEN_TITLE_PATTERN = re.compile(rf"^({'|'.join(FORBIDDEN_ENGLISH_PREFIXES)})(\([^)]+\))?: .+")
SECTION_PATTERN = re.compile(r"^(新增|修复|优化|文档)[:：]\s*(.+)$")
DOC_SECTION_REQUIRED_TERMS = ("检查范围", "更新结论", "延后项")


def _normalize_lines(message: str) -> list[str]:
    return [line.rstrip() for line in message.replace("\r\n", "\n").split("\n")]


def _first_nonempty_line(lines: list[str]) -> str:
    for line in lines:
        if line.strip():
            return line.strip()
    return ""


def _collect_release_sections(lines: list[str]) -> dict[str, str]:
    sections: dict[str, str] = {}
    for line in lines:
        match = SECTION_PATTERN.match(line.strip())
        if match and match.group(1) not in sections:
            sections[match.group(1)] = match.group(2)
    return sections


def validate_commit_message(message: str) -> list[str]:
    lines = _normalize_lines(message)
    title = _first_nonempty_line(lines)
    if not title:
        return []

    if title.startswith("Merge ") or title.startswith("Revert "):
        return []

    errors: list[str] = []

    if FORBIDDEN_TITLE_PATTERN.match(title):
        errors.append("普通提交不允许使用英文前缀，请改为 功能/修复/优化/重构/文档/测试/构建 之一。")
        return errors

    release_match = RELEASE_TITLE_PATTERN.match(title)
    if release_match:
        sections = _collect_release_sections(lines[1:])
        for name in ("新增", "修复", "优化", "文档"):
            if name not in sections:
                errors.append(f"发布提交缺少 {name}: 段。")
        doc_section = sections.get("文档", "")
        if doc_section:
            for term in DOC_SECTION_REQUIRED_TERMS:
                if term not in doc_section:
                    errors.append(f"发布提交的 文档: 段缺少“{term}”。")
        return errors

    if title.startswith("发布"):
        errors.append("发布提交标题格式必须为：发布: vX.Y.Z - 一句话摘要")
        return errors

    if not NORMAL_TITLE_PATTERN.match(title):
        errors.append("普通提交标题格式必须为：前缀: 一句话说明")
        errors.append("允许前缀：功能、修复、优化、重构、文档、测试、构建")

    return errors


def check_commit_message(message_file: str | Path) -> int:
    message = Path(message_file).read_text(encoding="utf-8")
    errors = validate_commit_message(message)
    if not errors:
        return 0

    print("[HOOK] commit-msg 阻断：提交信息不符合规范。")
    for error in errors:
        print(f"- {error}")
    print("普通提交示例：修复: 修正基金详情页导航状态")
    print("发布提交示例：发布: v1.2.3 - 完成部署链收敛\\n\\n新增: ...\\n修复: ...\\n优化: ...\\n文档: 检查范围：...；更新结论：...；延后项：无")
    return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: check_release_message.py <commit-message-file>")
        sys.exit(1)

    sys.exit(check_commit_message(sys.argv[1]))
