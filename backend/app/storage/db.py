from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.settings import DATA_DIR

DB_PATH = DATA_DIR / "app.db"


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS holdings (
                fund_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                bucket TEXT NOT NULL,
                shares REAL NOT NULL,
                cost REAL NOT NULL,
                start_date TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS actions_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                action_key TEXT NOT NULL,
                amount REAL NOT NULL,
                done INTEGER NOT NULL,
                ts TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS estimate_snapshot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asof TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )
            """
        )
        conn.commit()


def seed_holdings(portfolio: dict[str, Any]) -> int:
    holdings = portfolio.get("holdings", []) if isinstance(portfolio, dict) else []
    if not holdings:
        return 0

    with connect() as conn:
        row = conn.execute("SELECT COUNT(1) AS cnt FROM holdings").fetchone()
        count = int(row["cnt"]) if row else 0
        if count > 0:
            return 0

        inserted = 0
        for item in holdings:
            if not isinstance(item, dict):
                continue
            conn.execute(
                """
                INSERT INTO holdings (fund_id, name, bucket, shares, cost, start_date)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    item.get("fund_id", ""),
                    item.get("name", ""),
                    item.get("bucket", ""),
                    float(item.get("shares", 0)),
                    float(item.get("cost", 0)),
                    str(item.get("start_date", "")),
                ),
            )
            inserted += 1
        conn.commit()
        return inserted


def save_estimate_snapshot(asof: str, payload: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO estimate_snapshot (asof, payload_json) VALUES (?, ?)",
            (asof, json.dumps(payload, ensure_ascii=False)),
        )
        conn.commit()


def list_holdings() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT fund_id, name, bucket, shares, cost, start_date FROM holdings"
        ).fetchall()
    return [dict(row) for row in rows]


def insert_action(date: str, action_key: str, amount: float, done: bool) -> str:
    ts = datetime.now().astimezone().isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO actions_log (date, action_key, amount, done, ts)
            VALUES (?, ?, ?, ?, ?)
            """,
            (date, action_key, float(amount), 1 if done else 0, ts),
        )
        conn.commit()
    return ts


def list_actions(date: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT action_key, amount, done, ts
            FROM actions_log
            WHERE date = ?
            ORDER BY ts ASC
            """,
            (date,),
        ).fetchall()
    return [
        {
            "action_key": row["action_key"],
            "amount": row["amount"],
            "done": bool(row["done"]),
            "ts": row["ts"],
        }
        for row in rows
    ]


def get_latest_estimate_snapshot() -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT payload_json FROM estimate_snapshot ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["payload_json"])
    except Exception:
        return None
