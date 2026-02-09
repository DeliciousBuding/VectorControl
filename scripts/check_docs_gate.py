from __future__ import annotations

import argparse
from datetime import datetime, timedelta
import re
import subprocess
from pathlib import Path


REQUIRED_DOCS = [
    Path("README.md"),
    Path("ROADMAP.md"),
    Path("docs/架构说明.md"),
    Path("docs/开发规范.md"),
    Path("docs/接口契约.md"),
    Path("docs/交易流水YAML导入规范.md"),
    Path("docs/P0线上故障排查SOP.md"),
    Path("docs/状态解释验收样例.md"),
    Path("docs/最新进度.md"),
    Path("docs/Git工作流.md"),
    Path("docs/部署与运行.md"),
]

RELEASE_TEMPLATE = Path(".gitmessage-zh.txt")
REQUIRED_TEMPLATE_SECTIONS = ["新增:", "修复:", "优化:", "文档:"]
DOC_SCOPE_FILES = [
    Path("AGENTS.md"),
    Path("ROADMAP.md"),
    Path("docs/开发规范.md"),
    Path("docs/Git工作流.md"),
    Path("docs/部署与运行.md"),
]
REQUIRED_GATE_FILES: dict[Path, list[str]] = {
    Path("scripts/check_release_preflight.py"): [
        "scripts/check_docs_gate.py",
        "scripts/check_secrets_leak.py",
        "compileall",
        "npm",
    ],
    Path(".githooks/pre-push"): [
        "python scripts/check_secrets_leak.py",
        "python scripts/check_docs_gate.py --strict",
    ],
    Path(".githooks/commit-msg"): [
        "python scripts/check_release_message.py",
    ],
    Path(".github/workflows/docs-gate.yml"): [
        "name: Docs Gate",
        "python scripts/check_docs_gate.py --strict",
    ],
    Path(".github/workflows/release-consistency.yml"): [
        "name: Release Consistency",
        "python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin",
    ],
}
TIMESTAMP_REQUIRED_FILES = [
    Path("ROADMAP.md"),
    Path("docs/架构说明.md"),
    Path("docs/最新进度.md"),
]


def _run_cmd(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _assert_utf8_without_bom(path: Path, errors: list[str]) -> None:
    if not path.exists():
        errors.append(f"缺少必需文档: {path.as_posix()}")
        return

    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        errors.append(f"文档编码不符合要求（含 BOM）: {path.as_posix()}")
        return

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        errors.append(f"文档编码不符合要求（非 UTF-8）: {path.as_posix()}")
        return

    if not text.strip():
        errors.append(f"文档内容为空: {path.as_posix()}")


def _parse_changed_paths(status_output: str) -> set[str]:
    changed: set[str] = set()
    for line in status_output.splitlines():
        if not line.strip():
            continue
        content = line[3:].strip()
        if " -> " in content:
            content = content.split(" -> ", 1)[1].strip()
        if content:
            changed.add(content.replace("\\", "/"))
    return changed


def _parse_name_only_paths(output: str) -> set[str]:
    changed: set[str] = set()
    for line in output.splitlines():
        item = line.strip().replace("\\", "/")
        if item:
            changed.add(item)
    return changed


def _is_doc_file(path: str) -> bool:
    return path == "README.md" or path == "ROADMAP.md" or path.startswith("docs/")


def _check_release_template(errors: list[str]) -> None:
    if not RELEASE_TEMPLATE.exists():
        errors.append("缺少发布模板文件: .gitmessage-zh.txt")
        return

    local_errors: list[str] = []
    _assert_utf8_without_bom(RELEASE_TEMPLATE, local_errors)
    if local_errors:
        errors.extend(local_errors)
        return

    text = RELEASE_TEMPLATE.read_text(encoding="utf-8")
    missing = [section for section in REQUIRED_TEMPLATE_SECTIONS if section not in text]
    if missing:
        errors.append(
            "发布模板缺少必需段落: " + ", ".join(missing) + "（应包含 新增/修复/优化/文档）"
        )


def _check_doc_scope_sync(errors: list[str]) -> None:
    scope_texts: dict[Path, str] = {}
    for scope_file in DOC_SCOPE_FILES:
        if not scope_file.exists():
            errors.append(f"缺少文档范围定义文件: {scope_file.as_posix()}")
            continue
        try:
            scope_texts[scope_file] = scope_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"文档编码不符合要求（非 UTF-8）: {scope_file.as_posix()}")

    for required_doc in REQUIRED_DOCS:
        token = required_doc.as_posix()
        for scope_file, text in scope_texts.items():
            if token not in text:
                errors.append(
                    f"文档巡检范围未同步: {scope_file.as_posix()} 缺少 {token}"
                )


def _check_gate_files(errors: list[str]) -> None:
    for path, required_tokens in REQUIRED_GATE_FILES.items():
        if not path.exists():
            errors.append(f"缺少门禁文件: {path.as_posix()}")
            continue

        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            errors.append(f"门禁文件编码不符合要求（含 BOM）: {path.as_posix()}")
            continue

        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            errors.append(f"门禁文件编码不符合要求（非 UTF-8）: {path.as_posix()}")
            continue

        if not text.strip():
            errors.append(f"门禁文件内容为空: {path.as_posix()}")
            continue

        for token in required_tokens:
            if token not in text:
                errors.append(
                    f"门禁文件缺少关键内容: {path.as_posix()} 缺少 `{token}`"
                )


def _check_update_timestamps(errors: list[str]) -> None:
    pattern = re.compile(r"^更新时间：(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$")
    now = datetime.now()
    future_tolerance = timedelta(minutes=10)

    for path in TIMESTAMP_REQUIRED_FILES:
        if not path.exists():
            errors.append(f"缺少更新时间校验文件: {path.as_posix()}")
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            errors.append(f"更新时间校验文件编码不符合要求（非 UTF-8）: {path.as_posix()}")
            continue

        matched_line = None
        for line in lines:
            if line.startswith("更新时间："):
                matched_line = line.strip()
                break

        if not matched_line:
            errors.append(f"缺少“更新时间”字段: {path.as_posix()}")
            continue

        m = pattern.match(matched_line)
        if not m:
            errors.append(
                f"更新时间格式不合法（必须为 `更新时间：YYYY-MM-DD HH:MM:SS`）: "
                f"{path.as_posix()} -> {matched_line}"
            )
            continue

        try:
            ts = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            errors.append(f"更新时间不可解析: {path.as_posix()} -> {matched_line}")
            continue

        if ts > now + future_tolerance:
            errors.append(
                f"更新时间异常（晚于当前系统时间过多）: {path.as_posix()} -> {matched_line}"
            )


def _collect_changed_paths(diff_base: str | None, failures: list[str]) -> set[str]:
    if diff_base:
        diff_proc = _run_cmd(["git", "diff", "--name-only", "--diff-filter=ACMR", f"{diff_base}...HEAD"])
        if diff_proc.returncode != 0:
            failures.append(
                f"读取 git diff 失败: {diff_proc.stderr.strip()}（diff_base={diff_base}）"
            )
            return set()
        return _parse_name_only_paths(diff_proc.stdout)

    git_status = _run_cmd(["git", "status", "--porcelain"])
    if git_status.returncode != 0:
        failures.append(f"读取 git 状态失败: {git_status.stderr.strip()}")
        return set()
    return _parse_changed_paths(git_status.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description="检查 main 发布前文档门禁。")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="严格模式：存在非文档改动时，要求核心文档列表至少有 1 个文件发生改动。",
    )
    parser.add_argument(
        "--diff-base",
        default="",
        help="可选。使用 `git diff <diff_base>...HEAD` 作为改动来源，适用于 CI 场景。",
    )
    args = parser.parse_args()

    failures: list[str] = []
    warnings: list[str] = []

    for path in REQUIRED_DOCS:
        _assert_utf8_without_bom(path, failures)

    _check_release_template(failures)
    _check_doc_scope_sync(failures)
    _check_gate_files(failures)
    _check_update_timestamps(failures)

    diff_base = args.diff_base.strip() or None
    changed_paths = _collect_changed_paths(diff_base, failures)
    if not failures:
        changed_docs = {p for p in changed_paths if _is_doc_file(p)}
        changed_non_docs = {p for p in changed_paths if not _is_doc_file(p)}
        required_doc_paths = {p.as_posix() for p in REQUIRED_DOCS}
        changed_required_docs = sorted(changed_docs & required_doc_paths)

        if changed_non_docs and not changed_required_docs:
            failures.append(
                "检测到非文档改动，但核心文档未同步改动。"
                "请至少更新一个核心文档并在发布说明的“文档”段落留痕。"
            )

        if args.strict and changed_non_docs and len(changed_required_docs) < 1:
            failures.append("严格模式检查失败：核心文档改动数为 0。")

        if not changed_paths:
            if diff_base:
                warnings.append(
                    f"diff 模式下未检测到变更（diff_base={diff_base}）；仅执行了结构与模板检查。"
                )
            else:
                warnings.append("当前工作区无改动；仅执行了结构与模板检查。")

    if failures:
        print("[FAIL] 文档门禁检查失败:")
        for item in failures:
            print(f"- {item}")
        if warnings:
            print("[WARN] 额外提示:")
            for item in warnings:
                print(f"- {item}")
        return 1

    if warnings:
        print("[WARN] 文档门禁附加提示:")
        for item in warnings:
            print(f"- {item}")
    print("[PASS] 文档门禁检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
