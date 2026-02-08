from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from dataclasses import dataclass
from typing import Any
from urllib import error, request


DEFAULT_BRANCHES = ("dev", "main")
DEFAULT_CONTEXTS = ("Docs Gate / docs-gate",)


@dataclass
class RepoRef:
    owner: str
    repo: str


def _run_cmd(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _parse_repo_from_remote(url: str) -> RepoRef | None:
    text = url.strip()
    if not text:
        return None

    https = re.match(r"^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?$", text)
    if https:
        return RepoRef(owner=https.group(1), repo=https.group(2))

    ssh = re.match(r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$", text)
    if ssh:
        return RepoRef(owner=ssh.group(1), repo=ssh.group(2))

    return None


def _resolve_repo(owner: str, repo: str) -> RepoRef:
    if owner and repo:
        return RepoRef(owner=owner.strip(), repo=repo.strip())

    remote = _run_cmd(["git", "config", "--get", "remote.origin.url"])
    if remote.returncode != 0 or not remote.stdout.strip():
        raise RuntimeError("无法读取 remote.origin.url，请通过 --owner/--repo 指定仓库。")

    parsed = _parse_repo_from_remote(remote.stdout.strip())
    if not parsed:
        raise RuntimeError(
            f"无法从 remote URL 解析 GitHub 仓库: {remote.stdout.strip()}，请通过 --owner/--repo 指定。"
        )
    return parsed


def _resolve_github_token() -> tuple[str, str]:
    for key in ("GITHUB_TOKEN", "GH_TOKEN"):
        token = os.getenv(key, "").strip()
        if token:
            return token, f"环境变量 {key}"

    try:
        gh = _run_cmd(["gh", "auth", "token"])
        if gh.returncode == 0 and gh.stdout.strip():
            return gh.stdout.strip(), "gh auth token"
    except FileNotFoundError:
        return "", ""

    return "", ""


def _github_request(
    token: str,
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "vectorcontrol-branch-protection-script",
    }
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    req = request.Request(url=url, method=method, headers=headers, data=data)
    try:
        with request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        detail = body.strip() or f"HTTP {exc.code}"
        raise RuntimeError(f"GitHub API 请求失败: {method} {url} -> {exc.code} {detail}") from exc
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"GitHub API 请求异常: {method} {url} -> {exc}") from exc


def _unique_contexts(items: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = item.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def _protection_payload(required_contexts: list[str], approvals: int) -> dict[str, Any]:
    return {
        "required_status_checks": {
            "strict": True,
            "contexts": required_contexts,
        },
        "enforce_admins": True,
        "required_pull_request_reviews": {
            "dismiss_stale_reviews": True,
            "require_code_owner_reviews": False,
            "required_approving_review_count": approvals,
        },
        "restrictions": None,
    }


def _branch_contexts(
    branch: str,
    global_required: list[str],
    dev_extra: list[str],
    main_extra: list[str],
) -> list[str]:
    extras: list[str] = []
    if branch == "dev":
        extras = dev_extra
    elif branch == "main":
        extras = main_extra
    return _unique_contexts([*global_required, *extras])


def _check_branch(
    token: str,
    repo_ref: RepoRef,
    branch: str,
    required_contexts: list[str],
    min_approvals: int,
) -> list[str]:
    url = f"https://api.github.com/repos/{repo_ref.owner}/{repo_ref.repo}/branches/{branch}/protection"
    data = _github_request(token=token, method="GET", url=url)
    errors: list[str] = []

    status_checks = data.get("required_status_checks") or {}
    contexts = status_checks.get("contexts") or []
    strict = bool(status_checks.get("strict"))
    for required_context in required_contexts:
        if required_context not in contexts:
            errors.append(f"[{branch}] 缺少必需状态检查: {required_context}")
    if not strict:
        errors.append(f"[{branch}] required_status_checks.strict 未开启")

    reviews = data.get("required_pull_request_reviews") or {}
    approvals = int(reviews.get("required_approving_review_count") or 0)
    if approvals < min_approvals:
        errors.append(f"[{branch}] 审核数不足: {approvals} < {min_approvals}")

    enforce_admins = data.get("enforce_admins") or {}
    enabled = bool(enforce_admins.get("enabled")) if isinstance(enforce_admins, dict) else bool(enforce_admins)
    if not enabled:
        errors.append(f"[{branch}] enforce_admins 未开启")

    return errors


def _apply_branch(
    token: str,
    repo_ref: RepoRef,
    branch: str,
    required_contexts: list[str],
    approvals: int,
) -> None:
    url = f"https://api.github.com/repos/{repo_ref.owner}/{repo_ref.repo}/branches/{branch}/protection"
    payload = _protection_payload(required_contexts=required_contexts, approvals=approvals)
    _github_request(token=token, method="PUT", url=url, payload=payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="检查或应用 GitHub 分支保护规则。")
    parser.add_argument("--owner", default="", help="GitHub owner，缺省时从 remote.origin.url 自动解析。")
    parser.add_argument("--repo", default="", help="GitHub repo，缺省时从 remote.origin.url 自动解析。")
    parser.add_argument(
        "--branches",
        nargs="+",
        default=list(DEFAULT_BRANCHES),
        help="要检查/应用的分支列表，默认: dev main",
    )
    parser.add_argument(
        "--required-contexts",
        nargs="+",
        default=list(DEFAULT_CONTEXTS),
        help="必需状态检查名称列表，默认: Docs Gate / docs-gate",
    )
    parser.add_argument(
        "--required-context",
        default="",
        help="兼容旧参数。单个必需状态检查名称（会追加到 --required-contexts）。",
    )
    parser.add_argument(
        "--dev-required-contexts",
        nargs="*",
        default=[],
        help="仅对 dev 分支额外要求的状态检查名称列表。",
    )
    parser.add_argument(
        "--main-required-contexts",
        nargs="*",
        default=[],
        help="仅对 main 分支额外要求的状态检查名称列表（例如 Release Consistency / verify-release）。",
    )
    parser.add_argument("--min-approvals", type=int, default=1, help="最小审核通过数，默认 1。")
    parser.add_argument(
        "--mode",
        choices=["check", "apply"],
        default="check",
        help="check: 仅检查；apply: 直接写入分支保护规则。",
    )
    args = parser.parse_args()

    required_contexts = _unique_contexts([*args.required_contexts, args.required_context])
    dev_required_contexts = _unique_contexts(args.dev_required_contexts)
    main_required_contexts = _unique_contexts(args.main_required_contexts)
    if not required_contexts:
        print("[FAIL] 必需状态检查列表为空，请至少提供一个 --required-contexts。")
        return 1

    token, token_source = _resolve_github_token()
    if not token:
        print("[FAIL] 缺少 GitHub 鉴权凭据。")
        print("提示：可选择以下任一方式后重试：")
        print("1) 设置 GITHUB_TOKEN/GH_TOKEN（需具备 repo admin 权限）")
        print("2) 执行 gh auth login 后使用 gh auth token 回退")
        return 1
    print(f"[INFO] 使用鉴权来源: {token_source}")

    try:
        repo_ref = _resolve_repo(owner=args.owner, repo=args.repo)
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] 仓库解析失败: {exc}")
        return 1

    if args.mode == "apply":
        print(f"[INFO] 开始应用分支保护: {repo_ref.owner}/{repo_ref.repo}")
        print(f"[INFO] 全局必需状态检查: {', '.join(required_contexts)}")
        for branch in args.branches:
            branch_required = _branch_contexts(
                branch=branch,
                global_required=required_contexts,
                dev_extra=dev_required_contexts,
                main_extra=main_required_contexts,
            )
            print(f"[INFO] {branch} 目标状态检查: {', '.join(branch_required)}")
            try:
                _apply_branch(
                    token=token,
                    repo_ref=repo_ref,
                    branch=branch,
                    required_contexts=branch_required,
                    approvals=args.min_approvals,
                )
                print(f"[PASS] 已应用分支保护: {branch}")
            except Exception as exc:  # noqa: BLE001
                print(f"[FAIL] 应用分支保护失败: {branch} -> {exc}")
                return 1

    print(f"[INFO] 开始检查分支保护: {repo_ref.owner}/{repo_ref.repo}")
    print(f"[INFO] 全局期望状态检查: {', '.join(required_contexts)}")
    all_errors: list[str] = []
    for branch in args.branches:
        branch_required = _branch_contexts(
            branch=branch,
            global_required=required_contexts,
            dev_extra=dev_required_contexts,
            main_extra=main_required_contexts,
        )
        print(f"[INFO] {branch} 期望状态检查: {', '.join(branch_required)}")
        try:
            errors = _check_branch(
                token=token,
                repo_ref=repo_ref,
                branch=branch,
                required_contexts=branch_required,
                min_approvals=args.min_approvals,
            )
            if errors:
                all_errors.extend(errors)
            else:
                print(f"[PASS] 分支保护符合预期: {branch}")
        except Exception as exc:  # noqa: BLE001
            all_errors.append(f"[{branch}] 检查失败: {exc}")

    if all_errors:
        print("[FAIL] 分支保护检查失败:")
        for item in all_errors:
            print(f"- {item}")
        return 1

    print("[PASS] 分支保护检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
