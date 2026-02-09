from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import re


ROOT_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Finding:
    path: Path
    line_no: int
    kind: str


def _is_probably_binary(data: bytes) -> bool:
    # Heuristic: skip files with NULs in the early part.
    return b"\x00" in data[:2048]


def _git_ls_files(root: Path) -> list[Path] | None:
    try:
        proc = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=root,
            check=False,
            capture_output=True,
        )
    except FileNotFoundError:
        return None
    if proc.returncode != 0:
        return None
    items = [p for p in proc.stdout.split(b"\x00") if p]
    return [root / Path(p.decode("utf-8", errors="replace")) for p in items]


def _iter_files(root: Path) -> Iterable[Path]:
    # Prefer git-tracked files so we don't block on untracked local files.
    tracked = _git_ls_files(root)
    if tracked is not None:
        for p in tracked:
            yield p
        return

    skip_dirs = {".git", "node_modules", ".venv", "venv", "__pycache__", "deploy/data", "deploy/backups"}
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = Path(dirpath).resolve().relative_to(root.resolve())
        # Prune ignored directories.
        parts = set(rel_dir.parts)
        if parts & skip_dirs:
            dirnames[:] = []
            continue
        for name in filenames:
            yield Path(dirpath) / name


def _scan_text(text: str) -> list[Finding]:
    # Telegram bot token: <digits>:<base64-ish>
    telegram_bot_token = re.compile(r"\b\d{5,12}:[A-Za-z0-9_-]{30,}\b")
    # Feishu webhook: https://open.feishu.cn/open-apis/bot/v2/hook/<id>
    feishu_webhook = re.compile(r"https://open\.feishu\.cn/open-apis/bot/v2/hook/[a-z0-9-]{20,}", re.IGNORECASE)

    findings: list[Finding] = []
    for idx, line in enumerate(text.splitlines(), start=1):
        if telegram_bot_token.search(line):
            findings.append(Finding(path=Path(), line_no=idx, kind="telegram_bot_token"))
        if feishu_webhook.search(line):
            findings.append(Finding(path=Path(), line_no=idx, kind="feishu_webhook_url"))
    return findings


def check_paths(paths: Iterable[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for path in paths:
        try:
            data = path.read_bytes()
        except Exception:
            continue
        if _is_probably_binary(data):
            continue
        text = data.decode("utf-8", errors="replace")
        for f in _scan_text(text):
            findings.append(Finding(path=path, line_no=f.line_no, kind=f.kind))
    return findings


def _print_report(findings: list[Finding]) -> None:
    if not findings:
        print("[PASS] Secrets Leak Guard: no findings")
        return

    print("[FAIL] Secrets Leak Guard: potential secrets detected")
    print("[INFO] 为避免泄露，报告不会回显命中明文，仅输出路径/行号/类型。")
    for f in findings[:200]:
        try:
            shown = f.path.resolve().relative_to(ROOT_DIR.resolve()).as_posix()
        except Exception:
            shown = f.path.resolve().as_posix()
        print(f"- {shown}:{f.line_no} kind={f.kind}")
    if len(findings) > 200:
        print(f"[INFO] (only first 200 findings shown, total={len(findings)})")


def _selftest() -> int:
    # Build fake secrets at runtime so this repo does not contain contiguous
    # token/webhook plaintext that would be flagged by the guard itself.
    fake_tg = "1234567890" + ":" + ("A" * 20) + ("b" * 15) + "_-"
    fake_fs = "https://open.feishu.cn/open-apis/bot/v2/hook/" + "01234567-89ab-cdef-0123-456789abcdef"
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "secrets.txt"
        p.write_text(f"tg={fake_tg}\nfs={fake_fs}\n", encoding="utf-8")

        proc = subprocess.run(
            [sys.executable, str(ROOT_DIR / "scripts/check_secrets_leak.py"), "--paths", str(p)],
            cwd=ROOT_DIR,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if proc.returncode == 0:
            print("[SELFTEST FAIL] expected non-zero exit code")
            return 1
        merged = (proc.stdout or "") + "\n" + (proc.stderr or "")
        if "telegram_bot_token" not in merged or "feishu_webhook_url" not in merged:
            print("[SELFTEST FAIL] expected finding kinds in output")
            return 1
        if fake_tg in merged or fake_fs in merged:
            print("[SELFTEST FAIL] output contains plaintext secret")
            return 1
        print("[SELFTEST PASS] ok")
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Secrets Leak Guard: regex scan for tokens/webhooks.")
    parser.add_argument(
        "--paths",
        nargs="*",
        default=None,
        help="Optional file paths to scan. Defaults to git-tracked files under repo root.",
    )
    parser.add_argument("--selftest", action="store_true", help="Run built-in selftest.")
    args = parser.parse_args(argv)

    if args.selftest:
        return _selftest()

    if args.paths:
        paths = [Path(p).resolve() for p in args.paths]
    else:
        paths = list(_iter_files(ROOT_DIR))

    findings = check_paths(paths)
    _print_report(findings)
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
