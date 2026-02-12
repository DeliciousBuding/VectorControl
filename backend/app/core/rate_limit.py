from __future__ import annotations

import functools
import math
import time
from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Callable


@dataclass(frozen=True)
class LimitRule:
    max_attempts: int
    window_seconds: int
    block_seconds: int


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._blocked_until: dict[str, float] = {}
        self._lock = Lock()

    def _prune(self, key: str, window_seconds: int, now: float) -> None:
        queue = self._events.get(key)
        if not queue:
            return
        threshold = now - float(window_seconds)
        while queue and queue[0] < threshold:
            queue.popleft()
        if not queue:
            self._events.pop(key, None)

    def check(self, key: str) -> tuple[bool, int]:
        now = time.time()
        with self._lock:
            blocked_until = self._blocked_until.get(key, 0.0)
            if blocked_until > now:
                retry_after = int(math.ceil(blocked_until - now))
                return False, max(1, retry_after)
            if blocked_until:
                self._blocked_until.pop(key, None)
            return True, 0

    def record_failure(self, key: str, rule: LimitRule) -> tuple[bool, int]:
        now = time.time()
        with self._lock:
            blocked_until = self._blocked_until.get(key, 0.0)
            if blocked_until > now:
                retry_after = int(math.ceil(blocked_until - now))
                return False, max(1, retry_after)
            if blocked_until:
                self._blocked_until.pop(key, None)

            queue = self._events.setdefault(key, deque())
            self._prune(key, rule.window_seconds, now)
            queue = self._events.setdefault(key, deque())
            queue.append(now)

            if len(queue) >= int(rule.max_attempts):
                until = now + float(rule.block_seconds)
                self._blocked_until[key] = until
                retry_after = int(math.ceil(until - now))
                return False, max(1, retry_after)

            return True, 0

    def record_success(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)
            self._blocked_until.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._events.clear()
            self._blocked_until.clear()


auth_rate_limiter = InMemoryRateLimiter()


def reset_auth_rate_limiter() -> None:
    auth_rate_limiter.reset()


# 简单的速率限制装饰器
def simple_rate_limit(max_calls: int, period: float):
    """简单速率限制装饰器：在 period 秒内最多允许 max_calls 次调用
    
    Args:
        max_calls: 最大调用次数
        period: 时间窗口（秒）
    """
    def decorator(func: Callable) -> Callable:
        _calls: deque[float] = deque()
        _lock = Lock()
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            now = time.time()
            with _lock:
                # 清理过期的时间戳
                while _calls and _calls[0] <= now - period:
                    _calls.popleft()
                
                # 检查是否超过限制
                if len(_calls) >= max_calls:
                    oldest = _calls[0]
                    wait_time = oldest + period - now
                    raise RuntimeError(
                        f"Rate limit exceeded: {max_calls} calls per {period}s. "
                        f"Retry after {max(0, wait_time):.1f}s"
                    )
                
                _calls.append(now)
            
            return func(*args, **kwargs)
        
        @functools.wraps(func)
        def reset_wrapper():
            """重置计数器"""
            with _lock:
                _calls.clear()
        
        wrapper.reset = reset_wrapper
        return wrapper
    return decorator


# 飞书 API 专用速率限制器实例
_feishu_rate_limiter = simple_rate_limit(max_calls=10, period=60)


def reset_feishu_rate_limiter() -> None:
    """重置飞书速率限制器"""
    if hasattr(_feishu_rate_limiter, 'reset'):
        _feishu_rate_limiter.reset()

