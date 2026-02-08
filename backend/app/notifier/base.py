from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol


@dataclass(slots=True)
class NotificationPayload:
    title: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class NotificationResult:
    channel: str
    success: bool
    skipped: bool = False
    code: str = ""
    message: str = ""
    provider_message_id: str = ""
    sent_at: str = field(default_factory=lambda: datetime.now().astimezone().isoformat())


class NotificationSender(Protocol):
    channel: str

    def send(self, payload: NotificationPayload, settings: dict[str, Any] | None = None) -> NotificationResult:
        ...
