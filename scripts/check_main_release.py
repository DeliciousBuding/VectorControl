from __future__ import annotations

import argparse
import re
import subprocess

from check_release_message import validate_message


RELEASE_TITLE_RE = re.compile(r"^发布[:：]\s*(v\d+\.\d+\.\d+)\s*-\s*\S.+$")
SEMVER_TAG_RE = re.compile(r"^v\d+\.\d+\.\d+$")


def _run_cmd(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _get_commit_message(commit: str) -> str:
    proc = _run_cmd(["git", "show", "-s", "--format=%s%n%b", commit])
    if proc.returncode != 0:
        raise RuntimeError(f"读取提交信息失败: {proc.stderr.strip()}")
    return proc.stdout.strip()


def _get_semver_tags_on_commit(commit: str) -> list[str]:
    proc = _run_cmd(["git", "tag", "--points-at", commit])
    if proc.returncode != 0:
        raise RuntimeError(f"读取提交 Tag 失败: {proc.stderr.strip()}")
    tags = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    return sorted([tag for tag in tags if SEMVER_TAG_RE.fullmatch(tag)])


def _tag_exists_on_remote(remote: str, tag: str) -> bool:
    proc = _run_cmd(["git", "ls-remote", "--tags", remote, f"refs/tags/{tag}"])
    if proc.returncode != 0:
        raise RuntimeError(f"检查远端 Tag 失败: {proc.stderr.strip()}")
    return bool(proc.stdout.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="校验 main 发布提交与 Tag 一致性。")
    parser.add_argument("--commit", default="HEAD", help="待校验提交，默认 HEAD。")
    parser.add_argument("--tag", default="", help="可选。显式指定期望 Tag。")
    parser.add_argument(
        "--allow-multiple-tags",
        action="store_true",
        help="允许同一提交存在多个语义化版本 Tag（默认不允许）。",
    )
    parser.add_argument(
        "--check-remote-tag",
        action="store_true",
        help="额外校验 Tag 已存在于远端。",
    )
    parser.add_argument("--remote", default="origin", help="远端名，默认 origin。")
    args = parser.parse_args()

    failures: list[str] = []
    commit = args.commit.strip()
    explicit_tag = args.tag.strip()

    try:
        message = _get_commit_message(commit)
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] {exc}")
        return 1

    message_errors = validate_message(message)
    if message_errors:
        failures.extend(message_errors)

    lines = message.splitlines()
    title = lines[0].strip() if lines else ""
    matched = RELEASE_TITLE_RE.match(title)
    if not matched:
        failures.append("发布标题格式错误，应为：发布: vX.Y.Z - 一句话摘要")
        title_version = ""
    else:
        title_version = matched.group(1)

    if explicit_tag:
        if not SEMVER_TAG_RE.fullmatch(explicit_tag):
            failures.append(f"显式 Tag 非语义化版本格式: {explicit_tag}")
        selected_tag = explicit_tag
        tags = [explicit_tag]
    else:
        try:
            tags = _get_semver_tags_on_commit(commit)
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL] {exc}")
            return 1
        if not tags:
            failures.append("发布提交缺少语义化版本 Tag（vX.Y.Z）。")
            selected_tag = ""
        else:
            if len(tags) > 1 and not args.allow_multiple_tags:
                failures.append("发布提交存在多个语义化版本 Tag，请保留唯一版本 Tag。")
            selected_tag = tags[0]

    if title_version and selected_tag and title_version != selected_tag:
        failures.append(f"标题版本号与 Tag 不一致: 标题={title_version}, Tag={selected_tag}")

    if args.check_remote_tag and selected_tag:
        try:
            exists = _tag_exists_on_remote(args.remote, selected_tag)
            if not exists:
                failures.append(f"远端未找到 Tag: {args.remote}/{selected_tag}")
        except Exception as exc:  # noqa: BLE001
            failures.append(str(exc))

    if failures:
        print("[FAIL] main 发布一致性校验失败:")
        for item in failures:
            print(f"- {item}")
        return 1

    print("[PASS] main 发布一致性校验通过")
    print(f"[INFO] commit={commit}")
    print(f"[INFO] tag={selected_tag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
