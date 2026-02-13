#!/usr/bin/env python3
"""
敏感信息泄露扫描脚本

功能：
- 扫描待推送的提交中是否包含敏感信息
- 检测 API Key、Token、密码等模式
- 支持白名单配置

用法：
    python scripts/check_secrets_leak.py
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

SENSITIVE_PATTERNS = [
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\'][a-zA-Z0-9_\-]{20,}["\']', 'API Key'),
    (r'(?i)(secret[_-]?key|secretkey)\s*[=:]\s*["\'][a-zA-Z0-9_\-]{20,}["\']', 'Secret Key'),
    (r'(?i)(access[_-]?token|accesstoken)\s*[=:]\s*["\'][a-zA-Z0-9_\-]{20,}["\']', 'Access Token'),
    (r'(?i)(auth[_-]?token|authtoken)\s*[=:]\s*["\'][a-zA-Z0-9_\-]{20,}["\']', 'Auth Token'),
    (r'(?i)(bot[_-]?token|bottoken)\s*[=:]\s*["\'][a-zA-Z0-9_\-]{20,}["\']', 'Bot Token'),
    (r'(?i)(password|passwd|pwd)\s*[=:]\s*["\'][^\s"\']{8,}["\']', 'Password'),
    (r'(?i)(private[_-]?key|privatekey)\s*[=:]\s*["\'][a-zA-Z0-9_\-]{40,}["\']', 'Private Key'),
    (r'-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----', 'RSA Private Key'),
    (r'sk-[a-zA-Z0-9]{20,}', 'OpenAI API Key'),
    (r'ghp_[a-zA-Z0-9]{36}', 'GitHub Personal Access Token'),
    (r'gho_[a-zA-Z0-9]{36}', 'GitHub OAuth Token'),
    (r'github_pat_[a-zA-Z0-9_]{22,}', 'GitHub Fine-grained Token'),
    (r'xox[baprs]-[a-zA-Z0-9\-]{10,}', 'Slack Token'),
    (r'[0-9]{8,10}:[a-zA-Z0-9_\-]{30,}', 'Telegram Bot Token'),
]

WHITELIST_PATTERNS = [
    r'runtime_token\.txt',
    r'\.env',
    r'\.env\.',
    r'secrets',
    r'credentials',
    r'_test\.',
    r'test_',
    r'__pycache__',
    r'\.pyc$',
    r'node_modules',
    r'\.git',
]

SKIP_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot',
    '.mp3', '.mp4', '.wav', '.avi',
    '.zip', '.tar', '.gz', '.rar',
    '.pyc', '.pyo', '.exe', '.dll',
    '.db', '.sqlite', '.sqlite3',
}


def is_whitelisted(filepath: str) -> bool:
    """检查文件是否在白名单中"""
    for pattern in WHITELIST_PATTERNS:
        if re.search(pattern, filepath, re.IGNORECASE):
            return True
    
    ext = Path(filepath).suffix.lower()
    if ext in SKIP_EXTENSIONS:
        return True
    
    return False


def get_staged_files() -> list[str]:
    """获取待推送的文件列表"""
    try:
        result = subprocess.run(
            ['git', 'diff', '--name-only', '--cached'],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split('\n')
    except Exception:
        pass
    
    try:
        result = subprocess.run(
            ['git', 'diff', '--name-only', 'origin/main...HEAD'],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split('\n')
    except Exception:
        pass
    
    return []


def scan_file(filepath: str) -> list[tuple[int, str, str]]:
    """扫描单个文件，返回 (行号, 匹配内容, 类型) 列表"""
    findings = []
    
    if not os.path.exists(filepath):
        return findings
    
    if is_whitelisted(filepath):
        return findings
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line_num, line in enumerate(f, 1):
                for pattern, desc in SENSITIVE_PATTERNS:
                    if re.search(pattern, line):
                        findings.append((line_num, line.strip()[:100], desc))
                        break
    except Exception:
        pass
    
    return findings


def main():
    """主函数"""
    print("扫描敏感信息...")
    
    files = get_staged_files()
    
    if not files:
        print("没有待扫描的文件")
        return 0
    
    all_findings = []
    
    for filepath in files:
        findings = scan_file(filepath)
        if findings:
            all_findings.append((filepath, findings))
    
    if all_findings:
        print("\n" + "=" * 60)
        print("检测到疑似敏感信息泄露！")
        print("=" * 60)
        
        for filepath, findings in all_findings:
            print(f"\n文件: {filepath}")
            for line_num, content, desc in findings:
                print(f"  行 {line_num}: [{desc}] {content}")
        
        print("\n请检查以上内容，确认是否为真实敏感信息。")
        print("如果是误报，可以将文件路径添加到白名单。")
        return 1
    
    print("未检测到敏感信息泄露")
    return 0


if __name__ == "__main__":
    sys.exit(main())
