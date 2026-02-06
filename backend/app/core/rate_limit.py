from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass
from threading import Lock


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

