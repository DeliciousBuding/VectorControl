#!/usr/bin/env python3
"""
Git提交信息检查脚本
用于验证提交信息是否符合规范
"""

import sys
import re

def check_commit_message(message_file):
    """检查提交信息格式"""
    with open(message_file, 'r', encoding='utf-8') as f:
        message = f.read()
    
    # 允许空提交（如merge）
    if not message.strip():
        return 0
    
    # 检查是否是合并提交
    if message.startswith('Merge'):
        return 0
    
    # 检查是否是revert提交
    if message.startswith('Revert'):
        return 0
    
    # 检查提交信息格式：type(scope): subject
    pattern = r'^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+'
    
    lines = message.strip().split('\n')
    first_line = lines[0]
    
    if not re.match(pattern, first_line):
        print("[HOOK] commit-msg 阻断：提交信息不符合规范。")
        print("格式要求: type(scope): subject")
        print("type可选: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert")
        print("示例: feat(frontend): 添加用户登录功能")
        return 1
    
    return 0

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: check_release_message.py <commit-message-file>")
        sys.exit(1)
    
    sys.exit(check_commit_message(sys.argv[1]))
