import sqlite3
import json
from datetime import datetime

USER_ID = "testuser_id_placeholder"

DB_PATH = "VectorControl/backend/data/app.db"

def get_user_id():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM user_accounts WHERE username = ?", ("testuser",))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row[0]
    return None

def seed_holdings(user_id):
    if not user_id:
        print("User testuser not found")
        return

    print(f"Seeding holdings for user: {user_id}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    holdings = [
        {
            "fund_id": "000001",
            "name": "华夏成长混合",
            "bucket": "core",
            "market_value_cny": 15000.0,
            "cost_basis_cny": 12000.0,
            "shares": 5000.0,
            "cost": 2.4,
            "start_date": "2023-01-15",
            "tags_json": '["A股", "混合"]',
            "market_group": "cn_hk"
        },
        {
            "fund_id": "110022",
            "name": "易方达消费行业股票",
            "bucket": "satellite",
            "market_value_cny": 8500.0,
            "cost_basis_cny": 9000.0,
            "shares": 3000.0,
            "cost": 3.0,
            "start_date": "2023-03-10",
            "tags_json": '["消费", "行业"]',
            "market_group": "cn_hk"
        },
        {
            "fund_id": "513050",
            "name": "华夏上证50ETF联接A",
            "bucket": "core",
            "market_value_cny": 22000.0,
            "cost_basis_cny": 20000.0,
            "shares": 10000.0,
            "cost": 2.0,
            "start_date": "2022-11-01",
            "tags_json": '["指数", "上证50"]',
            "market_group": "cn_hk"
        }
    ]

    for h in holdings:
        print(f"Inserting {h['name']}...")
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO holdings (
                    user_id, fund_id, name, bucket, market_value_cny, cost_basis_cny,
                    shares, cost, start_date, tags_json, market_group, archived, archived_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')
            """, (
                user_id, h['fund_id'], h['name'], h['bucket'], h['market_value_cny'],
                h['cost_basis_cny'], h['shares'], h['cost'], h['start_date'],
                h['tags_json'], h['market_group']
            ))
        except Exception as e:
            print(f"Error inserting {h['name']}: {e}")

    conn.commit()
    conn.close()
    print("Done seeding.")

if __name__ == "__main__":
    user_id = get_user_id()
    seed_holdings(user_id)
