#!/usr/bin/env python3
import requests
import json

url = 'http://localhost:8000/api/settings/notifications/telegram/credential'
headers = {
    'Authorization': 'Bearer EpCG8iCWFCULeczp8H2k191xqCI7tKw-',
    'Content-Type': 'application/json'
}
data = {
    'bot_token': '8558855974:AAEcg6arSPOhkRuSHDE7CRxa-1-4Q-k4CYk',
    'chat_id': ''
}

try:
    response = requests.put(url, headers=headers, json=data)
    print('Status Code:', response.status_code)
    print('Response:', response.text)

    if response.status_code in [200, 201, 422]:
        print("\n=== Telegram Credential Update Result ===")
        result = response.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
except Exception as e:
    print('Error:', str(e))
