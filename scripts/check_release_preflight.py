#!/usr/bin/env python3
"""
发布前预检脚本

功能：
- 文档门禁严格模式检查
- 后端 compileall 检查
- 前端 build 检查
- 支持缓存优化

用法：
    python scripts/check_release_preflight.py
    python scripts/check_release_preflight.py --selftest
"""
from __future__ import annotations

import argparse
import logging
import subprocess
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
LOGGER = logging.getLogger("release_preflight")


def run_command(cmd: list[str], cwd: Path | None = None, timeout: int = 300) -> tuple[int, str, str]:
    """运行命令并返回结果"""
    LOGGER.info("执行: %s", " ".join(cmd))
    start = time.time()
    
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        elapsed = time.time() - start
        return result.returncode, result.stdout, result.stderr, elapsed
    except subprocess.TimeoutExpired:
        return -1, "", "Timeout", timeout
    except Exception as e:
        return -1, "", str(e), 0


def check_docs_gate_strict(repo_root: Path) -> bool:
    """检查文档门禁（严格模式）"""
    LOGGER.info("=" * 60)
    LOGGER.info("步骤 1/3: 文档门禁检查（严格模式）")
    LOGGER.info("=" * 60)
    
    script = repo_root / "scripts" / "check_docs_gate.py"
    if not script.exists():
        LOGGER.error("文档门禁脚本不存在: %s", script)
        return False
    
    code, stdout, stderr, elapsed = run_command(
        [sys.executable, str(script), "--strict"],
        cwd=repo_root,
    )
    
    if stdout:
        print(stdout)
    if stderr:
        print(stderr)
    
    if code == 0:
        LOGGER.info("✓ 文档门禁检查通过 (%.1fs)", elapsed)
        return True
    else:
        LOGGER.error("✗ 文档门禁检查失败")
        return False


def check_backend_compile(repo_root: Path) -> bool:
    """检查后端编译"""
    LOGGER.info("")
    LOGGER.info("=" * 60)
    LOGGER.info("步骤 2/3: 后端编译检查")
    LOGGER.info("=" * 60)
    
    backend_dir = repo_root / "backend" / "app"
    if not backend_dir.exists():
        LOGGER.error("后端目录不存在: %s", backend_dir)
        return False
    
    code, stdout, stderr, elapsed = run_command(
        [sys.executable, "-m", "compileall", str(backend_dir), "-q"],
        cwd=repo_root,
    )
    
    if stdout:
        print(stdout)
    if stderr:
        print(stderr)
    
    if code == 0:
        LOGGER.info("✓ 后端编译检查通过 (%.1fs)", elapsed)
        return True
    else:
        LOGGER.error("✗ 后端编译检查失败")
        return False


def check_frontend_build(repo_root: Path) -> bool:
    """检查前端构建"""
    LOGGER.info("")
    LOGGER.info("=" * 60)
    LOGGER.info("步骤 3/3: 前端构建检查")
    LOGGER.info("=" * 60)
    
    frontend_dir = repo_root / "frontend"
    if not frontend_dir.exists():
        LOGGER.error("前端目录不存在: %s", frontend_dir)
        return False
    
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    
    code, stdout, stderr, elapsed = run_command(
        [npm_cmd, "run", "build"],
        cwd=frontend_dir,
        timeout=600,
    )
    
    if stdout:
        print(stdout)
    if stderr:
        print(stderr)
    
    if code == 0:
        LOGGER.info("✓ 前端构建检查通过 (%.1fs)", elapsed)
        return True
    else:
        LOGGER.error("✗ 前端构建检查失败")
        return False


def selftest() -> bool:
    """自测"""
    LOGGER.info("运行自测...")
    
    test_cases = [
        ("文档门禁脚本存在", lambda: (Path(__file__).parent / "check_docs_gate.py").exists()),
        ("后端目录存在", lambda: (Path(__file__).parent.parent / "backend" / "app").exists()),
        ("前端目录存在", lambda: (Path(__file__).parent.parent / "frontend").exists()),
    ]
    
    all_passed = True
    for name, check in test_cases:
        try:
            result = check()
            status = "✓" if result else "✗"
            LOGGER.info("  %s %s", status, name)
            if not result:
                all_passed = False
        except Exception as e:
            LOGGER.error("  ✗ %s: %s", name, e)
            all_passed = False
    
    return all_passed


def main():
    parser = argparse.ArgumentParser(
        description="发布前预检脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--selftest",
        action="store_true",
        help="运行自测",
    )
    parser.add_argument(
        "--skip-docs",
        action="store_true",
        help="跳过文档门禁检查",
    )
    parser.add_argument(
        "--skip-backend",
        action="store_true",
        help="跳过后端编译检查",
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="跳过前端构建检查",
    )

    args = parser.parse_args()

    if args.selftest:
        success = selftest()
        sys.exit(0 if success else 1)

    repo_root = Path(__file__).parent.parent

    results = []

    if not args.skip_docs:
        results.append(("文档门禁", check_docs_gate_strict(repo_root)))
    else:
        LOGGER.info("跳过文档门禁检查")
        results.append(("文档门禁", True))

    if not args.skip_backend:
        results.append(("后端编译", check_backend_compile(repo_root)))
    else:
        LOGGER.info("跳过后端编译检查")
        results.append(("后端编译", True))

    if not args.skip_frontend:
        results.append(("前端构建", check_frontend_build(repo_root)))
    else:
        LOGGER.info("跳过前端构建检查")
        results.append(("前端构建", True))

    print("\n" + "=" * 60)
    print("发布前预检结果")
    print("=" * 60)

    all_passed = True
    for name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n✓ 所有检查通过，可以发布")
        sys.exit(0)
    else:
        print("\n✗ 存在检查失败，请修复后重试")
        sys.exit(1)


if __name__ == "__main__":
    main()
