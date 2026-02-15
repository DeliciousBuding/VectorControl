"""
市场交易时间工具 - 判断当前是否为交易时间，优化缓存策略
"""
from datetime import datetime, time, timedelta
from typing import Tuple, Optional
import json

# 中国节假日（2025年）
CN_HOLIDAYS_2025 = {
    "2025-01-01",  # 元旦
    "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02", "2025-02-03", "2025-02-04",  # 春节
    "2025-04-04", "2025-04-05", "2025-04-06",  # 清明节
    "2025-05-01", "2025-05-02", "2025-05-03", "2025-05-04", "2025-05-05",  # 劳动节
    "2025-05-31", "2025-06-01", "2025-06-02",  # 端午节
    "2025-10-01", "2025-10-02", "2025-10-03", "2025-10-04", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08",  # 国庆节
    "2025-10-06", "2025-10-07", "2025-10-08",  # 中秋节（与国庆重叠）
}

# 中国节假日（2026年）
CN_HOLIDAYS_2026 = {
    "2026-01-01",  # 元旦
    "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21",  # 春节
    "2026-04-04", "2026-04-05", "2026-04-06",  # 清明节
    "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",  # 劳动节
    "2026-06-19", "2026-06-20", "2026-06-21",  # 端午节
    "2026-09-25", "2026-09-26", "2026-09-27",  # 中秋节
    "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08",  # 国庆节
}

# 美国节假日（2025年）
US_HOLIDAYS_2025 = {
    "2025-01-01",  # New Year's Day
    "2025-01-20",  # Martin Luther King Jr. Day
    "2025-02-17",  # Presidents' Day
    "2025-04-18",  # Good Friday
    "2025-05-26",  # Memorial Day
    "2025-07-04",  # Independence Day
    "2025-09-01",  # Labor Day
    "2025-11-27",  # Thanksgiving
    "2025-12-25",  # Christmas Day
}

# 美国节假日（2026年）
US_HOLIDAYS_2026 = {
    "2026-01-01",  # New Year's Day
    "2026-01-19",  # Martin Luther King Jr. Day
    "2026-02-16",  # Presidents' Day
    "2026-04-03",  # Good Friday
    "2026-05-25",  # Memorial Day
    "2026-07-03",  # Independence Day (observed)
    "2026-09-07",  # Labor Day
    "2026-11-26",  # Thanksgiving
    "2026-12-25",  # Christmas Day
}

# 合并所有节假日
CN_HOLIDAYS = {**CN_HOLIDAYS_2025, **CN_HOLIDAYS_2026}
US_HOLIDAYS = {**US_HOLIDAYS_2025, **US_HOLIDAYS_2026}


def get_beijing_time(dt: Optional[datetime] = None) -> datetime:
    """获取北京时间"""
    if dt is None:
        dt = datetime.now()
    # 转换为北京时间 (UTC+8)
    beijing_tz = timedelta(hours=8)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone(beijing_tz))


def get_eastern_time(dt: Optional[datetime] = None) -> datetime:
    """获取美东时间"""
    if dt is None:
        dt = datetime.now()
    # 美东时间 (UTC-5 或 UTC-4 夏令时)
    # 简化处理，使用 UTC-5
    eastern_tz = timedelta(hours=-5)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone(eastern_tz))


def is_cn_market_open(dt: Optional[datetime] = None) -> bool:
    """
    判断A股/港股当前是否开盘
    交易时间：周一至周五 9:30-11:30, 13:00-15:00 (北京时间)
    """
    beijing = get_beijing_time(dt)
    date_str = beijing.strftime("%Y-%m-%d")
    
    # 周末休市
    if beijing.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    
    # 节假日休市
    if date_str in CN_HOLIDAYS:
        return False
    
    # 交易时段判断
    current_time = beijing.time()
    morning_session = time(9, 30) <= current_time <= time(11, 30)
    afternoon_session = time(13, 0) <= current_time <= time(15, 0)
    
    return morning_session or afternoon_session


def is_us_market_open(dt: Optional[datetime] = None) -> bool:
    """
    判断美股当前是否开盘
    交易时间：周一至周五 9:30-16:00 (美东时间)
    对应北京时间：22:30-次日5:00 (夏令时) 或 23:30-次日6:00 (冬令时)
    """
    eastern = get_eastern_time(dt)
    date_str = eastern.strftime("%Y-%m-%d")
    
    # 周末休市
    if eastern.weekday() >= 5:
        return False
    
    # 节假日休市
    if date_str in US_HOLIDAYS:
        return False
    
    # 交易时段判断
    current_time = eastern.time()
    return time(9, 30) <= current_time <= time(16, 0)


def get_market_status(dt: Optional[datetime] = None) -> dict:
    """
    获取市场状态信息，用于前端展示
    """
    beijing = get_beijing_time(dt)
    eastern = get_eastern_time(dt)
    
    cn_open = is_cn_market_open(dt)
    us_open = is_us_market_open(dt)
    
    # 判断当前时段描述
    beijing_time_str = beijing.strftime("%H:%M")
    hour = beijing.hour
    
    if 0 <= hour < 6:
        time_desc = "凌晨"
    elif 6 <= hour < 9:
        time_desc = "早间"
    elif 9 <= hour < 12:
        time_desc = "上午"
    elif 12 <= hour < 14:
        time_desc = "午间"
    elif 14 <= hour < 18:
        time_desc = "下午"
    else:
        time_desc = "晚间"
    
    # 节假日检测
    date_str = beijing.strftime("%Y-%m-%d")
    is_cn_holiday = date_str in CN_HOLIDAYS
    is_us_holiday = date_str in US_HOLIDAYS
    
    # 特殊节日检测
    holiday_name = None
    # 中国春节
    if date_str in ["2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02", "2025-02-03", "2025-02-04"]:
        holiday_name = "🧧 春节假期"
    elif date_str in ["2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21"]:
        holiday_name = "🧧 春节假期"
    # 圣诞节
    elif date_str in ["2025-12-25", "2026-12-25"]:
        holiday_name = "🎄 圣诞节"
    # 元旦
    elif date_str in ["2025-01-01", "2026-01-01"]:
        holiday_name = "🎉 元旦"
    # 劳动节
    elif date_str in ["2025-05-01", "2025-05-02", "2025-05-03", "2025-05-04", "2025-05-05"]:
        holiday_name = "🛠️ 劳动节"
    elif date_str in ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05"]:
        holiday_name = "🛠️ 劳动节"
    # 国庆节
    elif date_str in ["2025-10-01", "2025-10-02", "2025-10-03", "2025-10-04", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08"]:
        holiday_name = "🇨🇳 国庆节"
    elif date_str in ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]:
        holiday_name = "🇨🇳 国庆节"
    # 周末
    elif beijing.weekday() >= 5:
        holiday_name = "📅 周末"
    
    return {
        "beijing_time": beijing.strftime("%Y-%m-%d %H:%M:%S"),
        "eastern_time": eastern.strftime("%Y-%m-%d %H:%M:%S"),
        "time_desc": time_desc,
        "cn_market_open": cn_open,
        "us_market_open": us_open,
        "is_cn_holiday": is_cn_holiday,
        "is_us_holiday": is_us_holiday,
        "holiday_name": holiday_name,
        "weekday": beijing.weekday(),
    }


def get_optimal_cache_ttl(has_overseas_holdings: bool = False) -> int:
    """
    根据当前市场状态获取最优缓存时间（秒）
    
    策略：
    - 非交易时间：缓存3600秒（1小时）
    - 仅A股交易时间：缓存60秒
    - 有美股且美股交易时间：缓存30秒
    """
    cn_open = is_cn_market_open()
    us_open = is_us_market_open()
    
    # 非交易时间 - 长缓存
    if not cn_open and not us_open:
        return 3600  # 1小时
    
    # 美股交易时间且有美股持仓 - 短缓存
    if has_overseas_holdings and us_open:
        return 30
    
    # A股交易时间 - 中等缓存
    if cn_open:
        return 60
    
    # 默认
    return 300


# 导入timezone
from datetime import timezone
