#!/usr/bin/env python3
"""
dev_seed_demo.py - 本地开发环境演示数据种子脚本

用途：为本地 dev 数据库写入最小演示数据，便于前端验收和回归测试。
安全：仅允许在本地 dev DB 执行，不含任何真实凭据，需二次确认。

用法：
    python scripts/dev_seed_demo.py --db ./dev.db --confirm
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 演示数据（不含真实凭据）
DEMO_USER = {
    "id": 1,
    "username": "demo_user",
    "email": "demo@example.com",
}

DEMO_FUNDS = [
    {"fund_id": "000001", "name": "华夏成长混合", "market_group": "cn_fund"},
    {"fund_id": "050003", "name": "博时精选股票", "market_group": "cn_fund"},
    {"fund_id": "510300", "name": "沪深300ETF", "market_group": "cn_fund"},
]

DEMO_HOLDINGS = [
    {"user_id": 1, "fund_id": "000001", "shares": "1000.00", "cost_basis": "1.500", "notes": "定投标的"},
    {"user_id": 1, "fund_id": "050003", "shares": "500.00", "cost_basis": "2.000", "notes": "主动管理"},
    {"user_id": 1, "fund_id": "510300", "shares": "2000.00", "cost_basis": "4.000", "notes": "宽基指数"},
]

DEMO_TRANSACTIONS = [
    {"user_id": 1, "fund_id": "000001", "type": "buy", "shares": "1000.00", "price": "1.500", "status": "confirmed"},
    {"user_id": 1, "fund_id": "050003", "type": "buy", "shares": "500.00", "price": "2.000", "status": "confirmed"},
    {"user_id": 1, "fund_id": "510300", "type": "buy", "shares": "2000.00", "price": "4.000", "status": "confirmed"},
]

DEMO_SIP_PLANS = [
    {"user_id": 1, "fund_id": "000001", "amount": "1000.00", "frequency": "monthly", "day": 1, "enabled": True},
]


def confirm_action(db_path: str) -> bool:
    """二次确认"""
    print("=" * 60)
    print("⚠️  警告：即将向数据库写入演示数据")
    print("=" * 60)
    print(f"目标数据库: {db_path}")
    print(f"演示用户: {DEMO_USER['username']}")
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
        # 用户
        cursor.execute("""
            INSERT OR REPLACE INTO users (id, username, email)
            VALUES (?, ?, ?)
        """, (DEMO_USER["id"], DEMO_USER["username"], DEMO_USER["email"]))
        
        # 基金
        for fund in DEMO_FUNDS:
            cursor.execute("""
                INSERT OR REPLACE INTO fund_catalog (fund_id, name, market_group)
                VALUES (?, ?, ?)
            """, (fund["fund_id"], fund["name"], fund["market_group"]))
        
        # 持仓
        for holding in DEMO_HOLDINGS:
            cursor.execute("""
                INSERT OR REPLACE INTO holdings (user_id, fund_id, shares, cost_basis, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (holding["user_id"], holding["fund_id"], holding["shares"], 
                  holding["cost_basis"], holding["notes"]))
        
        # 交易
        base_date = datetime.now() - timedelta(days=30)
        for i, txn in enumerate(DEMO_TRANSACTIONS):
            txn_date = base_date + timedelta(days=i * 7)
            cursor.execute("""
                INSERT INTO fund_transactions (user_id, fund_id, type, shares, price, status, executed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (txn["user_id"], txn["fund_id"], txn["type"], txn["shares"],
                  txn["price"], txn["status"], txn_date.isoformat()))
        
        # 定投计划
        for sip in DEMO_SIP_PLANS:
            cursor.execute("""
                INSERT OR REPLACE INTO sip_plans (user_id, fund_id, amount, frequency, day, enabled)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (sip["user_id"], sip["fund_id"], sip["amount"], 
                  sip["frequency"], sip["day"], sip["enabled"]))
        
        conn.commit()
        print("\n✅ 演示数据写入成功")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 写入失败: {e}")
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
        print(f"  用户: {DEMO_USER}")
        print(f"  基金: {len(DEMO_FUNDS)} 条")
        print(f"  持仓: {len(DEMO_HOLDINGS)} 条")
        print(f"  交易: {len(DEMO_TRANSACTIONS)} 条")
        print(f"  定投: {len(DEMO_SIP_PLANS)} 条")
        return 0
    
    if not args.confirm:
        if not confirm_action(str(db_path)):
            print("❌ 操作已取消")
            return 1
    
    if seed_demo_data(str(db_path)):
        return 0
    else:
        return 1


if __name__ == "__main__":
    sys.exit(main())
