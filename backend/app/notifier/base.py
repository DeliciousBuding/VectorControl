from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, Protocol

from pydantic import BaseModel, ConfigDict, Field


@dataclass(slots=True)
class NotificationPayload:
    title: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


class NotificationActionError(BaseModel):
    """通知通道动作执行错误模型（SSOT）"""
    category: str = Field(..., description="错误分类: network_error | auth_error | config_error | rate_limit | unknown")
    message: str = Field(..., description="人类可读的错误描述")
    http_status: Optional[int] = Field(None, description="HTTP 状态码")
    error_code: Optional[Any] = Field(None, description="服务商原始错误码")
    description: Optional[str] = Field(None, description="额外描述信息")


class NotificationResult(BaseModel):
    """通知通道动作统一结果模型（SSOT）"""
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "ok": True,
                    "sent": True,
                    "trace_id": "abc123",
                    "attempts": 1,
                    "max_attempts": 3,
                    "error": None,
                    "channel": "feishu",
                },
                {
                    "ok": False,
                    "sent": False,
                    "trace_id": "def456",
                    "attempts": 3,
                    "max_attempts": 3,
                    "error": {
                        "category": "network_error",
                        "message": "连接超时",
                        "http_status": None,
                        "error_code": None,
                        "description": None,
                    },
                    "channel": "telegram",
                },
            ]
        }
    )

    ok: bool = Field(..., description="是否整体成功（包括配置检查等）")
    sent: bool = Field(..., description="是否成功发送消息到服务商")
    trace_id: str = Field(..., description="用于日志关联的追踪ID")
    attempts: int = Field(1, description="实际尝试次数")
    max_attempts: int = Field(3, description="最大尝试次数")
    error: Optional[NotificationActionError] = Field(None, description="错误详情（仅在 ok=False 时存在）")
    channel: str = Field("", description="通知通道名称")


class NotificationSender(Protocol):
    channel: str

    def send(self, payload: NotificationPayload, settings: dict[str, Any] | None = None) -> NotificationResult:
        ...


# 向后兼容别名
NotifierActionError = NotificationActionError
NotifierActionResult = NotificationResult
