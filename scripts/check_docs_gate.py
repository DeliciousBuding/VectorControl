#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
TRACKED_DOCS = {
    Path("README.md"),
    Path("ROADMAP.md"),
    Path("docs/架构说明.md"),
    Path("docs/开发规范.md"),
    Path("docs/接口契约.md"),
    Path("docs/交易流水YAML导入规范.md"),
    Path("docs/P0线上故障排查SOP.md"),
    Path("docs/状态解释验收样例.md"),
    Path("docs/Git工作流.md"),
    Path("docs/最新进度.md"),
    Path("docs/部署与运行.md"),
}
REQUIRED_FILES = [
    Path("scripts/check_docs_gate.py"),
    Path("scripts/check_release_preflight.py"),
    Path("scripts/check_main_release.py"),
    Path("scripts/check_release_message.py"),
    Path("scripts/check_secrets_leak.py"),
    Path("scripts/check_gate_d.py"),
    Path(".githooks/commit-msg"),
    Path(".githooks/pre-push"),
    Path(".github/workflows/docs-gate.yml"),
    Path(".github/workflows/release-consistency.yml"),
    Path("README.md"),
    Path("ROADMAP.md"),
    Path("docs/架构说明.md"),
    Path("docs/开发规范.md"),
    Path("docs/接口契约.md"),
    Path("docs/交易流水YAML导入规范.md"),
    Path("docs/P0线上故障排查SOP.md"),
    Path("docs/状态解释验收样例.md"),
    Path("docs/Git工作流.md"),
    Path("docs/最新进度.md"),
    Path("docs/部署与运行.md"),
]
REQUIRED_SNIPPETS = {
    Path(".githooks/commit-msg"): [
        "python scripts/check_release_message.py",
    ],
    Path(".githooks/pre-push"): [
        "python scripts/check_secrets_leak.py",
        "python scripts/check_docs_gate.py --strict",
    ],
    Path(".github/workflows/docs-gate.yml"): [
        "python scripts/check_docs_gate.py --strict",
        "--diff-base \"origin/${{ github.base_ref }}\"",
    ],
    Path(".github/workflows/release-consistency.yml"): [
        "python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin",
    ],
    Path("docs/开发规范.md"): [
        "python scripts/check_docs_gate.py --strict",
        "python scripts/check_release_preflight.py",
        "python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin",
        "python scripts/check_secrets_leak.py",
        "python -m compileall backend/app",
        "PYTHONPATH=backend python -m pytest -q",
        "npm --prefix frontend run test:run",
        "npm --prefix frontend run build",
        "python scripts/check_gate_d.py",
    ],
    Path("docs/Git工作流.md"): [
        "python scripts/check_release_preflight.py",
        "python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin",
        "python scripts/check_docs_gate.py --strict",
        "npm --prefix frontend run test:run",
        "npm --prefix frontend run build",
    ],
    Path("docs/最新进度.md"): [
        "scripts/check_docs_gate.py",
        "scripts/check_release_preflight.py",
        "scripts/check_main_release.py",
        "scripts/check_secrets_leak.py",
    ],
    Path("docs/部署与运行.md"): [
        "bash scripts/deploy_prod.sh",
        "bash scripts/update_prod.sh",
        "bash scripts/backup_db.sh",
        "docker compose --env-file deploy/.env.example -f deploy/docker-compose.prod.yml config",
    ],
}
SCRIPT_REF_PATTERN = re.compile(r"(scripts/[A-Za-z0-9_./-]+\.(?:py|sh|ps1))")
TIMESTAMP_PATTERN = re.compile(r"^更新时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")
FLOW_PREFIXES = ("scripts/", ".githooks/", ".github/workflows/")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="校验文档、脚本、hooks 与工作流是否一致。")
    parser.add_argument("--strict", action="store_true", help="输出严格模式标记。")
    parser.add_argument("--diff-base", help="提供 git diff 基线，校验流程文件变更时是否同步更新文档。")
    return parser.parse_args()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def ensure_required_files(errors: list[str]) -> None:
    for relative_path in REQUIRED_FILES:
        if not (REPO_ROOT / relative_path).exists():
            errors.append(f"缺少必需文件: {relative_path.as_posix()}")


def ensure_required_snippets(errors: list[str]) -> None:
    for relative_path, snippets in REQUIRED_SNIPPETS.items():
        target = REPO_ROOT / relative_path
        if not target.exists():
            continue
        content = read_text(target)
        for snippet in snippets:
            if snippet not in content:
                errors.append(f"{relative_path.as_posix()} 缺少关键片段: {snippet}")


def ensure_timestamp_format(errors: list[str]) -> None:
    for relative_path in TRACKED_DOCS:
        target = REPO_ROOT / relative_path
        if not target.exists():
            continue
        header = target.read_text(encoding="utf-8").splitlines()[:5]
        if not any(TIMESTAMP_PATTERN.match(line.strip()) for line in header):
            errors.append(f"{relative_path.as_posix()} 缺少合法的 更新时间：YYYY-MM-DD HH:MM:SS 头部。")


def ensure_script_references_exist(errors: list[str]) -> None:
    watched_files = set(REQUIRED_SNIPPETS) | TRACKED_DOCS
    for relative_path in watched_files:
        target = REPO_ROOT / relative_path
        if not target.exists():
            continue
        content = read_text(target)
        for match in SCRIPT_REF_PATTERN.findall(content):
            script_path = REPO_ROOT / match
            if not script_path.exists():
                errors.append(f"{relative_path.as_posix()} 引用了不存在的脚本: {Path(match).as_posix()}")


def get_changed_files(diff_base: str) -> list[Path]:
    proc = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "diff", "--name-only", "--diff-filter=ACMR", f"{diff_base}...HEAD"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "git diff 执行失败")
    return [Path(line.strip()) for line in proc.stdout.splitlines() if line.strip()]


def ensure_diff_has_docs_updates(diff_base: str, errors: list[str]) -> list[Path]:
    changed_files = get_changed_files(diff_base)
    touched_flow_files = [
        path for path in changed_files if any(path.as_posix().startswith(prefix) for prefix in FLOW_PREFIXES)
    ]
    touched_docs = [path for path in changed_files if path in TRACKED_DOCS]
    if touched_flow_files and not touched_docs:
        errors.append(
            "检测到 scripts/、.githooks/ 或 .github/workflows/ 变更，但未同步更新 README.md / ROADMAP.md / docs/架构说明.md / docs/开发规范.md / docs/接口契约.md / docs/交易流水YAML导入规范.md / docs/P0线上故障排查SOP.md / docs/状态解释验收样例.md / docs/Git工作流.md / docs/最新进度.md / docs/部署与运行.md。"
        )
    return changed_files


def main() -> int:
    args = parse_args()
    errors: list[str] = []

    ensure_required_files(errors)
    ensure_required_snippets(errors)
    ensure_timestamp_format(errors)
    ensure_script_references_exist(errors)

    changed_files: list[Path] = []
    if args.diff_base:
        try:
            changed_files = ensure_diff_has_docs_updates(args.diff_base, errors)
        except RuntimeError as exc:
            errors.append(f"diff-base 校验失败: {exc}")

    if errors:
        print("[FAIL] docs gate 未通过。")
        for item in errors:
            print(f"- {item}")
        return 1

    print("[OK] docs gate 通过。")
    print(f"- 已校验文件数量: {len(REQUIRED_FILES)}")
    print(f"- 已校验文档数量: {len(TRACKED_DOCS)}")
    if args.diff_base:
        print(f"- diff-base: {args.diff_base}")
        print(f"- 变更文件数量: {len(changed_files)}")
    if args.strict:
        print("- 严格模式: 已启用")
    return 0


if __name__ == "__main__":
    sys.exit(main())
