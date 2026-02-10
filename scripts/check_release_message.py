from __future__ import annotations

import argparse
import re
from pathlib import Path


RELEASE_TITLE_RE = re.compile(r"^发布[:：]\s*v\d+\.\d+\.\d+\s*-\s*\S.+$")
SECTION_RE = re.compile(r"^(新增|修复|优化|文档)\s*[:：]\s*(.*)$")
SECTION_NAMES = ("新增", "修复", "优化", "文档")
NORMAL_PREFIXES = ("功能", "修复", "优化", "重构", "文档", "测试", "构建")
NORMAL_TITLE_RE = re.compile(
    rf"^({'|'.join(map(re.escape, NORMAL_PREFIXES))})[:：]\s+\S.+$"
)
ENGLISH_PREFIX_BLACKLIST = (
    "feat",
    "fix",
    "docs",
    "chore",
    "refactor",
    "test",
    "style",
    "perf",
    "build",
    "ci",
    "revert",
)
ENGLISH_PREFIX_RE = re.compile(
    rf"^({'|'.join(map(re.escape, ENGLISH_PREFIX_BLACKLIST))})\b",
    flags=re.IGNORECASE,
)
DOC_RANGE_KEYS = ("检查范围", "巡检范围", "核对范围", "全量巡检")
DOC_RESULT_KEYS = ("更新结论", "同步更新", "已更新", "更新项")
DOC_DEFER_KEY = "延后项"
DOC_NONE_VALUES = {"无", "无。", "无（已完成）", "无(已完成)", "none"}


def _is_release_message(first_line: str) -> bool:
    return first_line.startswith("发布:") or first_line.startswith("发布：")


def _is_merge_commit(first_line: str) -> bool:
    return first_line.startswith("Merge")


def _detect_blacklisted_english_prefix(first_line: str) -> str | None:
    matched = ENGLISH_PREFIX_RE.match(first_line.strip())
    if not matched:
        return None
    return matched.group(1).lower()


def _validate_normal_title(first_line: str) -> list[str]:
    errors: list[str] = []
    blocked_prefix = _detect_blacklisted_english_prefix(first_line)
    if blocked_prefix:
        errors.append(
            "提交标题禁止使用英文前缀“"
            f"{blocked_prefix}”。请使用中文前缀，格式：前缀: 一句话说明"
            "（前缀可选：功能、修复、优化、重构、文档、测试、构建）。"
        )
        return errors

    if not NORMAL_TITLE_RE.match(first_line):
        errors.append(
            "普通提交标题格式错误，应为：前缀: 一句话说明"
            "（支持“:”或“：”，且冒号后必须有空格；"
            "前缀可选：功能、修复、优化、重构、文档、测试、构建）。"
        )

    return errors


def _has_meaningful_content(text: str) -> bool:
    trimmed = text.strip()
    if not trimmed:
        return False
    if trimmed in {"-", "*", "TODO", "todo"}:
        return False
    return True


def _strip_bullet_prefix(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^[-*]\s*", "", cleaned)
    cleaned = re.sub(r"^\d+\.\s*", "", cleaned)
    return cleaned.strip()


def _collect_section_lines(head_content: str, body_lines: list[str]) -> list[str]:
    lines: list[str] = []
    if head_content.strip():
        lines.append(_strip_bullet_prefix(head_content))
    for raw in body_lines:
        cleaned = _strip_bullet_prefix(raw)
        if cleaned:
            lines.append(cleaned)
    return lines


def _extract_colon_value(text: str) -> str:
    matched = re.search(r"[:：]\s*(.*)$", text)
    if not matched:
        return ""
    return matched.group(1).strip()


def _validate_doc_section(lines: list[str]) -> list[str]:
    errors: list[str] = []
    if not lines:
        return ["发布提交段落“文档”缺少有效内容"]

    has_range = any(any(key in line for key in DOC_RANGE_KEYS) for line in lines)
    has_result = any(any(key in line for key in DOC_RESULT_KEYS) for line in lines)
    defer_indices = [idx for idx, line in enumerate(lines) if DOC_DEFER_KEY in line]

    if not has_range:
        errors.append("发布提交段落“文档”缺少“检查范围”说明")
    if not has_result:
        errors.append("发布提交段落“文档”缺少“更新结论”说明")
    if not defer_indices:
        errors.append("发布提交段落“文档”缺少“延后项”说明")
        return errors

    defer_ok = False
    for idx in defer_indices:
        current = lines[idx]
        value = _extract_colon_value(current)
        if _has_meaningful_content(value) or value.lower() in DOC_NONE_VALUES:
            defer_ok = True
            break
        for next_idx in range(idx + 1, len(lines)):
            candidate = lines[next_idx]
            if DOC_DEFER_KEY in candidate:
                break
            if _has_meaningful_content(candidate) or candidate.lower() in DOC_NONE_VALUES:
                defer_ok = True
                break
        if defer_ok:
            break

    if not defer_ok:
        errors.append("发布提交段落“文档”中的“延后项”不能为空（无则写“无”）")

    return errors


def _validate_sections(lines: list[str]) -> list[str]:
    errors: list[str] = []
    sections: dict[str, tuple[int, str]] = {}
    indices: list[tuple[int, str]] = []

    for idx, line in enumerate(lines):
        matched = SECTION_RE.match(line.strip())
        if matched:
            name = matched.group(1)
            head_content = matched.group(2).strip()
            sections[name] = (idx, head_content)
            indices.append((idx, name))

    missing = [name for name in SECTION_NAMES if name not in sections]
    if missing:
        errors.append("发布提交缺少段落: " + "、".join(missing))
        return errors

    # 段落顺序检查
    order = [name for _, name in sorted(indices)]
    if order != list(SECTION_NAMES):
        errors.append("发布提交段落顺序必须为：新增 -> 修复 -> 优化 -> 文档")

    # 内容检查
    sorted_indices = sorted(indices)
    for pos, (line_no, name) in enumerate(sorted_indices):
        _, head_content = sections[name]
        next_line_no = sorted_indices[pos + 1][0] if pos + 1 < len(sorted_indices) else len(lines)
        body_lines = lines[line_no + 1 : next_line_no]

        valid = _has_meaningful_content(head_content)
        if not valid:
            for raw in body_lines:
                text = raw.strip()
                if not text:
                    continue
                # 允许 bullet 或普通行，只要有实质内容
                if text.startswith(("-", "*")):
                    text = text[1:].strip()
                if _has_meaningful_content(text):
                    valid = True
                    break

        if not valid:
            errors.append(f"发布提交段落“{name}”缺少有效内容")
            continue

        if name == "文档":
            section_lines = _collect_section_lines(head_content, body_lines)
            errors.extend(_validate_doc_section(section_lines))

    return errors


def validate_message(message: str) -> list[str]:
    errors: list[str] = []
    normalized_message = message.lstrip("\ufeff")
    text = normalized_message.strip()
    if not text:
        return ["提交信息不能为空。"]

    lines = normalized_message.splitlines()
    first_line = lines[0].lstrip("\ufeff").strip() if lines else ""

    if _is_merge_commit(first_line):
        return errors

    # 发布提交专属校验
    if _is_release_message(first_line):
        if not RELEASE_TITLE_RE.match(first_line):
            errors.append("发布标题格式错误，应为：发布: vX.Y.Z - 一句话摘要")

        if re.fullmatch(r"发布[:：]?\s*合并\s*dev", first_line, flags=re.IGNORECASE):
            errors.append("发布标题不能只写“合并 dev”。")

        errors.extend(_validate_sections(lines))

        return errors

    errors.extend(_validate_normal_title(first_line))

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="校验提交信息（普通提交 + 发布模板规则）。")
    parser.add_argument("message_file", help="commit message 文件路径")
    args = parser.parse_args()

    path = Path(args.message_file)
    if not path.exists():
        print(f"[FAIL] 提交信息文件不存在: {path.as_posix()}")
        return 1

    content = path.read_text(encoding="utf-8", errors="replace")
    errors = validate_message(content)
    if errors:
        print("[FAIL] 提交信息校验失败:")
        for item in errors:
            print(f"- {item}")
        return 1

    print("[PASS] 提交信息校验通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
