#!/usr/bin/env python3
"""git filter-repo --message-callback 回调脚本。
仅操作 git-filter-repo 提供的全局变量 `message`（bytes）。
"""

import re

PREFIX_MAP = {
    "feat": "功能",
    "fix": "修复",
    "docs": "文档",
    "refactor": "重构",
    "test": "测试",
    "perf": "优化",
    "chore": "构建",
    "build": "构建",
    "ci": "构建",
    "style": "优化",
    "revert": "修复",
}

CHINESE_PREFIXES = ("发布", "功能", "修复", "优化", "重构", "文档", "测试", "构建")


def _pack(title: str, body: str) -> bytes:
    if body:
        return (title + "\n" + body).encode("utf-8")
    return (title + "\n").encode("utf-8")


def rewrite_message(msg_bytes: bytes) -> bytes:
    msg = msg_bytes.decode("utf-8", errors="replace")
    lines = msg.split("\n")
    title = lines[0].strip() if lines else ""
    body = "\n".join(lines[1:]) if len(lines) > 1 else ""

    # 1) Merge commit 保持不变
    if title.startswith("Merge"):
        return msg_bytes

    # 2) 已符合中文前缀规范，保持不变
    prefix_pattern = r"^(?:" + "|".join(CHINESE_PREFIXES) + r")[：:]"
    if re.match(prefix_pattern, title):
        return msg_bytes

    # 3) 英文前缀（支持 feat(scope): desc / feat: desc / feat desc）
    m = re.match(r"^(\w+)(?:\([^)]*\))?(?:\s*[：:]\s*|\s+)(.*)$", title)
    if m:
        prefix_en = m.group(1).lower()
        desc = m.group(2).strip()
        if prefix_en in PREFIX_MAP:
            if not desc:
                desc = "历史提交信息规范化"
            return _pack(f"{PREFIX_MAP[prefix_en]}: {desc}", body)

    # 4) 无可识别前缀：中文标题或英文标题统一加“功能:”
    if title:
        return _pack(f"功能: {title}", body)

    # 5) 空标题回退
    return _pack("功能: 历史提交信息规范化", body)


try:
    # `message` 由 git filter-repo 在运行时注入
    message = rewrite_message(message)  # type: ignore[name-defined]
except NameError:
    # 便于本地静态检查与直接运行脚本时不报错
    pass
