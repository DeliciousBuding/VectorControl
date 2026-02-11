#!/usr/bin/env python3
"""
dev_seed_demo.py - 本地开发环境演示数据种子脚本

用途：为本地 dev 数据库写入最小演示数据，便于前端验收和回归测试。
安全：仅允许在本地 dev DB 执行，不含任何真实凭据，需二次确认。

用法：
    python scripts/dev_seed_demo.py --db ./backend/data/app.db --confirm
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 演示数据（不含真实凭据）
DEMO_USER_ID = "demo_seed_user_001"
DEMO_USERNAME = "demo_user"

DEMO_FUNDS = [
    {"fund_id": "000001", "name": "华夏成长混合", "market_group": "cn_hk", "bucket": "国内权益"},
    {"fund_id": "050003", "name": "博时精选股票", "market_group": "cn_hk", "bucket": "国内权益"},
    {"fund_id": "510300", "name": "沪深300ETF", "market_group": "cn_hk", "bucket": "指数基金"},
]

DEMO_HOLDINGS = [
    {"fund_id": "000001", "name": "华夏成长混合", "shares": 1000.00, "cost_basis_cny": 15000.00, "market_value_cny": 16000.00, "bucket": "国内权益", "market_group": "cn_hk"},
    {"fund_id": "050003", "name": "博时精选股票", "shares": 500.00, "cost_basis_cny": 10000.00, "market_value_cny": 9500.00, "bucket": "国内权益", "market_group": "cn_hk"},
    {"fund_id": "510300", "name": "沪深300ETF", "shares": 2000.00, "cost_basis_cny": 8000.00, "market_value_cny": 8500.00, "bucket": "指数基金", "market_group": "cn_hk"},
]

DEMO_TRANSACTIONS = [
    {"fund_id": "000001", "fund_name": "华夏成长混合", "action": "buy", "amount_cny": 15000.00, "status": "confirmed"},
    {"fund_id": "050003", "fund_name": "博时精选股票", "action": "buy", "amount_cny": 10000.00, "status": "confirmed"},
    {"fund_id": "510300", "fund_name": "沪深300ETF", "action": "buy", "amount_cny": 8000.00, "status": "pending"},
]

DEMO_SIP_PLANS = [
    {"fund_id": "000001", "fund_name": "华夏成长混合", "amount": 1000.00, "frequency": "monthly", "day": 1, "enabled": 1},
]


def confirm_action(db_path: str) -> bool:
    """二次确认"""
    print("=" * 60)
    print("⚠️  警告：即将向数据库写入演示数据")
    print("=" * 60)
    print(f"目标数据库: {db_path}")
    print(f"演示用户ID: {DEMO_USER_ID}")
    print(f"演示基金数: {len(DEMO_FUNDS)}")
    print(f"演示持仓数: {len(DEMO_HOLDINGS)}")
    print(f"演示交易数: {len(DEMO_TRANSACTIONS)}")
    print(f"演示定投数: {len(DEMO_SIP_PLANS)}")
    print("=" * 60)
    print("\n此操作将：")
    print("  1. 插入或覆盖演示用户数据")
    print("  2. 插入演示基金、持仓、交易数据")
    print("  3. 不包含任何真实凭据")
    print("\n请确保：")
    print("  - 仅在本地 dev 数据库执行")
    print("  - 数据库已备份（如有重要数据）")
    print("=" * 60)
    
    response = input("\n确认继续？输入 'YES' 继续: ")
    return response.strip() == "YES"


def seed_demo_data(db_path: str) -> bool:
    """写入演示数据"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        now = datetime.now().isoformat()
        
        # 用户 (使用已存在的用户或创建新的)
        cursor.execute("SELECT id FROM user_accounts WHERE id = ?", (DEMO_USER_ID,))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO user_accounts (id, username, password_hash, created_at)
                VALUES (?, ?, ?, ?)
            """, (DEMO_USER_ID, DEMO_USERNAME, "demo_placeholder_hash", now))
        
        # 基金目录
        for fund in DEMO_FUNDS:
            cursor.execute("""
                INSERT OR REPLACE INTO fund_catalog (fund_id, name, updated_at)
                VALUES (?, ?, ?)
            """, (fund["fund_id"], fund["name"], now))
        
        # 基金主数据
        for fund in DEMO_FUNDS:
            cursor.execute("""
                INSERT OR REPLACE INTO fund_master (fund_id, name, market_group, bucket, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (fund["fund_id"], fund["name"], fund["market_group"], fund.get("bucket", ""), now))
        
        # 持仓 - 先删除旧数据
        cursor.execute("DELETE FROM holdings WHERE user_id = ?", (DEMO_USER_ID,))
        for holding in DEMO_HOLDINGS:
            cursor.execute("""
                INSERT INTO holdings (user_id, fund_id, name, bucket, market_value_cny, cost_basis_cny, shares, cost, start_date, tags_json, market_group, archived, archived_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (DEMO_USER_ID, holding["fund_id"], holding["name"], holding["bucket"],
                  holding["market_value_cny"], holding["cost_basis_cny"], holding["shares"],
                  holding["cost_basis_cny"], now, "[]", holding["market_group"], 0, ""))
        
        # 交易
        base_date = datetime.now() - timedelta(days=30)
        for i, txn in enumerate(DEMO_TRANSACTIONS):
            txn_date = base_date + timedelta(days=i * 7)
            idempotency_key = f"seed_{DEMO_USER_ID}_{txn['fund_id']}_{i}"
            cursor.execute("""
                INSERT INTO fund_transactions (user_id, idempotency_key, fund_id, fund_name, action, occurred_at, amount_cny, status, shares, nav, fee_cny, note, tags_json, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (DEMO_USER_ID, idempotency_key, txn["fund_id"], txn["fund_name"], txn["action"],
                  txn_date.isoformat(), txn["amount_cny"], txn["status"], 0, 0, 0, "", "[]", "seed", now, now))
        
        # 定投计划
        cursor.execute("DELETE FROM sip_plans WHERE user_id = ?", (DEMO_USER_ID,))
        for sip in DEMO_SIP_PLANS:
            next_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
            cursor.execute("""
                INSERT INTO sip_plans (user_id, fund_id, fund_name, amount, frequency, day, enabled, next_date, last_executed, created_at, updated_at, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (DEMO_USER_ID, sip["fund_id"], sip["fund_name"], sip["amount"],
                  sip["frequency"], sip["day"], sip["enabled"], next_date, "", now, now, "演示定投计划"))
        
        # 估值快照 - 创建多个历史快照用于收益曲线
        for days_ago in range(30, 0, -1):
            snapshot_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
            asof = f"{snapshot_date}T15:00:00"
            # 模拟收益增长
            total_return = (30 - days_ago) * 0.1  # 从 0% 增长到 3%
            payload = {
                "total_market_value_cny": 33000 + (30 - days_ago) * 100,
                "total_cost_basis_cny": 33000,
                "day_profit_cny": 50 if days_ago < 30 else 0,
                "total_return": total_return,
            }
            cursor.execute("""
                INSERT INTO estimate_snapshot (user_id, asof, payload_json)
                VALUES (?, ?, ?)
            """, (DEMO_USER_ID, asof, json.dumps(payload)))
        
        conn.commit()
        print("\n✅ 演示数据写入成功")
        print(f"   用户ID: {DEMO_USER_ID}")
        print(f"   用户名: {DEMO_USERNAME}")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 写入失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="本地开发环境演示数据种子")
    parser.add_argument("--db", required=True, help="数据库文件路径（如 ./dev.db）")
    parser.add_argument("--confirm", action="store_true", help="跳过二次确认（危险）")
    parser.add_argument("--dry-run", action="store_true", help="仅显示将执行的操作，不实际写入")
    args = parser.parse_args()
    
    db_path = Path(args.db).resolve()
    
    if not db_path.exists():
        print(f"❌ 数据库文件不存在: {db_path}")
        return 1
    
    if args.dry_run:
        print("🔍 DRY RUN - 以下是将执行的写入操作：")
        print(f"  用户ID: {DEMO_USER_ID}")
        print(f"  基金: {len(DEMO_FUNDS)} 条")
        print(f"  持仓: {len(DEMO_HOLDINGS)} 条")
        print(f"  交易: {len(DEMO_TRANSACTIONS)} 条")
        print(f"  定投: {len(DEMO_SIP_PLANS)} 条")
        print(f"  估值快照: 30 条")
        return 0
    
    if not args.confirm:
        if not confirm_action(str(db_path)):
            print("❌ 已取消")
            return 1
    
    success = seed_demo_data(str(db_path))
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
