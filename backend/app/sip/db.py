"""定投计划数据库操作"""

from __future__ import annotations

import sqlite3
from datetime import date, datetime
from typing import Any

from app.core.settings import DATA_DIR
from app.sip.models import SIPPlan, calculate_next_sip_date

DB_PATH = DATA_DIR / "app.db"


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat()


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_sip_plans_table(conn: sqlite3.Connection) -> None:
    """确保 sip_plans 表存在"""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sip_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            fund_id TEXT NOT NULL,
            fund_name TEXT,
            amount REAL NOT NULL DEFAULT 0,
            frequency TEXT NOT NULL DEFAULT 'monthly',
            day INTEGER NOT NULL DEFAULT 1,
            enabled INTEGER NOT NULL DEFAULT 1,
            next_date TEXT,
            last_executed TEXT,
            created_at TEXT,
            updated_at TEXT,
            note TEXT
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_sip_plans_user_id 
        ON sip_plans(user_id)
    """)
    conn.commit()


def create_sip_plan(
    user_id: str,
    fund_id: str,
    amount: float,
    frequency: str = "monthly",
    day: int = 1,
    fund_name: str = "",
    note: str = "",
) -> SIPPlan:
    """创建定投计划"""
    conn = _connect()
    _ensure_sip_plans_table(conn)
    
    now = _now_iso()
    next_date = calculate_next_sip_date(frequency, day).isoformat()
    
    cursor = conn.execute(
        """
        INSERT INTO sip_plans 
        (user_id, fund_id, fund_name, amount, frequency, day, enabled, next_date, created_at, updated_at, note)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        """,
        (user_id, fund_id, fund_name, amount, frequency, day, next_date, now, now, note),
    )
    
    plan_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return SIPPlan(
        id=plan_id,
        user_id=user_id,
        fund_id=fund_id,
        fund_name=fund_name,
        amount=amount,
        frequency=frequency,
        day=day,
        enabled=True,
        next_date=next_date,
        created_at=now,
        updated_at=now,
        note=note,
    )


def list_sip_plans(user_id: str, enabled_only: bool = False) -> list[SIPPlan]:
    """列出用户的所有定投计划"""
    conn = _connect()
    _ensure_sip_plans_table(conn)
    
    if enabled_only:
        rows = conn.execute(
            """
            SELECT * FROM sip_plans 
            WHERE user_id = ? AND enabled = 1
            ORDER BY next_date ASC
            """,
            (user_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT * FROM sip_plans 
            WHERE user_id = ?
            ORDER BY enabled DESC, next_date ASC
            """,
            (user_id,),
        ).fetchall()
    
    conn.close()
    return [SIPPlan.from_row(dict(row)) for row in rows]


def get_sip_plan(user_id: str, plan_id: int) -> SIPPlan | None:
    """获取单个定投计划"""
    conn = _connect()
    _ensure_sip_plans_table(conn)
    
    row = conn.execute(
        "SELECT * FROM sip_plans WHERE id = ? AND user_id = ?",
        (plan_id, user_id),
    ).fetchone()
    
    conn.close()
    
    if row:
        return SIPPlan.from_row(dict(row))
    return None


def update_sip_plan(
    user_id: str,
    plan_id: int,
    updates: dict[str, Any],
) -> SIPPlan | None:
    """更新定投计划"""
    conn = _connect()
    _ensure_sip_plans_table(conn)
    
    # 检查计划是否存在
    existing = conn.execute(
        "SELECT * FROM sip_plans WHERE id = ? AND user_id = ?",
        (plan_id, user_id),
    ).fetchone()
    
    if not existing:
        conn.close()
        return None
    
    # 构建更新语句
    allowed_fields = {
        "fund_id", "fund_name", "amount", "frequency", 
        "day", "enabled", "note"
    }
    
    update_parts = []
    values = []
    
    for field, value in updates.items():
        if field in allowed_fields and value is not None:
            update_parts.append(f"{field} = ?")
            values.append(value)
    
    if not update_parts:
        conn.close()
        return SIPPlan.from_row(dict(existing))
    
    # 如果 frequency 或 day 变化，重新计算 next_date
    if "frequency" in updates or "day" in updates:
        frequency = updates.get("frequency", existing["frequency"])
        day = updates.get("day", existing["day"])
        next_date = calculate_next_sip_date(frequency, day).isoformat()
        update_parts.append("next_date = ?")
        values.append(next_date)
    
    update_parts.append("updated_at = ?")
    values.append(_now_iso())
    values.extend([plan_id, user_id])
    
    conn.execute(
        f"UPDATE sip_plans SET {', '.join(update_parts)} WHERE id = ? AND user_id = ?",
        values,
    )
    
    conn.commit()
    
    # 获取更新后的记录
    updated_row = conn.execute(
        "SELECT * FROM sip_plans WHERE id = ? AND user_id = ?",
        (plan_id, user_id),
    ).fetchone()
    
    conn.close()
    
    if updated_row:
        return SIPPlan.from_row(dict(updated_row))
    return None


def delete_sip_plan(user_id: str, plan_id: int) -> bool:
    """删除定投计划"""
    conn = _connect()
    _ensure_sip_plans_table(conn)
    
    cursor = conn.execute(
        "DELETE FROM sip_plans WHERE id = ? AND user_id = ?",
        (plan_id, user_id),
    )
    
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    
    return deleted


def get_upcoming_sip_plans(user_id: str, days: int = 7) -> list[SIPPlan]:
    """获取即将执行的定投计划"""
    conn = _connect()
    _ensure_sip_plans_table(conn)
    
    today = date.today()
    end_date = today + __import__("datetime").timedelta(days=days)
    
    rows = conn.execute(
        """
        SELECT * FROM sip_plans
        WHERE user_id = ? AND enabled = 1 
        AND date(next_date) BETWEEN date(?) AND date(?)
        ORDER BY next_date ASC
        """,
        (user_id, today.isoformat(), end_date.isoformat()),
    ).fetchall()
    
    conn.close()
    return [SIPPlan.from_row(dict(row)) for row in rows]


def mark_sip_executed(user_id: str, plan_id: int) -> SIPPlan | None:
    """标记定投计划已执行"""
    conn = _connect()
    _ensure_sip_plans_table(conn)
    
    now = _now_iso()
    
    # 获取当前计划
    row = conn.execute(
        "SELECT * FROM sip_plans WHERE id = ? AND user_id = ?",
        (plan_id, user_id),
    ).fetchone()
    
    if not row:
        conn.close()
        return None
    
    plan = SIPPlan.from_row(dict(row))
    
    # 计算下一次执行日期
    next_date = calculate_next_sip_date(
        plan.frequency, 
        plan.day,
        from_date=date.today() + __import__("datetime").timedelta(days=1),
    ).isoformat()
    
    conn.execute(
        """
        UPDATE sip_plans 
        SET last_executed = ?, next_date = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (now, next_date, now, plan_id, user_id),
    )
    
    conn.commit()
    
    updated_row = conn.execute(
        "SELECT * FROM sip_plans WHERE id = ? AND user_id = ?",
        (plan_id, user_id),
    ).fetchone()
    
    conn.close()
    
    if updated_row:
        return SIPPlan.from_dict(dict(updated_row))
    return None
