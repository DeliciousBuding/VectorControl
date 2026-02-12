#!/usr/bin/env python3
"""
分支保护治理脚本

功能：
- 检查/应用 dev/main 分支保护规则
- 支持配置必需的状态检查
- 支持管理员口令确认

用法：
    python scripts/branch_protection.py --mode check
    python scripts/branch_protection.py --mode apply --confirm "确认执行"

环境变量：
    GITHUB_TOKEN 或 GH_TOKEN: GitHub 个人访问令牌
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Any, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
LOGGER = logging.getLogger("branch_protection")

DEFAULT_REQUIRED_CONTEXTS_DEV = ["Docs Gate / docs-gate"]
DEFAULT_REQUIRED_CONTEXTS_MAIN = [
    "Docs Gate / docs-gate",
    "Release Consistency / verify-release",
]


@dataclass
class BranchProtectionRule:
    """分支保护规则"""
    branch: str
    required_status_checks: list[str] = field(default_factory=list)
    enforce_admins: bool = False
    required_pull_request_reviews: dict[str, Any] = field(default_factory=dict)
    restrictions: dict[str, Any] = field(default_factory=dict)
    allow_force_pushes: bool = False
    allow_deletions: bool = False


def get_github_token() -> Optional[str]:
    """获取 GitHub Token"""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token

    try:
        result = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass

    return None


def get_repo_info() -> tuple[Optional[str], Optional[str]]:
    """获取仓库 owner 和 repo 名称"""
    try:
        result = subprocess.run(
            ["gh", "repo", "view", "--json", "owner,name"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("owner", {}).get("login"), data.get("name")
    except Exception:
        pass

    return None, None


def get_branch_protection(owner: str, repo: str, branch: str, token: str) -> Optional[dict]:
    """获取分支保护规则"""
    import urllib.request
    import urllib.error

    url = f"https://api.github.com/repos/{owner}/{repo}/branches/{branch}/protection"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
        req = urllib.request.Request(url=url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        LOGGER.error("获取分支保护规则失败: %s", e)
        return None
    except Exception as e:
        LOGGER.error("请求失败: %s", e)
        return None


def update_branch_protection(
    owner: str,
    repo: str,
    branch: str,
    token: str,
    rule: BranchProtectionRule,
) -> bool:
    """更新分支保护规则"""
    import urllib.request
    import urllib.error

    url = f"https://api.github.com/repos/{owner}/{repo}/branches/{branch}/protection"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    }

    payload = {
        "required_status_checks": {
            "strict": True,
            "contexts": rule.required_status_checks,
        },
        "enforce_admins": rule.enforce_admins,
        "required_pull_request_reviews": rule.required_pull_request_reviews or None,
        "restrictions": rule.restrictions or None,
        "allow_force_pushes": rule.allow_force_pushes,
        "allow_deletions": rule.allow_deletions,
    }

    try:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url=url, data=body, headers=headers, method="PUT")
        with urllib.request.urlopen(req, timeout=30) as resp:
            json.loads(resp.read().decode("utf-8"))
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        LOGGER.error("更新分支保护规则失败: %s - %s", e, error_body)
        return False
    except Exception as e:
        LOGGER.error("请求失败: %s", e)
        return False


def check_branch_protection(
    owner: str,
    repo: str,
    branch: str,
    token: str,
    expected_contexts: list[str],
) -> dict[str, Any]:
    """检查分支保护规则"""
    result = {
        "branch": branch,
        "exists": False,
        "required_contexts": [],
        "expected_contexts": expected_contexts,
        "missing_contexts": [],
        "extra_contexts": [],
        "compliant": False,
    }

    protection = get_branch_protection(owner, repo, branch, token)
    if not protection:
        result["missing_contexts"] = list(expected_contexts)
        return result

    result["exists"] = True
    checks = protection.get("required_status_checks", {})
    result["required_contexts"] = checks.get("contexts", [])

    expected_set = set(expected_contexts)
    actual_set = set(result["required_contexts"])

    result["missing_contexts"] = list(expected_set - actual_set)
    result["extra_contexts"] = list(actual_set - expected_set)
    result["compliant"] = len(result["missing_contexts"]) == 0

    return result


def main():
    parser = argparse.ArgumentParser(
        description="分支保护治理脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["check", "apply"],
        required=True,
        help="操作模式: check=检查, apply=应用",
    )
    parser.add_argument(
        "--dev-required-contexts",
        nargs="*",
        default=DEFAULT_REQUIRED_CONTEXTS_DEV,
        help=f"dev 分支必需的状态检查 (默认: {DEFAULT_REQUIRED_CONTEXTS_DEV})",
    )
    parser.add_argument(
        "--main-required-contexts",
        nargs="*",
        default=DEFAULT_REQUIRED_CONTEXTS_MAIN,
        help=f"main 分支必需的状态检查 (默认: {DEFAULT_REQUIRED_CONTEXTS_MAIN})",
    )
    parser.add_argument(
        "--confirm",
        type=str,
        default=None,
        help="管理员确认口令 (apply 模式必需)",
    )

    args = parser.parse_args()

    token = get_github_token()
    if not token:
        LOGGER.error("未找到 GitHub Token，请设置 GITHUB_TOKEN 或 GH_TOKEN 环境变量")
        sys.exit(1)

    owner, repo = get_repo_info()
    if not owner or not repo:
        LOGGER.error("无法获取仓库信息，请在仓库目录下运行")
        sys.exit(1)

    LOGGER.info("仓库: %s/%s", owner, repo)

    if args.mode == "apply":
        if args.confirm != "确认执行":
            LOGGER.error("apply 模式需要管理员口令 --confirm '确认执行'")
            sys.exit(1)

    results = []

    for branch, contexts in [
        ("dev", args.dev_required_contexts),
        ("main", args.main_required_contexts),
    ]:
        LOGGER.info("检查分支: %s", branch)

        if args.mode == "check":
            result = check_branch_protection(owner, repo, branch, token, contexts)
            results.append(result)

            if result["compliant"]:
                LOGGER.info("  ✓ 分支保护规则符合预期")
            else:
                LOGGER.warning("  ✗ 分支保护规则不符合预期")
                if result["missing_contexts"]:
                    LOGGER.warning("    缺少: %s", result["missing_contexts"])
                if result["extra_contexts"]:
                    LOGGER.warning("    多余: %s", result["extra_contexts"])

        elif args.mode == "apply":
            rule = BranchProtectionRule(
                branch=branch,
                required_status_checks=contexts,
                enforce_admins=False,
                required_pull_request_reviews={
                    "dismiss_stale_reviews": True,
                    "require_code_owner_reviews": False,
                },
                allow_force_pushes=False,
                allow_deletions=False,
            )

            LOGGER.info("  应用分支保护规则...")
            success = update_branch_protection(owner, repo, branch, token, rule)

            if success:
                LOGGER.info("  ✓ 分支保护规则已更新")
                results.append({"branch": branch, "success": True})
            else:
                LOGGER.error("  ✗ 分支保护规则更新失败")
                results.append({"branch": branch, "success": False})

    print("\n" + "=" * 60)
    print("分支保护治理结果")
    print("=" * 60)
    print(json.dumps(results, ensure_ascii=False, indent=2))

    if args.mode == "check":
        all_compliant = all(r.get("compliant", False) for r in results)
        if not all_compliant:
            sys.exit(1)

    if args.mode == "apply":
        all_success = all(r.get("success", False) for r in results)
        if not all_success:
            sys.exit(1)


if __name__ == "__main__":
    main()
