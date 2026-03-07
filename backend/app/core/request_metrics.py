from __future__ import annotations

from collections import deque
from datetime import datetime
from threading import Lock
from typing import Any

_RECENT_REQUESTS: deque[dict[str, Any]] = deque(maxlen=20)
_RECENT_REQUESTS_LOCK = Lock()


def record_request_metric(
    *,
    method: str,
    path: str,
    status_code: int,
    request_id: str,
    server_elapsed_ms: int,
) -> None:
    entry = {
        "time": datetime.now().astimezone().isoformat(timespec="seconds"),
        "method": str(method or "").upper(),
        "path": str(path or ""),
        "status_code": int(status_code),
        "request_id": str(request_id or ""),
        "server_elapsed_ms": int(server_elapsed_ms),
    }
    with _RECENT_REQUESTS_LOCK:
        _RECENT_REQUESTS.appendleft(entry)


def get_recent_request_metrics(limit: int = 5) -> list[dict[str, Any]]:
    with _RECENT_REQUESTS_LOCK:
        items = list(_RECENT_REQUESTS)
    return items[: max(0, int(limit))]


def clear_recent_request_metrics() -> None:
    with _RECENT_REQUESTS_LOCK:
        _RECENT_REQUESTS.clear()
