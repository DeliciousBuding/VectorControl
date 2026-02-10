"""定投计划数据模型"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any


class SIPPlan:
    """定投计划 (Systematic Investment Plan)"""
    
    def __init__(
        self,
        id: int | None = None,
        user_id: str = "",
        fund_id: str = "",
        fund_name: str = "",
        amount: float = 0.0,
        frequency: str = "monthly",  # weekly, biweekly, monthly
        day: int = 1,  # 每月几号 / 每周几 (1-7)
        enabled: bool = True,
        next_date: str | None = None,
        last_executed: str | None = None,
        created_at: str | None = None,
        updated_at: str | None = None,
        note: str = "",
    ):
        self.id = id
        self.user_id = user_id
        self.fund_id = fund_id
        self.fund_name = fund_name
        self.amount = amount
        self.frequency = frequency
        self.day = day
        self.enabled = enabled
        self.next_date = next_date
        self.last_executed = last_executed
        self.created_at = created_at
        self.updated_at = updated_at
        self.note = note

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "fund_id": self.fund_id,
            "fund_name": self.fund_name,
            "amount": self.amount,
            "frequency": self.frequency,
            "day": self.day,
            "enabled": self.enabled,
            "next_date": self.next_date,
            "last_executed": self.last_executed,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "note": self.note,
        }

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "SIPPlan":
        return cls(
            id=row.get("id"),
            user_id=row.get("user_id", ""),
            fund_id=row.get("fund_id", ""),
            fund_name=row.get("fund_name", ""),
            amount=float(row.get("amount", 0) or 0),
            frequency=row.get("frequency", "monthly"),
            day=int(row.get("day", 1) or 1),
            enabled=bool(row.get("enabled", True)),
            next_date=row.get("next_date"),
            last_executed=row.get("last_executed"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
            note=row.get("note", ""),
        )


def calculate_next_sip_date(frequency: str, day: int, from_date: date | None = None) -> date:
    """
    计算下一次定投日期
    
    Args:
        frequency: weekly, biweekly, monthly
        day: 每月几号 (1-31) 或 每周几 (1-7, 1=周一)
        from_date: 起算日期，默认今天
    
    Returns:
        下一次定投日期
    """
    if from_date is None:
        from_date = date.today()
    
    if frequency == "weekly":
        # day 是周几 (1-7)
        days_ahead = day - from_date.isoweekday()
        if days_ahead <= 0:  # 目标日已过，计算下周
            days_ahead += 7
        return from_date + __import__("datetime").timedelta(days=days_ahead)
    
    elif frequency == "biweekly":
        # 每两周一次
        days_ahead = day - from_date.isoweekday()
        if days_ahead <= 0:
            days_ahead += 14
        else:
            days_ahead += 7
        return from_date + __import__("datetime").timedelta(days=days_ahead)
    
    else:  # monthly
        # day 是每月几号
        next_month = from_date.replace(day=1)
        if from_date.day >= day:
            # 这个月的定投日已过，计算下个月
            if from_date.month == 12:
                next_month = next_month.replace(year=from_date.year + 1, month=1)
            else:
                next_month = next_month.replace(month=from_date.month + 1)
        
        # 尝试设置到指定日期
        try:
            return next_month.replace(day=day)
        except ValueError:
            # 该月没有这一天（如2月30日），使用月末
            if next_month.month == 12:
                next_next = next_month.replace(year=next_month.year + 1, month=1)
            else:
                next_next = next_month.replace(month=next_month.month + 1)
            return next_next - __import__("datetime").timedelta(days=1)
