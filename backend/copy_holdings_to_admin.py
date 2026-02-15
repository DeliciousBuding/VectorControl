"""
将持仓数据从现有用户复制到admin用户
用于测试目的
"""
import sqlite3
import json
from datetime import datetime

db_path = '/app/backend/data/app.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# 获取现有的持仓数据
cursor.execute("SELECT * FROM holdings LIMIT 1")
existing = cursor.fetchone()

if not existing:
    print("No existing holdings found")
    conn.close()
    exit()

source_user_id = existing['user_id']
print(f"Source user_id: {source_user_id}")

# 获取所有持仓
cursor.execute("SELECT * FROM holdings WHERE user_id = ?", (source_user_id,))
holdings = cursor.fetchall()
print(f"Found {len(holdings)} holdings to copy")

# 复制给admin
copied = 0
for h in holdings:
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO holdings 
            (user_id, fund_id, name, bucket, market_value_cny, cost_basis_cny, shares, cost, start_date, tags_json, market_group, archived, archived_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            'admin',  # 目标用户
            h['fund_id'],
            h['name'],
            h['bucket'],
            h['market_value_cny'],
            h['cost_basis_cny'],
            h['shares'],
            h['cost'],
            h['start_date'],
            h['tags_json'],
            h['market_group'],
            h['archived'],
            h['archived_at']
        ))
        copied += 1
    except Exception as e:
        print(f"Error copying {h['fund_id']}: {e}")

conn.commit()

# 验证
cursor.execute("SELECT COUNT(*) FROM holdings WHERE user_id = 'admin'")
admin_count = cursor.fetchone()[0]
print(f"\nAdmin now has {admin_count} holdings")

conn.close()
print(f"\nCopied {copied} holdings to admin user")
