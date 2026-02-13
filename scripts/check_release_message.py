#!/usr/bin/env python3
"""
提交信息规范检查脚本

功能：
- 检查提交信息是否符合规范
- 必须包含四段：新增/修复/优化/文档
- 文档段必须包含检查范围、更新结论、延后项

用法：
    python scripts/check_release_message.py <commit_msg_file>
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def check_commit_message(msg: str) -> tuple[bool, list[str]]:
    """检查提交信息是否符合规范
    
    Returns:
        (is_valid, errors): 是否有效，错误列表
    """
    errors = []
    
    lines = msg.strip().split('\n')
    if not lines:
        errors.append("提交信息不能为空")
        return False, errors
    
    first_line = lines[0].strip()
    
    valid_prefixes = ['新增:', '修复:', '优化:', '文档:', 'chore:', 'feat:', 'fix:', 'refactor:', 'docs:', 'test:', 'style:', 'perf:', 'ci:', 'build:', 'revert:']
    
    has_valid_prefix = any(first_line.startswith(prefix) for prefix in valid_prefixes)
    if not has_valid_prefix:
        errors.append(f"提交信息第一行必须以以下前缀之一开头: {', '.join(valid_prefixes)}")
    
    if len(first_line) > 100:
        errors.append(f"提交信息第一行长度不能超过100字符（当前: {len(first_line)}）")
    
    if len(lines) > 1:
        body = '\n'.join(lines[1:]).strip()
        
        required_sections = ['文档:']
        for section in required_sections:
            if section not in body:
                errors.append(f"提交信息正文必须包含 '{section}' 段")
        
        if '文档:' in body:
            doc_section_match = re.search(r'文档:\s*(.+?)(?=\n\n|\n*$|$)', body, re.DOTALL)
            if doc_section_match:
                doc_section = doc_section_match.group(1)
                
                if '检查范围' not in doc_section:
                    errors.append("文档段必须包含 '检查范围'")
                if '更新结论' not in doc_section:
                    errors.append("文档段必须包含 '更新结论'")
                if '延后项' not in doc_section:
                    errors.append("文档段必须包含 '延后项'")
    
    return len(errors) == 0, errors


def main():
    if len(sys.argv) < 2:
        print("用法: python check_release_message.py <commit_msg_file>")
        return 1
    
    msg_file = Path(sys.argv[1])
    if not msg_file.exists():
        print(f"文件不存在: {msg_file}")
        return 1
    
    try:
        msg = msg_file.read_text(encoding='utf-8')
    except Exception as e:
        print(f"读取文件失败: {e}")
        return 1
    
    is_valid, errors = check_commit_message(msg)
    
    if is_valid:
        print("提交信息格式正确")
        return 0
    else:
        print("提交信息格式错误:")
        for error in errors:
            print(f"  - {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
