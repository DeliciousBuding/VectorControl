#!/usr/bin/env python3
"""
测试 Telegram Webhook 端点的脚本

用法:
    python test_telegram_webhook.py [--host HOST] [--port PORT]
"""

import argparse
import json
import requests
import sys


def test_telegram_webhook(host: str, port: int, dry_run: bool = True):
    """测试 Telegram Webhook 端点"""
    base_url = f"http://{host}:{port}/api/settings"
    
    webhook_payload = {
        "update_id": 123456789,
        "message": {
            "message_id": 123,
            "from": {
                "id": 987654321,
                "is_bot": False,
                "first_name": "TestUser",
                "language_code": "zh-CN"
            },
            "chat": {
                "id": 987654321,
                "type": "private",
                "first_name": "TestUser"
            },
            "date": 1699999999,
            "text": "/start"
        }
    }
    
    print("=" * 60)
    print("测试 Telegram Webhook 端点")
    print("=" * 60)
    print()
    
    webhook_url = f"{base_url}/notifications/telegram/webhook"
    print(f"发送 Webhook 请求到: {webhook_url}")
    print(f"请求体: {json.dumps(webhook_payload, ensure_ascii=False, indent=2)}")
    print()
    
    if dry_run:
        print("[DRY RUN] 不会实际发送请求")
        return True
    
    try:
        response = requests.post(
            webhook_url,
            json=webhook_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应体: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        
        if response.status_code == 200:
            print("\n[OK] Webhook 端点测试成功!")
            return True
        else:
            print("\n[FAIL] Webhook 端点测试失败!")
            return False
    except requests.exceptions.RequestException as e:
        print(f"\n[FAIL] 请求失败: {e}")
        return False


def test_get_discovered_chat_ids(host: str, port: int, dry_run: bool = True):
    """测试获取发现的 Chat ID"""
    base_url = f"http://{host}:{port}/api/settings"
    
    print("=" * 60)
    print("测试获取发现的 Chat ID")
    print("=" * 60)
    print()
    
    url = f"{base_url}/notifications/telegram/discovered_chat_ids"
    print(f"发送 GET 请求到: {url}")
    print()
    
    if dry_run:
        print("[DRY RUN] 不会实际发送请求")
        return True
    
    try:
        response = requests.get(url, timeout=10)
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应体: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        
        if response.status_code == 200:
            print("\n[OK] 获取发现的 Chat ID 测试成功!")
            return True
        else:
            print("\n[FAIL] 获取发现的 Chat ID 测试失败!")
            return False
    except requests.exceptions.RequestException as e:
        print(f"\n[FAIL] 请求失败: {e}")
        return False


def main():
    print("DEBUG: Script started (in main)")
    parser = argparse.ArgumentParser(description="测试 Telegram Webhook 端点")
    parser.add_argument("--host", default="localhost", help="后端服务主机 (默认: localhost)")
    parser.add_argument("--port", type=int, default=8000, help="后端服务端口 (默认: 8000)")
    parser.add_argument("--dry-run", action="store_true", help="仅打印请求，不实际发送")
    parser.add_argument("--run", action="store_true", help="实际运行测试")
    
    args = parser.parse_args()
    
    if args.dry_run or not args.run:
        test_telegram_webhook(args.host, args.port, dry_run=True)
        print()
        test_get_discovered_chat_ids(args.host, args.port, dry_run=True)
        print()
        print("=" * 60)
        print("提示: 使用 --run 参数实际运行测试")
        print("示例: python test_telegram_webhook.py --host localhost --port 8000 --run")
    else:
        success1 = test_telegram_webhook(args.host, args.port, dry_run=False)
        print()
        success2 = test_get_discovered_chat_ids(args.host, args.port, dry_run=False)
        print()
        
        if success1 and success2:
            print("=" * 60)
            print("[OK] 所有测试通过!")
            sys.exit(0)
        else:
            print("=" * 60)
            print("[FAIL] 部分测试失败!\n")
            sys.exit(1)


if __name__ == "__main__":
    main()
