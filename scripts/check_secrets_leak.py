#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATHS = [REPO_ROOT]
SKIP_DIR_NAMES = {".git", "node_modules", ".venv", "__pycache__", "dist", "build"}
SKIP_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".pdf",
    ".zip",
    ".db",
    ".sqlite",
    ".woff",
    ".woff2",
    ".ttf",
    ".ico",
}
PATTERNS = {
    "telegram_bot_token": re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{30,}\b"),
    "feishu_webhook_url": re.compile(
        r"https://open\.feishu\.cn/open-apis/bot/v2/hook/[0-9a-fA-F-]{36}"
    ),
}



def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="扫描仓库中的疑似敏感信息。")
    parser.add_argument(
        "--paths",
        nargs="*",
        default=[str(path) for path in DEFAULT_PATHS],
        help="要扫描的文件或目录；默认扫描仓库根目录。",
    )
    return parser.parse_args()



def should_skip(path: Path) -> bool:
    if any(part in SKIP_DIR_NAMES for part in path.parts):
        return True
    return path.suffix.lower() in SKIP_SUFFIXES



def iter_files(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.exists():
            continue
        if path.is_file():
            if not should_skip(path):
                files.append(path)
            continue
        for candidate in path.rglob("*"):
            if candidate.is_file() and not should_skip(candidate):
                files.append(candidate)
    return files



def scan_file(path: Path) -> list[tuple[int, str]]:
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    findings: list[tuple[int, str]] = []
    for line_number, line in enumerate(content.splitlines(), start=1):
        for pattern_name, pattern in PATTERNS.items():
            if pattern.search(line):
                findings.append((line_number, pattern_name))
    return findings



def main() -> int:
    args = parse_args()
    findings: list[tuple[Path, int, str]] = []

    for path in iter_files(args.paths):
        for line_number, pattern_name in scan_file(path):
            findings.append((path, line_number, pattern_name))

    if findings:
        print("[FAIL] 检测到疑似敏感信息泄露。")
        for path, line_number, pattern_name in findings:
            print(f"- {path.as_posix()}:{line_number} type={pattern_name}")
        print("请先移除或替换敏感信息，再重新提交。")
        return 1

    print("[OK] 未发现疑似敏感信息。")
    return 0



if __name__ == "__main__":
    sys.exit(main())
