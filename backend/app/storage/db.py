from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Any

from app.core.settings import DATA_DIR

DB_PATH = DATA_DIR / "app.db"


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat()


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (name,),
    ).fetchone()
    return row is not None


def _table_columns(conn: sqlite3.Connection, name: str) -> set[str]:
    if not _table_exists(conn, name):
        return set()
    rows = conn.execute(f"PRAGMA table_info({name})").fetchall()
    return {str(row['name']) for row in rows}


def _ensure_columns(conn: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    existing = _table_columns(conn, table)
    if not existing:
        return
    for column, ddl in columns.items():
        if column in existing:
            continue
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _normalize_tags(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(v).strip().lower() for v in raw if str(v).strip()]
    if isinstance(raw, str) and raw.strip():
        return [raw.strip().lower()]
    return []


def _guess_market_group(name: str, tags: list[str]) -> str:
    tag_set = set(tags)
    if "nasdaq" in tag_set or "qdii" in tag_set:
        return "us_overseas"
    if "纳斯达克" in name or "QDII" in name.upper():
        return "us_overseas"
    return "cn_hk"


def _normalize_catalog_text(value: Any) -> str:
    return str(value or "").strip()


def _derive_catalog_abbr(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isascii() and ch.isalnum())[:32]


def _migrate_holdings(conn: sqlite3.Connection) -> None:
    cols = _table_columns(conn, "holdings")
    if not cols:
        return

    required = {
        "user_id",
        "fund_id",
        "name",
        "bucket",
        "market_value_cny",
        "cost_basis_cny",
        "start_date",
        "tags_json",
        "market_group",
    }
    if required.issubset(cols):
        return

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS holdings_new (
            user_id TEXT NOT NULL,
            fund_id TEXT NOT NULL,
            name TEXT NOT NULL,
            bucket TEXT NOT NULL,
            market_value_cny REAL NOT NULL DEFAULT 0,
            cost_basis_cny REAL NOT NULL DEFAULT 0,
            shares REAL NOT NULL DEFAULT 0,
            cost REAL NOT NULL DEFAULT 0,
            start_date TEXT NOT NULL,
            tags_json TEXT NOT NULL DEFAULT '[]',
            market_group TEXT NOT NULL DEFAULT 'cn_hk',
            PRIMARY KEY (user_id, fund_id)
        )
        """
    )

    rows = conn.execute("SELECT * FROM holdings").fetchall()
    for row in rows:
        user_id = str(row["user_id"]) if "user_id" in cols and row["user_id"] else "legacy"
        fund_id = str(row["fund_id"]) if "fund_id" in cols else ""
        name = str(row["name"]) if "name" in cols else ""
        bucket = str(row["bucket"]) if "bucket" in cols else ""

        if "market_value_cny" in cols:
            market_value_cny = _to_float(row["market_value_cny"])
        elif "cost_basis_cny" in cols:
            market_value_cny = _to_float(row["cost_basis_cny"])
        elif "cost" in cols:
            market_value_cny = _to_float(row["cost"])
        else:
            market_value_cny = 0.0

        if "cost_basis_cny" in cols:
            cost_basis_cny = _to_float(row["cost_basis_cny"])
        elif "cost" in cols:
            cost_basis_cny = _to_float(row["cost"])
        else:
            cost_basis_cny = market_value_cny

        shares = _to_float(row["shares"]) if "shares" in cols else 0.0
        cost = _to_float(row["cost"]) if "cost" in cols else cost_basis_cny
        start_date = str(row["start_date"]) if "start_date" in cols and row["start_date"] else datetime.now().date().isoformat()

        if "tags_json" in cols and row["tags_json"]:
            try:
                tags = _normalize_tags(json.loads(row["tags_json"]))
            except Exception:
                tags = []
        elif "tags" in cols and row["tags"]:
            tags = _normalize_tags(row["tags"])
        else:
            tags = []
        tags_json = json.dumps(tags, ensure_ascii=False)

        if "market_group" in cols and row["market_group"]:
            market_group = str(row["market_group"])
        else:
            market_group = _guess_market_group(name, tags)

        conn.execute(
            """
            INSERT OR REPLACE INTO holdings_new (
                user_id, fund_id, name, bucket, market_value_cny, cost_basis_cny,
                shares, cost, start_date, tags_json, market_group
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                fund_id,
                name,
                bucket,
                market_value_cny,
                cost_basis_cny,
                shares,
                cost,
                start_date,
                tags_json,
                market_group,
            ),
        )

    conn.execute("DROP TABLE holdings")
    conn.execute("ALTER TABLE holdings_new RENAME TO holdings")


def _migrate_actions_log(conn: sqlite3.Connection) -> None:
    cols = _table_columns(conn, "actions_log")
    if not cols or "user_id" in cols:
        return

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS actions_log_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            date TEXT NOT NULL,
            action_key TEXT NOT NULL,
            amount REAL NOT NULL,
            done INTEGER NOT NULL,
            ts TEXT NOT NULL
        )
        """
    )

    rows = conn.execute("SELECT id, date, action_key, amount, done, ts FROM actions_log").fetchall()
    for row in rows:
        conn.execute(
            """
            INSERT INTO actions_log_new (id, user_id, date, action_key, amount, done, ts)
            VALUES (?, 'legacy', ?, ?, ?, ?, ?)
            """,
            (row["id"], row["date"], row["action_key"], row["amount"], row["done"], row["ts"]),
        )

    conn.execute("DROP TABLE actions_log")
    conn.execute("ALTER TABLE actions_log_new RENAME TO actions_log")


def _migrate_estimate_snapshot(conn: sqlite3.Connection) -> None:
    cols = _table_columns(conn, "estimate_snapshot")
    if not cols or "user_id" in cols:
        return

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS estimate_snapshot_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            asof TEXT NOT NULL,
            payload_json TEXT NOT NULL
        )
        """
    )

    rows = conn.execute("SELECT id, asof, payload_json FROM estimate_snapshot").fetchall()
    for row in rows:
        conn.execute(
            """
            INSERT INTO estimate_snapshot_new (id, user_id, asof, payload_json)
            VALUES (?, 'legacy', ?, ?)
            """,
            (row["id"], row["asof"], row["payload_json"]),
        )

    conn.execute("DROP TABLE estimate_snapshot")
    conn.execute("ALTER TABLE estimate_snapshot_new RENAME TO estimate_snapshot")


def _default_user_settings() -> dict[str, Any]:
    return {
        "display": {
            "font_scale": "large",
            "filter_mode": "all",
            "sort_mode": "market_value_desc",
            "group_order": "cn_first",
            "auto_select_fund": True,
            "auto_refresh_enabled": False,
            "auto_refresh_seconds": 60,
            "auto_refresh_visible_only": True,
            "favorite_fund_ids": [],
            "only_favorites": False,
            "table_density": "comfortable",
            "chart_range": "day",
            "chart_style": "line",
        },
        "notifications": {
            "feishu": {
                "enabled": False,
                "webhook_url": "",
                "advice_time": "14:50",
                "report_time": "15:10",
            },
            "email": {
                "enabled": False,
                "smtp_host": "",
                "smtp_port": 587,
                "sender": "",
                "recipients": "",
                "use_tls": True,
            },
        },
    }


def _merge_dict(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = dict(base)
    for key, value in incoming.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge_dict(dict(result[key]), value)
        else:
            result[key] = value
    return result


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_accounts (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS holdings (
                user_id TEXT NOT NULL,
                fund_id TEXT NOT NULL,
                name TEXT NOT NULL,
                bucket TEXT NOT NULL,
                market_value_cny REAL NOT NULL DEFAULT 0,
                cost_basis_cny REAL NOT NULL DEFAULT 0,
                shares REAL NOT NULL DEFAULT 0,
                cost REAL NOT NULL DEFAULT 0,
                start_date TEXT NOT NULL,
                tags_json TEXT NOT NULL DEFAULT '[]',
                market_group TEXT NOT NULL DEFAULT 'cn_hk',
                PRIMARY KEY (user_id, fund_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS actions_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
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
                user_id TEXT NOT NULL,
                asof TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                nickname TEXT NOT NULL DEFAULT '',
                avatar_url TEXT NOT NULL DEFAULT '',
                bio TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fund_catalog (
                fund_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                pinyin TEXT NOT NULL DEFAULT '',
                abbr TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                notify_email_placeholder TEXT NOT NULL DEFAULT '',
                notify_feishu_placeholder TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fund_profit_confirm (
                user_id TEXT NOT NULL,
                fund_id TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                profit_cny REAL NOT NULL,
                confirmed_at TEXT NOT NULL,
                PRIMARY KEY (user_id, fund_id, trade_date)
            )
            """
        )

        _migrate_holdings(conn)
        _migrate_actions_log(conn)
        _migrate_estimate_snapshot(conn)
        _ensure_columns(
            conn,
            "user_profiles",
            {
                "nickname": "TEXT NOT NULL DEFAULT ''",
                "avatar_url": "TEXT NOT NULL DEFAULT ''",
                "bio": "TEXT NOT NULL DEFAULT ''",
                "updated_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        _ensure_columns(
            conn,
            "fund_catalog",
            {
                "pinyin": "TEXT NOT NULL DEFAULT ''",
                "abbr": "TEXT NOT NULL DEFAULT ''",
                "status": "TEXT NOT NULL DEFAULT 'active'",
                "notify_email_placeholder": "TEXT NOT NULL DEFAULT ''",
                "notify_feishu_placeholder": "TEXT NOT NULL DEFAULT ''",
                "updated_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        _ensure_columns(
            conn,
            "fund_profit_confirm",
            {
                "confirmed_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        conn.commit()


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    rounds = 390000
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        rounds,
    ).hex()
    return f"pbkdf2_sha256${rounds}${salt}${digest}"


def _verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds_raw, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(rounds_raw)
    except Exception:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        rounds,
    ).hex()
    return hmac.compare_digest(digest, expected)


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, created_at FROM user_accounts WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


def create_user(username: str, password: str) -> dict[str, Any]:
    clean_username = username.strip().lower()
    if len(clean_username) < 3:
        raise ValueError("用户名至少 3 个字符")
    if len(password) < 6:
        raise ValueError("密码至少 6 个字符")

    user_id = secrets.token_hex(12)
    created_at = _now_iso()
    password_hash = _hash_password(password)

    try:
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO user_accounts (id, username, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, clean_username, password_hash, created_at),
            )
            conn.commit()
    except sqlite3.IntegrityError as exc:
        raise ValueError("用户名已存在") from exc

    return {"id": user_id, "username": clean_username, "created_at": created_at}


def verify_user_credentials(username: str, password: str) -> dict[str, Any] | None:
    clean_username = username.strip().lower()
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, created_at FROM user_accounts WHERE username = ?",
            (clean_username,),
        ).fetchone()
    if not row:
        return None
    if not _verify_password(password, str(row["password_hash"])):
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "created_at": row["created_at"],
    }


def create_session(user_id: str, ttl_days: int = 14) -> str:
    token = secrets.token_urlsafe(32)
    created_at = _now_iso()
    expires_at = (datetime.now().astimezone() + timedelta(days=ttl_days)).isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO user_sessions (token, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, created_at, expires_at),
        )
        conn.commit()
    return token


def get_user_by_session_token(token: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, u.created_at, s.expires_at
            FROM user_sessions s
            JOIN user_accounts u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
    if not row:
        return None

    try:
        expires_at = datetime.fromisoformat(str(row["expires_at"]))
    except Exception:
        return None

    if expires_at <= datetime.now().astimezone():
        with connect() as conn:
            conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
            conn.commit()
        return None

    return {
        "id": row["id"],
        "username": row["username"],
        "created_at": row["created_at"],
    }


def delete_session(token: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
        conn.commit()


def seed_user_holdings_if_empty(user_id: str, portfolio: dict[str, Any]) -> int:
    holdings = portfolio.get("holdings", []) if isinstance(portfolio, dict) else []
    if not holdings:
        return 0

    with connect() as conn:
        row = conn.execute(
            "SELECT COUNT(1) AS cnt FROM holdings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        count = int(row["cnt"]) if row else 0
        if count > 0:
            return 0

        inserted = 0
        for item in holdings:
            if not isinstance(item, dict):
                continue

            name = str(item.get("name", "")).strip()
            tags = _normalize_tags(item.get("tags", []))
            market_group = str(item.get("market_group", "")).strip() or _guess_market_group(name, tags)
            market_value = _to_float(item.get("market_value_cny", item.get("market_value", 0)))
            cost_basis = _to_float(
                item.get("cost_basis_cny", item.get("cost_basis", item.get("cost", market_value)))
            )
            shares = _to_float(item.get("shares", 0))
            cost = _to_float(item.get("cost", cost_basis))
            start_date = str(item.get("start_date", "")).strip() or datetime.now().date().isoformat()

            conn.execute(
                """
                INSERT INTO holdings (
                    user_id, fund_id, name, bucket, market_value_cny, cost_basis_cny,
                    shares, cost, start_date, tags_json, market_group
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    str(item.get("fund_id", "")).strip(),
                    name,
                    str(item.get("bucket", "")).strip(),
                    market_value,
                    cost_basis,
                    shares,
                    cost,
                    start_date,
                    json.dumps(tags, ensure_ascii=False),
                    market_group,
                ),
            )
            inserted += 1

        conn.commit()
        return inserted


def seed_holdings(portfolio: dict[str, Any]) -> int:
    return seed_user_holdings_if_empty("legacy", portfolio)


def list_holdings(user_id: str = "legacy") -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT fund_id, name, bucket, market_value_cny, cost_basis_cny,
                   shares, cost, start_date, tags_json, market_group
            FROM holdings
            WHERE user_id = ?
            ORDER BY market_value_cny DESC, fund_id ASC
            """,
            (user_id,),
        ).fetchall()

    result: list[dict[str, Any]] = []
    for row in rows:
        tags = []
        try:
            tags = _normalize_tags(json.loads(row["tags_json"]))
        except Exception:
            tags = []

        result.append(
            {
                "fund_id": row["fund_id"],
                "name": row["name"],
                "bucket": row["bucket"],
                "market_value_cny": _to_float(row["market_value_cny"]),
                "cost_basis_cny": _to_float(row["cost_basis_cny"]),
                "shares": _to_float(row["shares"]),
                "cost": _to_float(row["cost"]),
                "start_date": row["start_date"],
                "tags": tags,
                "market_group": row["market_group"],
            }
        )
    return result


def update_holding_fields(
    user_id: str,
    fund_id: str,
    updates: dict[str, Any],
) -> dict[str, Any] | None:
    allowed_fields = {"market_value_cny", "cost_basis_cny", "shares", "start_date"}
    cleaned: dict[str, Any] = {}
    for key, value in updates.items():
        if key not in allowed_fields:
            continue
        if key == "start_date":
            text = str(value or "").strip()
            if not text:
                continue
            cleaned[key] = text
        else:
            cleaned[key] = _to_float(value)

    if not cleaned:
        return None

    set_sql = ", ".join(f"{key} = ?" for key in cleaned.keys())
    params = list(cleaned.values()) + [user_id, fund_id]
    with connect() as conn:
        conn.execute(
            f"""
            UPDATE holdings
            SET {set_sql}
            WHERE user_id = ? AND fund_id = ?
            """,
            params,
        )
        conn.commit()

        row = conn.execute(
            """
            SELECT fund_id, name, bucket, market_value_cny, cost_basis_cny,
                   shares, cost, start_date, tags_json, market_group
            FROM holdings
            WHERE user_id = ? AND fund_id = ?
            """,
            (user_id, fund_id),
        ).fetchone()
    if not row:
        return None
    try:
        tags = _normalize_tags(json.loads(row["tags_json"]))
    except Exception:
        tags = []
    return {
        "fund_id": row["fund_id"],
        "name": row["name"],
        "bucket": row["bucket"],
        "market_value_cny": _to_float(row["market_value_cny"]),
        "cost_basis_cny": _to_float(row["cost_basis_cny"]),
        "shares": _to_float(row["shares"]),
        "cost": _to_float(row["cost"]),
        "start_date": row["start_date"],
        "tags": tags,
        "market_group": row["market_group"],
    }


def save_estimate_snapshot(user_id: str, asof: str, payload: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO estimate_snapshot (user_id, asof, payload_json) VALUES (?, ?, ?)",
            (user_id, asof, json.dumps(payload, ensure_ascii=False)),
        )
        conn.commit()


def get_latest_estimate_snapshot(user_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT payload_json FROM estimate_snapshot
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["payload_json"])
    except Exception:
        return None


def list_estimate_snapshots(user_id: str, limit: int = 120) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit), 1000))
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT asof, payload_json FROM estimate_snapshot
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, safe_limit),
        ).fetchall()

    snapshots: list[dict[str, Any]] = []
    for row in reversed(rows):
        try:
            payload = json.loads(str(row["payload_json"]))
        except Exception:
            continue
        snapshots.append({"asof": row["asof"], "payload": payload})
    return snapshots


def insert_action(user_id: str, date: str, action_key: str, amount: float, done: bool) -> str:
    ts = _now_iso()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO actions_log (user_id, date, action_key, amount, done, ts)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, date, action_key, float(amount), 1 if done else 0, ts),
        )
        conn.commit()
    return ts


def list_actions(user_id: str, date: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT action_key, amount, done, ts
            FROM actions_log
            WHERE user_id = ? AND date = ?
            ORDER BY ts ASC
            """,
            (user_id, date),
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


def get_user_settings(user_id: str) -> dict[str, Any]:
    defaults = _default_user_settings()
    with connect() as conn:
        row = conn.execute(
            "SELECT settings_json FROM user_settings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return defaults

    try:
        loaded = json.loads(str(row["settings_json"]))
    except Exception:
        return defaults

    if not isinstance(loaded, dict):
        return defaults
    return _merge_dict(defaults, loaded)


def upsert_user_settings(user_id: str, incoming: dict[str, Any]) -> dict[str, Any]:
    settings = _merge_dict(get_user_settings(user_id), incoming)
    payload = json.dumps(settings, ensure_ascii=False)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO user_settings (user_id, settings_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                settings_json = excluded.settings_json,
                updated_at = excluded.updated_at
            """,
            (user_id, payload, _now_iso()),
        )
        conn.commit()
    return settings


def get_user_profile(user_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT nickname, avatar_url, bio, updated_at
            FROM user_profiles
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()
    if not row:
        return {
            "nickname": "",
            "avatar_url": "",
            "bio": "",
            "updated_at": "",
        }
    return {
        "nickname": str(row["nickname"] or ""),
        "avatar_url": str(row["avatar_url"] or ""),
        "bio": str(row["bio"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


def upsert_user_profile(user_id: str, incoming: dict[str, Any]) -> dict[str, Any]:
    current = get_user_profile(user_id)
    nickname = _normalize_catalog_text(incoming.get("nickname", current["nickname"]))
    avatar_url = _normalize_catalog_text(incoming.get("avatar_url", current["avatar_url"]))
    bio = _normalize_catalog_text(incoming.get("bio", current["bio"]))
    updated_at = _now_iso()

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO user_profiles (user_id, nickname, avatar_url, bio, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                nickname = excluded.nickname,
                avatar_url = excluded.avatar_url,
                bio = excluded.bio,
                updated_at = excluded.updated_at
            """,
            (user_id, nickname, avatar_url, bio, updated_at),
        )
        conn.commit()

    return {
        "nickname": nickname,
        "avatar_url": avatar_url,
        "bio": bio,
        "updated_at": updated_at,
    }


def _normalize_catalog_item(item: dict[str, Any]) -> dict[str, str] | None:
    fund_id = _normalize_catalog_text(item.get("fund_id"))
    name = _normalize_catalog_text(item.get("name"))
    if not fund_id or not name:
        return None

    pinyin = _normalize_catalog_text(item.get("pinyin")).lower()
    abbr = _normalize_catalog_text(item.get("abbr")).lower() or _derive_catalog_abbr(name)
    status = _normalize_catalog_text(item.get("status")).lower() or "active"
    notify_email_placeholder = _normalize_catalog_text(item.get("notify_email_placeholder"))
    notify_feishu_placeholder = _normalize_catalog_text(item.get("notify_feishu_placeholder"))
    return {
        "fund_id": fund_id,
        "name": name,
        "pinyin": pinyin,
        "abbr": abbr,
        "status": status,
        "notify_email_placeholder": notify_email_placeholder,
        "notify_feishu_placeholder": notify_feishu_placeholder,
    }


def upsert_fund_catalog(items: list[dict[str, Any]]) -> int:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized = _normalize_catalog_item(item)
        if not normalized:
            continue
        fund_id = normalized["fund_id"]
        if fund_id in seen:
            continue
        seen.add(fund_id)
        rows.append(normalized)

    if not rows:
        return 0

    updated_at = _now_iso()
    with connect() as conn:
        conn.executemany(
            """
            INSERT INTO fund_catalog (
                fund_id, name, pinyin, abbr, status,
                notify_email_placeholder, notify_feishu_placeholder, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fund_id) DO UPDATE SET
                name = excluded.name,
                pinyin = excluded.pinyin,
                abbr = excluded.abbr,
                status = excluded.status,
                notify_email_placeholder = excluded.notify_email_placeholder,
                notify_feishu_placeholder = excluded.notify_feishu_placeholder,
                updated_at = excluded.updated_at
            """,
            [
                (
                    row["fund_id"],
                    row["name"],
                    row["pinyin"],
                    row["abbr"],
                    row["status"],
                    row["notify_email_placeholder"],
                    row["notify_feishu_placeholder"],
                    updated_at,
                )
                for row in rows
            ],
        )
        conn.commit()
    return len(rows)


def sync_fund_catalog_from_config(config: dict[str, Any]) -> int:
    if not isinstance(config, dict):
        return 0

    catalog_rows: list[dict[str, Any]] = []
    funds = config.get("funds", [])
    if isinstance(funds, list):
        for item in funds:
            if not isinstance(item, dict):
                continue
            catalog_rows.append(
                {
                    "fund_id": item.get("fund_id"),
                    "name": item.get("name"),
                    "pinyin": item.get("pinyin", ""),
                    "abbr": item.get("abbr", ""),
                    "status": item.get("status", "active"),
                    "notify_email_placeholder": item.get("notify_email_placeholder", ""),
                    "notify_feishu_placeholder": item.get("notify_feishu_placeholder", ""),
                }
            )

    portfolio = config.get("portfolio", {})
    holdings = portfolio.get("holdings", []) if isinstance(portfolio, dict) else []
    if isinstance(holdings, list):
        for item in holdings:
            if not isinstance(item, dict):
                continue
            catalog_rows.append(
                {
                    "fund_id": item.get("fund_id"),
                    "name": item.get("name"),
                    "pinyin": item.get("pinyin", ""),
                    "abbr": item.get("abbr", ""),
                    "status": item.get("status", "active"),
                    "notify_email_placeholder": item.get("notify_email_placeholder", ""),
                    "notify_feishu_placeholder": item.get("notify_feishu_placeholder", ""),
                }
            )

    return upsert_fund_catalog(catalog_rows)


def list_fund_suggestions(keyword: str, limit: int = 10) -> list[dict[str, Any]]:
    clean_keyword = _normalize_catalog_text(keyword)
    safe_limit = max(1, min(int(limit), 50))

    with connect() as conn:
        if clean_keyword:
            prefix = f"{clean_keyword}%"
            fuzzy = f"%{clean_keyword}%"
            rows = conn.execute(
                """
                SELECT fund_id, name, pinyin, abbr, status,
                       notify_email_placeholder, notify_feishu_placeholder
                FROM fund_catalog
                WHERE fund_id LIKE ?
                   OR name LIKE ?
                   OR pinyin LIKE ?
                   OR abbr LIKE ?
                ORDER BY
                    CASE
                        WHEN fund_id LIKE ? THEN 0
                        WHEN name LIKE ? THEN 1
                        WHEN pinyin LIKE ? THEN 2
                        ELSE 3
                    END,
                    fund_id ASC
                LIMIT ?
                """,
                (prefix, fuzzy, fuzzy.lower(), fuzzy.lower(), prefix, fuzzy, fuzzy.lower(), safe_limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT fund_id, name, pinyin, abbr, status,
                       notify_email_placeholder, notify_feishu_placeholder
                FROM fund_catalog
                ORDER BY fund_id ASC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()

    return [
        {
            "fund_id": str(row["fund_id"]),
            "name": str(row["name"]),
            "pinyin": str(row["pinyin"] or ""),
            "abbr": str(row["abbr"] or ""),
            "status": str(row["status"] or "active"),
            "notify_email_placeholder": str(row["notify_email_placeholder"] or ""),
            "notify_feishu_placeholder": str(row["notify_feishu_placeholder"] or ""),
        }
        for row in rows
    ]


def get_confirmed_fund_profit_map(user_id: str, trade_date: str) -> dict[str, float]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT fund_id, profit_cny
            FROM fund_profit_confirm
            WHERE user_id = ? AND trade_date = ?
            """,
            (user_id, trade_date),
        ).fetchall()

    return {
        str(row["fund_id"]): _to_float(row["profit_cny"])
        for row in rows
        if _normalize_catalog_text(row["fund_id"])
    }


def get_latest_estimate_snapshot_on_or_before(user_id: str, asof_date: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT payload_json FROM estimate_snapshot
            WHERE user_id = ? AND substr(asof, 1, 10) <= ?
            ORDER BY asof DESC, id DESC
            LIMIT 1
            """,
            (user_id, asof_date),
        ).fetchone()
    if not row:
        return None

    try:
        payload = json.loads(str(row["payload_json"]))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None
