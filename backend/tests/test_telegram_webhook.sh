#!/bin/bash
# Telegram Webhook 测试脚本

# 配置
HOST="localhost"
PORT="8000"
BASE_URL="http://${HOST}:${PORT}/api/settings"

# 测试 Webhook 端点
echo "测试 Telegram Webhook 端点..."
echo "=================================="

curl -X POST "${BASE_URL}/notifications/telegram/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 123,
      "from": {
        "id": 987654321,
        "is_bot": false,
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
  }'

echo ""
echo ""

# 测试获取发现的 Chat ID
echo "获取发现的 Chat ID..."
echo "=================================="
curl -X GET "${BASE_URL}/notifications/telegram/discovered_chat_ids"

echo ""
echo ""
echo "测试完成!"
