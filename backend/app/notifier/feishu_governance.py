"""
飞书通知治理模块 v2

功能：
- 频控：基于令牌桶的速率限制
- 缓存过期：消息去重与缓存
- 日志审计：结构化审计日志
- 失败隔离：熔断器模式
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Any, Optional
from collections import OrderedDict

LOGGER = logging.getLogger("vectorcontrol.notifier.feishu_governance")


@dataclass
class CircuitState:
    """熔断器状态"""
    is_open: bool = False
    failure_count: int = 0
    last_failure_time: float = 0.0
    last_success_time: float = 0.0
    opened_at: float = 0.0


@dataclass
class CacheEntry:
    """缓存条目"""
    content_hash: str
    created_at: float
    expires_at: float
    sent_count: int = 0


class FeishuGovernance:
    """飞书通知治理器"""
    
    DEFAULT_RATE_LIMIT_PER_MINUTE = 20
    DEFAULT_CACHE_TTL_SECONDS = 300
    DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 5
    DEFAULT_CIRCUIT_RECOVERY_SECONDS = 60
    DEFAULT_MAX_CACHE_SIZE = 1000
    
    def __init__(
        self,
        rate_limit_per_minute: int = DEFAULT_RATE_LIMIT_PER_MINUTE,
        cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
        circuit_failure_threshold: int = DEFAULT_CIRCUIT_FAILURE_THRESHOLD,
        circuit_recovery_seconds: int = DEFAULT_CIRCUIT_RECOVERY_SECONDS,
        max_cache_size: int = DEFAULT_MAX_CACHE_SIZE,
    ):
        self._rate_limit_per_minute = rate_limit_per_minute
        self._cache_ttl_seconds = cache_ttl_seconds
        self._circuit_failure_threshold = circuit_failure_threshold
        self._circuit_recovery_seconds = circuit_recovery_seconds
        self._max_cache_size = max_cache_size
        
        self._lock = Lock()
        self._call_timestamps: list[float] = []
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._circuit_state = CircuitState()
        self._audit_log: list[dict[str, Any]] = []
        self._stats = {
            "total_requests": 0,
            "rate_limited": 0,
            "cache_hits": 0,
            "circuit_rejected": 0,
            "successes": 0,
            "failures": 0,
        }
    
    def _compute_content_hash(self, content: str) -> str:
        """计算内容哈希用于去重"""
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    
    def _prune_rate_limit_timestamps(self, now: float) -> None:
        """清理过期的速率限制时间戳"""
        threshold = now - 60.0
        self._call_timestamps = [ts for ts in self._call_timestamps if ts > threshold]
    
    def _prune_cache(self, now: float) -> None:
        """清理过期缓存条目"""
        expired_keys = [
            k for k, v in self._cache.items()
            if v.expires_at < now
        ]
        for k in expired_keys:
            del self._cache[k]
        
        while len(self._cache) > self._max_cache_size:
            self._cache.popitem(last=False)
    
    def check_rate_limit(self) -> tuple[bool, int]:
        """检查速率限制

        Returns:
            (allowed, retry_after): 是否允许，需要等待的秒数
        """
        now = time.time()
        with self._lock:
            self._prune_rate_limit_timestamps(now)
            
            if len(self._call_timestamps) >= self._rate_limit_per_minute:
                oldest = self._call_timestamps[0]
                retry_after = int(oldest + 60 - now) + 1
                self._stats["rate_limited"] += 1
                return False, max(1, retry_after)
            
            self._call_timestamps.append(now)
            return True, 0
    
    def check_cache(self, content: str) -> Optional[CacheEntry]:
        """检查缓存是否存在

        Returns:
            CacheEntry 如果存在且未过期，否则 None
        """
        now = time.time()
        content_hash = self._compute_content_hash(content)
        
        with self._lock:
            self._prune_cache(now)
            
            entry = self._cache.get(content_hash)
            if entry and entry.expires_at > now:
                entry.sent_count += 1
                self._stats["cache_hits"] += 1
                return entry
            
            return None
    
    def add_to_cache(self, content: str) -> None:
        """添加到缓存"""
        now = time.time()
        content_hash = self._compute_content_hash(content)
        
        with self._lock:
            self._cache[content_hash] = CacheEntry(
                content_hash=content_hash,
                created_at=now,
                expires_at=now + self._cache_ttl_seconds,
                sent_count=1,
            )
            self._cache.move_to_end(content_hash)
            self._prune_cache(now)
    
    def check_circuit(self) -> tuple[bool, Optional[str]]:
        """检查熔断器状态

        Returns:
            (allowed, reason): 是否允许，拒绝原因
        """
        now = time.time()
        with self._lock:
            if not self._circuit_state.is_open:
                return True, None
            
            if now - self._circuit_state.opened_at >= self._circuit_recovery_seconds:
                self._circuit_state.is_open = False
                self._circuit_state.failure_count = 0
                LOGGER.info(
                    "feishu_governance circuit recovered after %ds",
                    self._circuit_recovery_seconds,
                )
                return True, None
            
            self._stats["circuit_rejected"] += 1
            retry_after = int(self._circuit_recovery_seconds - (now - self._circuit_state.opened_at))
            return False, f"circuit_open retry_after={max(1, retry_after)}s"
    
    def record_success(self, content: str, trace_id: str) -> None:
        """记录成功"""
        now = time.time()
        with self._lock:
            self._circuit_state.last_success_time = now
            self._circuit_state.failure_count = 0
            self._circuit_state.is_open = False
            self._stats["successes"] += 1
            
            self._audit_log.append({
                "time": now,
                "event": "success",
                "trace_id": trace_id,
                "content_hash": self._compute_content_hash(content),
            })
            
            if len(self._audit_log) > 100:
                self._audit_log = self._audit_log[-100:]
    
    def record_failure(self, content: str, trace_id: str, error_category: str, error_message: str) -> None:
        """记录失败"""
        now = time.time()
        with self._lock:
            self._circuit_state.failure_count += 1
            self._circuit_state.last_failure_time = now
            self._stats["failures"] += 1
            
            self._audit_log.append({
                "time": now,
                "event": "failure",
                "trace_id": trace_id,
                "content_hash": self._compute_content_hash(content),
                "error_category": error_category,
                "error_message": error_message[:200],
            })
            
            if len(self._audit_log) > 100:
                self._audit_log = self._audit_log[-100:]
            
            if self._circuit_state.failure_count >= self._circuit_failure_threshold:
                if not self._circuit_state.is_open:
                    self._circuit_state.is_open = True
                    self._circuit_state.opened_at = now
                    LOGGER.warning(
                        "feishu_governance circuit opened after %d failures",
                        self._circuit_state.failure_count,
                    )
    
    def get_stats(self) -> dict[str, Any]:
        """获取统计信息"""
        now = time.time()
        with self._lock:
            return {
                "rate_limit": {
                    "calls_per_minute": self._rate_limit_per_minute,
                    "current_calls": len(self._call_timestamps),
                },
                "cache": {
                    "size": len(self._cache),
                    "max_size": self._max_cache_size,
                    "ttl_seconds": self._cache_ttl_seconds,
                },
                "circuit": {
                    "is_open": self._circuit_state.is_open,
                    "failure_count": self._circuit_state.failure_count,
                    "threshold": self._circuit_failure_threshold,
                    "recovery_seconds": self._circuit_recovery_seconds,
                    "opened_at": self._circuit_state.opened_at if self._circuit_state.is_open else None,
                },
                "stats": dict(self._stats),
                "recent_audit_log": self._audit_log[-10:],
            }
    
    def reset(self) -> None:
        """重置所有状态"""
        with self._lock:
            self._call_timestamps.clear()
            self._cache.clear()
            self._circuit_state = CircuitState()
            self._audit_log.clear()
            self._stats = {
                "total_requests": 0,
                "rate_limited": 0,
                "cache_hits": 0,
                "circuit_rejected": 0,
                "successes": 0,
                "failures": 0,
            }


_feishu_governance = FeishuGovernance()


def get_feishu_governance() -> FeishuGovernance:
    """获取全局飞书治理器实例"""
    return _feishu_governance


def reset_feishu_governance() -> None:
    """重置飞书治理器"""
    _feishu_governance.reset()
