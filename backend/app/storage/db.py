from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Any

from app.core.market_group import decide_market_group
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


def _normalize_catalog_text(value: Any) -> str:
    return str(value or "").strip()


def _derive_catalog_abbr(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isascii() and ch.isalnum())[:32]


def _normalize_alias_text(value: Any) -> str:
    text = _normalize_catalog_text(value).lower()
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _split_aliases(raw: Any) -> list[str]:
    if isinstance(raw, list):
        values = [str(item or "").strip() for item in raw]
    elif isinstance(raw, str):
        values = [part.strip() for part in re.split(r"[,，;；|/、]+", raw)]
    else:
        values = []
    return [value for value in values if value]


def _derive_catalog_aliases(item: dict[str, Any], name: str, tags: list[str]) -> list[str]:
    aliases: list[str] = []
    seen: set[str] = set()

    def _append(alias_value: str) -> None:
        alias_text = str(alias_value or "").strip()
        if not alias_text:
            return
        key = _normalize_alias_text(alias_text)
        if not key or key in seen:
            return
        seen.add(key)
        aliases.append(alias_text)

    for alias_value in _split_aliases(item.get("aliases")):
        _append(alias_value)

    lower_name = str(name or "").lower()
    tag_set = {str(tag or "").strip().lower() for tag in tags if str(tag or "").strip()}
    if "nasdaq" in tag_set or "纳斯达克" in name:
        for alias_value in ("纳指", "纳斯达克", "纳斯达克100", "nasdaq", "ndx"):
            _append(alias_value)
    if "qdii" in tag_set:
        _append("qdii")
    if "dividend" in tag_set or "红利" in name:
        _append("红利")
    if "consumer" in tag_set or "消费" in name:
        _append("消费")
    if "manufacturing" in tag_set or "制造" in name:
        _append("制造")
    if "港股" in name or "hk" in tag_set:
        _append("港股")
    if "科技" in name or "tech" in tag_set:
        _append("科技")
    if "nasdaq" in lower_name:
        _append("纳指")

    return aliases


def _parse_alias_csv(value: Any) -> list[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    aliases: list[str] = []
    seen: set[str] = set()
    for part in raw.split(","):
        item = str(part or "").strip()
        key = _normalize_alias_text(item)
        if not key or key in seen:
            continue
        seen.add(key)
        aliases.append(item)
    return aliases


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
        "archived",
        "archived_at",
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
            archived INTEGER NOT NULL DEFAULT 0,
            archived_at TEXT NOT NULL DEFAULT '',
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
            market_group = decide_market_group(name=name, tags=tags)
        archived = int(row["archived"]) if "archived" in cols and row["archived"] else 0
        archived_at = str(row["archived_at"]) if "archived_at" in cols and row["archived_at"] else ""

        conn.execute(
            """
            INSERT OR REPLACE INTO holdings_new (
                user_id, fund_id, name, bucket, market_value_cny, cost_basis_cny,
                shares, cost, start_date, tags_json, market_group, archived, archived_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                archived,
                archived_at,
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
            ts TEXT NOT NULL,
            occurred_at TEXT NOT NULL DEFAULT ''
        )
        """
    )

    rows = conn.execute("SELECT id, date, action_key, amount, done, ts FROM actions_log").fetchall()
    for row in rows:
        conn.execute(
            """
            INSERT INTO actions_log_new (id, user_id, date, action_key, amount, done, ts, occurred_at)
            VALUES (?, 'legacy', ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["date"],
                row["action_key"],
                row["amount"],
                row["done"],
                row["ts"],
                row["ts"],
            ),
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


def _backfill_fund_master_from_catalog(conn: sqlite3.Connection) -> None:
    fund_master_cols = _table_columns(conn, "fund_master")
    fund_catalog_cols = _table_columns(conn, "fund_catalog")
    if not fund_master_cols or not fund_catalog_cols:
        return
    if "fund_id" not in fund_master_cols or "fund_id" not in fund_catalog_cols:
        return

    rows = conn.execute(
        """
        SELECT fund_id, name, pinyin, abbr, status, updated_at
        FROM fund_catalog
        """
    ).fetchall()
    if not rows:
        return

    for row in rows:
        fund_id = _normalize_catalog_text(row["fund_id"])
        name = _normalize_catalog_text(row["name"])
        if not fund_id or not name:
            continue
        conn.execute(
            """
            INSERT OR IGNORE INTO fund_master (
                fund_id, name, pinyin, abbr, market_group, fund_type, bucket,
                tags_json, aliases_json, status, source, updated_at
            ) VALUES (?, ?, ?, ?, '', '', '', '[]', '[]', ?, 'catalog_backfill', ?)
            """,
            (
                fund_id,
                name,
                _normalize_catalog_text(row["pinyin"]).lower(),
                _normalize_catalog_text(row["abbr"]).lower() or _derive_catalog_abbr(name),
                _normalize_catalog_text(row["status"]).lower() or "active",
                _normalize_catalog_text(row["updated_at"]) or _now_iso(),
            ),
        )


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
        "network_benchmark": {
            "default_profile": "cn_fund",
            "timeout_seconds": 6,
            "last_run_at": "",
            "last_result": None,
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
                archived INTEGER NOT NULL DEFAULT 0,
                archived_at TEXT NOT NULL DEFAULT '',
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
                ts TEXT NOT NULL,
                occurred_at TEXT NOT NULL DEFAULT ''
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
            CREATE TABLE IF NOT EXISTS fund_master (
                fund_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                pinyin TEXT NOT NULL DEFAULT '',
                abbr TEXT NOT NULL DEFAULT '',
                market_group TEXT NOT NULL DEFAULT '',
                fund_type TEXT NOT NULL DEFAULT '',
                bucket TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                aliases_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'active',
                source TEXT NOT NULL DEFAULT 'config_sync',
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fund_alias (
                fund_id TEXT NOT NULL,
                alias TEXT NOT NULL,
                normalized_alias TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'catalog_sync',
                updated_at TEXT NOT NULL,
                PRIMARY KEY (fund_id, normalized_alias)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_fund_alias_normalized
            ON fund_alias (normalized_alias, fund_id)
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fund_nav_daily (
                fund_id TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                estimate_nav REAL,
                unit_nav REAL,
                asof TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT '',
                confirm_state TEXT NOT NULL DEFAULT 'estimated',
                updated_at TEXT NOT NULL,
                PRIMARY KEY (fund_id, trade_date)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fund_source_job (
                job_id TEXT PRIMARY KEY,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT NOT NULL DEFAULT '',
                total_count INTEGER NOT NULL DEFAULT 0,
                success_count INTEGER NOT NULL DEFAULT 0,
                failed_count INTEGER NOT NULL DEFAULT 0,
                error_summary TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fund_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                fingerprint TEXT NOT NULL DEFAULT '',
                external_order_no TEXT NOT NULL DEFAULT '',
                fund_id TEXT NOT NULL,
                fund_name TEXT NOT NULL DEFAULT '',
                action TEXT NOT NULL,
                occurred_at TEXT NOT NULL,
                amount_cny REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                confirmed_at TEXT NOT NULL DEFAULT '',
                shares REAL NOT NULL DEFAULT 0,
                nav REAL NOT NULL DEFAULT 0,
                fee_cny REAL NOT NULL DEFAULT 0,
                note TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                source TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_id, idempotency_key)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_fund_transactions_user_occurred
            ON fund_transactions (user_id, occurred_at DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_fund_transactions_user_status
            ON fund_transactions (user_id, status, occurred_at DESC)
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                actor_user_id TEXT NOT NULL DEFAULT '',
                actor_username TEXT NOT NULL DEFAULT '',
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                before_json TEXT NOT NULL DEFAULT '{}',
                after_json TEXT NOT NULL DEFAULT '{}',
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_entity
            ON audit_logs (user_id, entity_type, entity_id, created_at DESC)
            """
        )

        _migrate_holdings(conn)
        _migrate_actions_log(conn)
        _migrate_estimate_snapshot(conn)
        _ensure_columns(
            conn,
            "holdings",
            {
                "archived": "INTEGER NOT NULL DEFAULT 0",
                "archived_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        _ensure_columns(
            conn,
            "actions_log",
            {
                "occurred_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        conn.execute(
            """
            UPDATE actions_log
            SET occurred_at = ts
            WHERE (occurred_at IS NULL OR occurred_at = '')
            """
        )
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
            "fund_master",
            {
                "pinyin": "TEXT NOT NULL DEFAULT ''",
                "abbr": "TEXT NOT NULL DEFAULT ''",
                "market_group": "TEXT NOT NULL DEFAULT ''",
                "fund_type": "TEXT NOT NULL DEFAULT ''",
                "bucket": "TEXT NOT NULL DEFAULT ''",
                "tags_json": "TEXT NOT NULL DEFAULT '[]'",
                "aliases_json": "TEXT NOT NULL DEFAULT '[]'",
                "status": "TEXT NOT NULL DEFAULT 'active'",
                "source": "TEXT NOT NULL DEFAULT 'config_sync'",
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
        _ensure_columns(
            conn,
            "fund_nav_daily",
            {
                "asof": "TEXT NOT NULL DEFAULT ''",
                "source": "TEXT NOT NULL DEFAULT ''",
                "confirm_state": "TEXT NOT NULL DEFAULT 'estimated'",
                "updated_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        _ensure_columns(
            conn,
            "fund_source_job",
            {
                "job_type": "TEXT NOT NULL DEFAULT 'fund_sync'",
                "status": "TEXT NOT NULL DEFAULT 'done'",
                "requested_by": "TEXT NOT NULL DEFAULT ''",
                "started_at": "TEXT NOT NULL DEFAULT ''",
                "finished_at": "TEXT NOT NULL DEFAULT ''",
                "total_count": "INTEGER NOT NULL DEFAULT 0",
                "success_count": "INTEGER NOT NULL DEFAULT 0",
                "failed_count": "INTEGER NOT NULL DEFAULT 0",
                "error_summary": "TEXT NOT NULL DEFAULT ''",
            },
        )
        _ensure_columns(
            conn,
            "fund_transactions",
            {
                "fingerprint": "TEXT NOT NULL DEFAULT ''",
                "external_order_no": "TEXT NOT NULL DEFAULT ''",
                "fund_name": "TEXT NOT NULL DEFAULT ''",
                "status": "TEXT NOT NULL DEFAULT 'pending'",
                "confirmed_at": "TEXT NOT NULL DEFAULT ''",
                "shares": "REAL NOT NULL DEFAULT 0",
                "nav": "REAL NOT NULL DEFAULT 0",
                "fee_cny": "REAL NOT NULL DEFAULT 0",
                "note": "TEXT NOT NULL DEFAULT ''",
                "tags_json": "TEXT NOT NULL DEFAULT '[]'",
                "source": "TEXT NOT NULL DEFAULT ''",
                "created_at": "TEXT NOT NULL DEFAULT ''",
                "updated_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        _ensure_columns(
            conn,
            "audit_logs",
            {
                "actor_user_id": "TEXT NOT NULL DEFAULT ''",
                "actor_username": "TEXT NOT NULL DEFAULT ''",
                "before_json": "TEXT NOT NULL DEFAULT '{}'",
                "after_json": "TEXT NOT NULL DEFAULT '{}'",
                "note": "TEXT NOT NULL DEFAULT ''",
                "created_at": "TEXT NOT NULL DEFAULT ''",
            },
        )
        conn.execute(
            """
            UPDATE fund_transactions
            SET created_at = COALESCE(NULLIF(created_at, ''), occurred_at),
                updated_at = COALESCE(NULLIF(updated_at, ''), occurred_at)
            WHERE (created_at IS NULL OR created_at = '')
               OR (updated_at IS NULL OR updated_at = '')
            """
        )
        _backfill_fund_master_from_catalog(conn)
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


def username_exists(username: str) -> bool:
    clean_username = username.strip().lower()
    if not clean_username:
        return False
    with connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM user_accounts WHERE username = ? LIMIT 1",
            (clean_username,),
        ).fetchone()
    return bool(row)


def reset_user_password(username: str, password: str) -> dict[str, Any] | None:
    clean_username = username.strip().lower()
    if not clean_username:
        raise ValueError("用户名不能为空")
    if len(password) < 6:
        raise ValueError("密码至少 6 个字符")

    password_hash = _hash_password(password)
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, created_at FROM user_accounts WHERE username = ?",
            (clean_username,),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE user_accounts SET password_hash = ? WHERE id = ?",
            (password_hash, row["id"]),
        )
        conn.commit()

    return {
        "id": row["id"],
        "username": row["username"],
        "created_at": row["created_at"],
    }


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
            market_group = str(item.get("market_group", "")).strip() or decide_market_group(
                name=name,
                tags=tags,
                market=str(item.get("market", "")),
                currency=str(item.get("currency", "")),
                asset_class=str(item.get("asset_class", "")),
            )
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
                    shares, cost, start_date, tags_json, market_group, archived, archived_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')
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


def import_holdings_from_portfolio(
    user_id: str,
    portfolio: dict[str, Any],
    mode: str = "if_empty",
) -> dict[str, Any]:
    normalized_mode = str(mode or "if_empty").strip().lower()
    if normalized_mode not in {"if_empty", "append", "replace"}:
        raise ValueError("mode 仅支持 if_empty/append/replace")

    holdings = portfolio.get("holdings", []) if isinstance(portfolio, dict) else []
    if not isinstance(holdings, list):
        holdings = []

    configured_count = len([item for item in holdings if isinstance(item, dict)])
    if configured_count == 0:
        return {
            "mode": normalized_mode,
            "configured_count": 0,
            "imported_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "total_count": len(list_holdings(user_id, include_archived=True)),
        }

    with connect() as conn:
        existing_row = conn.execute(
            "SELECT COUNT(1) AS cnt FROM holdings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        existing_count = int(existing_row["cnt"]) if existing_row else 0

        if normalized_mode == "if_empty" and existing_count > 0:
            return {
                "mode": normalized_mode,
                "configured_count": configured_count,
                "imported_count": 0,
                "skipped_count": configured_count,
                "failed_count": 0,
                "total_count": existing_count,
            }

        if normalized_mode == "replace":
            conn.execute("DELETE FROM holdings WHERE user_id = ?", (user_id,))
            conn.commit()

    imported_count = 0
    failed_count = 0
    for item in holdings:
        if not isinstance(item, dict):
            failed_count += 1
            continue
        try:
            create_or_replace_holding(user_id, item)
            imported_count += 1
        except ValueError:
            failed_count += 1

    total_count = len(list_holdings(user_id, include_archived=True))
    skipped_count = max(configured_count - imported_count - failed_count, 0)
    return {
        "mode": normalized_mode,
        "configured_count": configured_count,
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "total_count": total_count,
    }


def export_holdings_as_portfolio(user_id: str, include_archived: bool = False) -> dict[str, Any]:
    rows = list_holdings(user_id=user_id, include_archived=include_archived)
    holdings: list[dict[str, Any]] = []
    for row in rows:
        item: dict[str, Any] = {
            "fund_id": row.get("fund_id", ""),
            "name": row.get("name", ""),
            "bucket": row.get("bucket", ""),
            "market_group": row.get("market_group", ""),
            "market_value_cny": round(_to_float(row.get("market_value_cny")), 2),
            "cost_basis_cny": round(_to_float(row.get("cost_basis_cny")), 2),
            "shares": round(_to_float(row.get("shares")), 4),
            "start_date": str(row.get("start_date", "")),
            "tags": row.get("tags", []),
        }
        if include_archived:
            item["archived"] = bool(row.get("archived"))
            item["archived_at"] = str(row.get("archived_at", ""))
        holdings.append(item)
    return {"holdings": holdings}


def _holding_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    tags = []
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
        "archived": bool(row["archived"]),
        "archived_at": str(row["archived_at"] or ""),
    }


def list_holdings(user_id: str = "legacy", include_archived: bool = False) -> list[dict[str, Any]]:
    where_sql = "WHERE user_id = ?"
    if not include_archived:
        where_sql += " AND archived = 0"
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT fund_id, name, bucket, market_value_cny, cost_basis_cny,
                   shares, cost, start_date, tags_json, market_group, archived, archived_at
            FROM holdings
            {where_sql}
            ORDER BY market_group ASC, market_value_cny DESC, fund_id ASC
            """,
            (user_id,),
        ).fetchall()

    result: list[dict[str, Any]] = []
    for row in rows:
        result.append(_holding_row_to_dict(row))
    return result


def _get_holding_row(conn: sqlite3.Connection, user_id: str, fund_id: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT fund_id, name, bucket, market_value_cny, cost_basis_cny,
               shares, cost, start_date, tags_json, market_group, archived, archived_at
        FROM holdings
        WHERE user_id = ? AND fund_id = ?
        """,
        (user_id, fund_id),
    ).fetchone()


def create_or_replace_holding(
    user_id: str,
    item: dict[str, Any],
    actor_user_id: str = "",
    actor_username: str = "",
    audit_note: str = "",
) -> dict[str, Any]:
    fund_id = str(item.get("fund_id", "")).strip()
    name = str(item.get("name", "")).strip()
    bucket = str(item.get("bucket", "")).strip()
    if not fund_id or not name or not bucket:
        raise ValueError("fund_id、name、bucket 为必填字段")

    market_value_cny = _to_float(item.get("market_value_cny", item.get("market_value", 0)))
    cost_basis_cny = _to_float(item.get("cost_basis_cny", item.get("cost_basis", market_value_cny)))
    shares = _to_float(item.get("shares", 0))
    cost = _to_float(item.get("cost", cost_basis_cny))
    start_date = str(item.get("start_date", "")).strip() or datetime.now().date().isoformat()
    tags = _normalize_tags(item.get("tags", []))
    market_group = str(item.get("market_group", "")).strip() or decide_market_group(
        name=name,
        tags=tags,
        market=str(item.get("market", "")),
        currency=str(item.get("currency", "")),
        asset_class=str(item.get("asset_class", "")),
    )

    clean_actor_user_id = str(actor_user_id or "").strip() or str(user_id or "").strip()
    clean_actor_username = str(actor_username or "").strip()
    clean_audit_note = str(audit_note or "").strip()
    with connect() as conn:
        before_row = _get_holding_row(conn, user_id=user_id, fund_id=fund_id)
        before = _holding_row_to_dict(before_row) if before_row else {}
        conn.execute(
            """
            INSERT INTO holdings (
                user_id, fund_id, name, bucket, market_value_cny, cost_basis_cny,
                shares, cost, start_date, tags_json, market_group, archived, archived_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')
            ON CONFLICT(user_id, fund_id) DO UPDATE SET
                name = excluded.name,
                bucket = excluded.bucket,
                market_value_cny = excluded.market_value_cny,
                cost_basis_cny = excluded.cost_basis_cny,
                shares = excluded.shares,
                cost = excluded.cost,
                start_date = excluded.start_date,
                tags_json = excluded.tags_json,
                market_group = excluded.market_group,
                archived = 0,
                archived_at = ''
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
                json.dumps(tags, ensure_ascii=False),
                market_group,
            ),
        )
        row = _get_holding_row(conn, user_id=user_id, fund_id=fund_id)
        if row:
            action = "create" if not before_row else "replace"
            note_parts = [f"fields=name,bucket,market_value_cny,cost_basis_cny,shares,start_date,tags,market_group"]
            if clean_audit_note:
                note_parts.append(clean_audit_note)
            _insert_audit_log(
                conn=conn,
                user_id=str(user_id or "").strip(),
                actor_user_id=clean_actor_user_id,
                actor_username=clean_actor_username,
                entity_type="holding",
                entity_id=fund_id,
                action=action,
                before=before,
                after=_holding_row_to_dict(row),
                note=" | ".join(note_parts),
            )
        conn.commit()
    if not row:
        raise ValueError("持仓写入失败")
    return _holding_row_to_dict(row)


def update_holding_fields(
    user_id: str,
    fund_id: str,
    updates: dict[str, Any],
    actor_user_id: str = "",
    actor_username: str = "",
    audit_note: str = "",
) -> dict[str, Any] | None:
    allowed_fields = {
        "name",
        "bucket",
        "market_group",
        "tags",
        "market_value_cny",
        "cost_basis_cny",
        "shares",
        "start_date",
    }
    cleaned: dict[str, Any] = {}
    for key, value in updates.items():
        if key not in allowed_fields:
            continue
        if key in {"name", "bucket", "market_group"}:
            text = str(value or "").strip()
            if not text:
                continue
            cleaned[key] = text
        elif key == "tags":
            cleaned["tags_json"] = json.dumps(_normalize_tags(value), ensure_ascii=False)
        elif key == "start_date":
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
    clean_actor_user_id = str(actor_user_id or "").strip() or str(user_id or "").strip()
    clean_actor_username = str(actor_username or "").strip()
    clean_audit_note = str(audit_note or "").strip()
    with connect() as conn:
        before_row = _get_holding_row(conn, user_id=user_id, fund_id=fund_id)
        if not before_row:
            return None
        before = _holding_row_to_dict(before_row)
        if bool(before.get("archived")):
            return None
        conn.execute(
            f"""
            UPDATE holdings
            SET {set_sql}
            WHERE user_id = ? AND fund_id = ? AND archived = 0
            """,
            params,
        )
        row = _get_holding_row(conn, user_id=user_id, fund_id=fund_id)
        after = _holding_row_to_dict(row) if row else {}
        changed_fields: list[str] = []
        for field in ("name", "bucket", "market_group", "start_date"):
            if str(before.get(field) or "") != str(after.get(field) or ""):
                changed_fields.append(field)
        for field in ("market_value_cny", "cost_basis_cny", "shares"):
            if abs(_to_float(before.get(field)) - _to_float(after.get(field))) > 1e-9:
                changed_fields.append(field)
        if list(before.get("tags") or []) != list(after.get("tags") or []):
            changed_fields.append("tags")
        if row and changed_fields:
            note_parts = [f"fields={','.join(changed_fields)}"]
            if clean_audit_note:
                note_parts.append(clean_audit_note)
            _insert_audit_log(
                conn=conn,
                user_id=str(user_id or "").strip(),
                actor_user_id=clean_actor_user_id,
                actor_username=clean_actor_username,
                entity_type="holding",
                entity_id=str(fund_id or "").strip(),
                action="patch",
                before=before,
                after=after,
                note=" | ".join(note_parts),
            )
        conn.commit()
    if not row:
        return None
    return _holding_row_to_dict(row)


def archive_holding(
    user_id: str,
    fund_id: str,
    actor_user_id: str = "",
    actor_username: str = "",
    audit_note: str = "",
) -> dict[str, Any] | None:
    archived_at = _now_iso()
    clean_actor_user_id = str(actor_user_id or "").strip() or str(user_id or "").strip()
    clean_actor_username = str(actor_username or "").strip()
    clean_audit_note = str(audit_note or "").strip()
    with connect() as conn:
        before_row = _get_holding_row(conn, user_id=user_id, fund_id=fund_id)
        if not before_row:
            return None
        before = _holding_row_to_dict(before_row)
        if bool(before.get("archived")):
            return before
        conn.execute(
            """
            UPDATE holdings
            SET archived = 1, archived_at = ?
            WHERE user_id = ? AND fund_id = ? AND archived = 0
            """,
            (archived_at, user_id, fund_id),
        )
        row = _get_holding_row(conn, user_id=user_id, fund_id=fund_id)
        if row:
            note_parts = ["fields=archived,archived_at"]
            if clean_audit_note:
                note_parts.append(clean_audit_note)
            _insert_audit_log(
                conn=conn,
                user_id=str(user_id or "").strip(),
                actor_user_id=clean_actor_user_id,
                actor_username=clean_actor_username,
                entity_type="holding",
                entity_id=str(fund_id or "").strip(),
                action="archive",
                before=before,
                after=_holding_row_to_dict(row),
                note=" | ".join(note_parts),
            )
        conn.commit()
    if not row:
        return None
    return _holding_row_to_dict(row)


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


def insert_action(
    user_id: str,
    date: str,
    action_key: str,
    amount: float,
    done: bool,
    occurred_at: str | None = None,
) -> str:
    ts = _now_iso()
    occurred = str(occurred_at or "").strip() or ts
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO actions_log (user_id, date, action_key, amount, done, ts, occurred_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, date, action_key, float(amount), 1 if done else 0, ts, occurred),
        )
        conn.commit()
    return ts


def list_actions(user_id: str, date: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT action_key, amount, done, ts, occurred_at
            FROM actions_log
            WHERE user_id = ? AND date = ?
            ORDER BY COALESCE(NULLIF(occurred_at, ''), ts) ASC, ts ASC
            """,
            (user_id, date),
        ).fetchall()

    return [
        {
            "action_key": row["action_key"],
            "amount": row["amount"],
            "done": bool(row["done"]),
            "ts": row["ts"],
            "occurred_at": str(row["occurred_at"] or row["ts"] or ""),
        }
        for row in rows
    ]


def _normalize_transaction_status(status: str | None) -> str:
    text = str(status or "").strip().lower()
    if text == "confirmed":
        return "confirmed"
    return "pending"


def _normalize_transaction_action(action: str | None) -> str:
    text = str(action or "").strip().lower()
    allowed = {"buy", "redeem", "sip", "switch_in", "switch_out", "dividend"}
    return text if text in allowed else "buy"


def _normalize_transaction_tags(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    items: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if text:
            items.append(text)
    return items


def _transaction_fingerprint(
    fund_id: str,
    action: str,
    occurred_at: str,
    amount_cny: float,
    external_order_no: str,
) -> str:
    content = "|".join(
        [
            _normalize_catalog_text(fund_id),
            _normalize_catalog_text(action),
            _normalize_catalog_text(occurred_at),
            f"{float(amount_cny):.6f}",
            _normalize_catalog_text(external_order_no),
        ]
    )
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _row_to_fund_transaction(row: sqlite3.Row) -> dict[str, Any]:
    try:
        tags = json.loads(str(row["tags_json"] or "[]"))
    except Exception:
        tags = []
    return {
        "id": int(row["id"]),
        "idempotency_key": str(row["idempotency_key"] or ""),
        "external_order_no": str(row["external_order_no"] or ""),
        "fund_id": str(row["fund_id"] or ""),
        "fund_name": str(row["fund_name"] or ""),
        "action": str(row["action"] or ""),
        "occurred_at": str(row["occurred_at"] or ""),
        "amount_cny": _to_float(row["amount_cny"]),
        "status": _normalize_transaction_status(str(row["status"] or "")),
        "confirmed_at": str(row["confirmed_at"] or ""),
        "shares": _to_float(row["shares"]),
        "nav": _to_float(row["nav"]),
        "fee_cny": _to_float(row["fee_cny"]),
        "note": str(row["note"] or ""),
        "tags": _normalize_transaction_tags(tags),
        "source": str(row["source"] or ""),
        "created_at": str(row["created_at"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


def _load_json_object(raw: Any) -> dict[str, Any]:
    try:
        parsed = json.loads(str(raw or "{}"))
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _row_to_audit_log(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "user_id": str(row["user_id"] or ""),
        "actor_user_id": str(row["actor_user_id"] or ""),
        "actor_username": str(row["actor_username"] or ""),
        "entity_type": str(row["entity_type"] or ""),
        "entity_id": str(row["entity_id"] or ""),
        "action": str(row["action"] or ""),
        "before": _load_json_object(row["before_json"]),
        "after": _load_json_object(row["after_json"]),
        "note": str(row["note"] or ""),
        "created_at": str(row["created_at"] or ""),
    }


def _transaction_rows_equivalent(row: sqlite3.Row, payload: dict[str, Any]) -> bool:
    if _normalize_catalog_text(row["fund_id"]) != _normalize_catalog_text(payload.get("fund_id")):
        return False
    if _normalize_catalog_text(row["action"]) != _normalize_catalog_text(payload.get("action")):
        return False
    if _normalize_catalog_text(row["occurred_at"]) != _normalize_catalog_text(payload.get("occurred_at")):
        return False
    if abs(_to_float(row["amount_cny"]) - _to_float(payload.get("amount_cny"))) > 1e-9:
        return False
    if _normalize_transaction_status(row["status"]) != _normalize_transaction_status(payload.get("status")):
        return False
    if _normalize_catalog_text(row["external_order_no"]) != _normalize_catalog_text(payload.get("external_order_no")):
        return False
    return True


def save_fund_transaction(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    clean_user_id = str(user_id or "").strip()
    clean_fund_id = _normalize_catalog_text(payload.get("fund_id"))
    clean_action = _normalize_transaction_action(payload.get("action"))
    clean_occurred_at = _normalize_catalog_text(payload.get("occurred_at"))
    clean_external_order_no = _normalize_catalog_text(payload.get("external_order_no"))
    clean_status = _normalize_transaction_status(payload.get("status"))
    amount_cny = _to_float(payload.get("amount_cny"))

    normalized_idempotency = _normalize_catalog_text(payload.get("idempotency_key"))
    fingerprint = _transaction_fingerprint(
        fund_id=clean_fund_id,
        action=clean_action,
        occurred_at=clean_occurred_at,
        amount_cny=amount_cny,
        external_order_no=clean_external_order_no,
    )
    idempotency_key = normalized_idempotency or f"fp-{fingerprint[:24]}"

    now_iso = _now_iso()
    row_payload = {
        "idempotency_key": idempotency_key,
        "fingerprint": fingerprint,
        "external_order_no": clean_external_order_no,
        "fund_id": clean_fund_id,
        "fund_name": _normalize_catalog_text(payload.get("fund_name")),
        "action": clean_action,
        "occurred_at": clean_occurred_at,
        "amount_cny": amount_cny,
        "status": clean_status,
        "confirmed_at": _normalize_catalog_text(payload.get("confirmed_at")),
        "shares": _to_float(payload.get("shares")),
        "nav": _to_float(payload.get("nav")),
        "fee_cny": _to_float(payload.get("fee_cny")),
        "note": _normalize_catalog_text(payload.get("note")),
        "tags_json": json.dumps(_normalize_transaction_tags(payload.get("tags")), ensure_ascii=False),
        "source": _normalize_catalog_text(payload.get("source")),
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    with connect() as conn:
        same_key_row = conn.execute(
            """
            SELECT *
            FROM fund_transactions
            WHERE user_id = ? AND idempotency_key = ?
            LIMIT 1
            """,
            (clean_user_id, idempotency_key),
        ).fetchone()
        if same_key_row:
            if _transaction_rows_equivalent(same_key_row, row_payload):
                return {
                    "result": "skipped",
                    "reason": "idempotency_key 已存在且内容一致",
                    "transaction": _row_to_fund_transaction(same_key_row),
                }
            return {
                "result": "conflicted",
                "reason": "idempotency_key 已存在但字段不一致",
                "transaction": _row_to_fund_transaction(same_key_row),
            }

        if clean_external_order_no:
            order_row = conn.execute(
                """
                SELECT *
                FROM fund_transactions
                WHERE user_id = ? AND external_order_no = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (clean_user_id, clean_external_order_no),
            ).fetchone()
            if order_row:
                if _transaction_rows_equivalent(order_row, row_payload):
                    return {
                        "result": "skipped",
                        "reason": "external_order_no 已存在且内容一致",
                        "transaction": _row_to_fund_transaction(order_row),
                    }
                return {
                    "result": "conflicted",
                    "reason": "external_order_no 已存在但字段不一致",
                    "transaction": _row_to_fund_transaction(order_row),
                }

        fingerprint_row = conn.execute(
            """
            SELECT *
            FROM fund_transactions
            WHERE user_id = ? AND fingerprint = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (clean_user_id, fingerprint),
        ).fetchone()
        if fingerprint_row:
            return {
                "result": "skipped",
                "reason": "交易指纹重复",
                "transaction": _row_to_fund_transaction(fingerprint_row),
            }

        conn.execute(
            """
            INSERT INTO fund_transactions (
                user_id, idempotency_key, fingerprint, external_order_no, fund_id, fund_name,
                action, occurred_at, amount_cny, status, confirmed_at, shares, nav, fee_cny,
                note, tags_json, source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                clean_user_id,
                row_payload["idempotency_key"],
                row_payload["fingerprint"],
                row_payload["external_order_no"],
                row_payload["fund_id"],
                row_payload["fund_name"],
                row_payload["action"],
                row_payload["occurred_at"],
                row_payload["amount_cny"],
                row_payload["status"],
                row_payload["confirmed_at"],
                row_payload["shares"],
                row_payload["nav"],
                row_payload["fee_cny"],
                row_payload["note"],
                row_payload["tags_json"],
                row_payload["source"],
                row_payload["created_at"],
                row_payload["updated_at"],
            ),
        )
        conn.commit()

        inserted = conn.execute(
            """
            SELECT *
            FROM fund_transactions
            WHERE user_id = ? AND idempotency_key = ?
            LIMIT 1
            """,
            (clean_user_id, idempotency_key),
        ).fetchone()

    return {
        "result": "added",
        "reason": "",
        "transaction": _row_to_fund_transaction(inserted) if inserted else None,
    }


def list_fund_transactions(
    user_id: str,
    status: str = "all",
    date_from: str | None = None,
    date_to: str | None = None,
    fund_id: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    clean_user_id = str(user_id or "").strip()
    safe_limit = max(1, min(int(limit), 2000))
    clean_status = str(status or "all").strip().lower()
    filters = ["user_id = ?"]
    params: list[Any] = [clean_user_id]

    if clean_status in {"pending", "confirmed"}:
        filters.append("status = ?")
        params.append(clean_status)
    clean_fund_id = _normalize_catalog_text(fund_id or "")
    if clean_fund_id:
        filters.append("fund_id = ?")
        params.append(clean_fund_id)

    clean_from = _normalize_catalog_text(date_from or "")
    clean_to = _normalize_catalog_text(date_to or "")
    if clean_from:
        filters.append("substr(occurred_at, 1, 10) >= ?")
        params.append(clean_from)
    if clean_to:
        filters.append("substr(occurred_at, 1, 10) <= ?")
        params.append(clean_to)

    params.append(safe_limit)
    where_sql = " AND ".join(filters)
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM fund_transactions
            WHERE {where_sql}
            ORDER BY occurred_at DESC, id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
    return [_row_to_fund_transaction(row) for row in rows]


def summarize_fund_transactions(user_id: str) -> dict[str, Any]:
    clean_user_id = str(user_id or "").strip()
    return summarize_fund_transactions_by_fund(user_id=clean_user_id, fund_id=None)


def summarize_fund_transactions_by_fund(user_id: str, fund_id: str | None = None) -> dict[str, Any]:
    clean_user_id = str(user_id or "").strip()
    clean_fund_id = _normalize_catalog_text(fund_id or "")
    with connect() as conn:
        if clean_fund_id:
            row = conn.execute(
                """
                SELECT
                    COUNT(1) AS total_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
                    MAX(occurred_at) AS last_occurred_at
                FROM fund_transactions
                WHERE user_id = ? AND fund_id = ?
                """,
                (clean_user_id, clean_fund_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT
                    COUNT(1) AS total_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
                    MAX(occurred_at) AS last_occurred_at
                FROM fund_transactions
                WHERE user_id = ?
                """,
                (clean_user_id,),
            ).fetchone()

    total_count = int(row["total_count"] or 0) if row else 0
    pending_count = int(row["pending_count"] or 0) if row else 0
    confirmed_count = int(row["confirmed_count"] or 0) if row else 0
    last_occurred_at = str(row["last_occurred_at"] or "") if row else ""
    return {
        "total_count": total_count,
        "pending_count": pending_count,
        "confirmed_count": confirmed_count,
        "last_occurred_at": last_occurred_at,
    }


def summarize_fund_transactions_map(user_id: str) -> dict[str, dict[str, Any]]:
    clean_user_id = str(user_id or "").strip()
    if not clean_user_id:
        return {}

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                fund_id,
                COUNT(1) AS total_count,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
                MAX(occurred_at) AS last_occurred_at
            FROM fund_transactions
            WHERE user_id = ?
            GROUP BY fund_id
            """,
            (clean_user_id,),
        ).fetchall()

    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        fund_id = _normalize_catalog_text(row["fund_id"])
        if not fund_id:
            continue
        result[fund_id] = {
            "total_count": int(row["total_count"] or 0),
            "pending_count": int(row["pending_count"] or 0),
            "confirmed_count": int(row["confirmed_count"] or 0),
            "last_occurred_at": str(row["last_occurred_at"] or ""),
        }
    return result


def list_pending_fund_transactions_for_sync(user_id: str, limit: int = 500) -> list[dict[str, Any]]:
    clean_user_id = str(user_id or "").strip()
    safe_limit = max(1, min(int(limit), 2000))
    return list_pending_fund_transactions_for_sync_by_fund(user_id=clean_user_id, limit=safe_limit, fund_id=None)


def list_pending_fund_transactions_for_sync_by_fund(
    user_id: str,
    limit: int = 500,
    fund_id: str | None = None,
) -> list[dict[str, Any]]:
    clean_user_id = str(user_id or "").strip()
    safe_limit = max(1, min(int(limit), 2000))
    clean_fund_id = _normalize_catalog_text(fund_id or "")
    with connect() as conn:
        if clean_fund_id:
            rows = conn.execute(
                """
                SELECT *
                FROM fund_transactions
                WHERE user_id = ? AND status = 'pending' AND fund_id = ?
                ORDER BY occurred_at ASC, id ASC
                LIMIT ?
                """,
                (clean_user_id, clean_fund_id, safe_limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT *
                FROM fund_transactions
                WHERE user_id = ? AND status = 'pending'
                ORDER BY occurred_at ASC, id ASC
                LIMIT ?
                """,
                (clean_user_id, safe_limit),
            ).fetchall()
    return [_row_to_fund_transaction(row) for row in rows]


def get_nav_for_transaction_sync(fund_id: str, occurred_at: str) -> dict[str, Any] | None:
    clean_fund_id = _normalize_catalog_text(fund_id)
    occurred_date = _normalize_catalog_text(occurred_at[:10] if occurred_at else "")
    if not clean_fund_id:
        return None

    with connect() as conn:
        row = None
        if occurred_date:
            row = conn.execute(
                """
                SELECT fund_id, trade_date, estimate_nav, unit_nav, asof, source, confirm_state, updated_at
                FROM fund_nav_daily
                WHERE fund_id = ? AND trade_date >= ?
                ORDER BY trade_date ASC, asof ASC
                LIMIT 1
                """,
                (clean_fund_id, occurred_date),
            ).fetchone()
        if not row:
            row = conn.execute(
                """
                SELECT fund_id, trade_date, estimate_nav, unit_nav, asof, source, confirm_state, updated_at
                FROM fund_nav_daily
                WHERE fund_id = ?
                ORDER BY trade_date DESC, asof DESC
                LIMIT 1
                """,
                (clean_fund_id,),
            ).fetchone()

    if not row:
        return None
    nav = _to_float(row["unit_nav"], default=0.0)
    if nav <= 0:
        nav = _to_float(row["estimate_nav"], default=0.0)
    if nav <= 0:
        return None

    return {
        "fund_id": str(row["fund_id"] or ""),
        "trade_date": str(row["trade_date"] or ""),
        "nav": nav,
        "asof": str(row["asof"] or ""),
        "source": str(row["source"] or ""),
        "confirm_state": str(row["confirm_state"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


def confirm_fund_transaction(
    user_id: str,
    transaction_id: int,
    nav: float,
    confirmed_at: str,
    source: str = "",
) -> dict[str, Any] | None:
    clean_user_id = str(user_id or "").strip()
    tx_id = int(transaction_id)
    nav_value = _to_float(nav, default=0.0)
    if nav_value <= 0:
        return None

    with connect() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM fund_transactions
            WHERE user_id = ? AND id = ?
            LIMIT 1
            """,
            (clean_user_id, tx_id),
        ).fetchone()
        if not row:
            return None
        if str(row["status"] or "").strip().lower() != "pending":
            return _row_to_fund_transaction(row)

        amount_cny = _to_float(row["amount_cny"])
        shares = amount_cny / nav_value if nav_value > 0 else 0.0
        updated_source = _normalize_catalog_text(source) or str(row["source"] or "")
        now_iso = _now_iso()
        clean_confirmed_at = _normalize_catalog_text(confirmed_at) or now_iso

        conn.execute(
            """
            UPDATE fund_transactions
            SET status = 'confirmed',
                confirmed_at = ?,
                nav = ?,
                shares = ?,
                source = ?,
                updated_at = ?
            WHERE user_id = ? AND id = ?
            """,
            (
                clean_confirmed_at,
                nav_value,
                shares,
                updated_source,
                now_iso,
                clean_user_id,
                tx_id,
            ),
        )
        conn.commit()

        updated = conn.execute(
            """
            SELECT *
            FROM fund_transactions
            WHERE user_id = ? AND id = ?
            LIMIT 1
            """,
            (clean_user_id, tx_id),
        ).fetchone()

    return _row_to_fund_transaction(updated) if updated else None


def _insert_audit_log(
    conn: sqlite3.Connection,
    user_id: str,
    actor_user_id: str,
    actor_username: str,
    entity_type: str,
    entity_id: str,
    action: str,
    before: dict[str, Any],
    after: dict[str, Any],
    note: str = "",
) -> None:
    conn.execute(
        """
        INSERT INTO audit_logs (
            user_id, actor_user_id, actor_username, entity_type, entity_id,
            action, before_json, after_json, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(user_id or "").strip(),
            str(actor_user_id or "").strip(),
            str(actor_username or "").strip(),
            str(entity_type or "").strip(),
            str(entity_id or "").strip(),
            str(action or "").strip(),
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            str(note or "").strip(),
            _now_iso(),
        ),
    )


def patch_fund_transaction(
    user_id: str,
    transaction_id: int,
    patch: dict[str, Any],
    actor_user_id: str = "",
    actor_username: str = "",
    audit_note: str = "",
) -> dict[str, Any] | None:
    clean_user_id = str(user_id or "").strip()
    tx_id = int(transaction_id)
    if tx_id <= 0:
        raise ValueError("交易 ID 非法")

    allowed_fields = {"occurred_at", "status", "confirmed_at", "amount_cny", "shares", "nav", "fee_cny", "note"}
    patch_payload = {key: value for key, value in patch.items() if key in allowed_fields}
    if not patch_payload:
        raise ValueError("缺少可更新字段")

    clean_actor_user_id = str(actor_user_id or "").strip() or clean_user_id
    clean_actor_username = str(actor_username or "").strip()
    clean_audit_note = str(audit_note or "").strip()

    with connect() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM fund_transactions
            WHERE user_id = ? AND id = ?
            LIMIT 1
            """,
            (clean_user_id, tx_id),
        ).fetchone()
        if not row:
            return None

        before = _row_to_fund_transaction(row)
        target = dict(before)

        if "occurred_at" in patch_payload:
            occurred_at = _normalize_catalog_text(patch_payload.get("occurred_at"))
            if not occurred_at:
                raise ValueError("occurred_at 不能为空")
            target["occurred_at"] = occurred_at

        if "status" in patch_payload:
            raw_status = str(patch_payload.get("status") or "").strip().lower()
            if raw_status not in {"pending", "confirmed"}:
                raise ValueError("status 仅支持 pending/confirmed")
            target["status"] = raw_status

        if "confirmed_at" in patch_payload:
            target["confirmed_at"] = _normalize_catalog_text(patch_payload.get("confirmed_at"))

        if "amount_cny" in patch_payload:
            amount_cny = _to_float(patch_payload.get("amount_cny"))
            if amount_cny <= 0:
                raise ValueError("amount_cny 必须大于 0")
            target["amount_cny"] = amount_cny

        if "fee_cny" in patch_payload:
            fee_cny = _to_float(patch_payload.get("fee_cny"))
            if fee_cny < 0:
                raise ValueError("fee_cny 不能小于 0")
            target["fee_cny"] = fee_cny

        if "nav" in patch_payload:
            nav = _to_float(patch_payload.get("nav"))
            if nav < 0:
                raise ValueError("nav 不能小于 0")
            target["nav"] = nav

        if "shares" in patch_payload:
            shares = _to_float(patch_payload.get("shares"))
            if shares < 0:
                raise ValueError("shares 不能小于 0")
            target["shares"] = shares

        if "note" in patch_payload:
            target["note"] = _normalize_catalog_text(patch_payload.get("note"))

        now_iso = _now_iso()
        if str(target.get("status") or "").lower() == "pending":
            target["confirmed_at"] = ""
            if "nav" not in patch_payload:
                target["nav"] = 0.0
            if "shares" not in patch_payload:
                target["shares"] = 0.0
        else:
            if not _normalize_catalog_text(target.get("confirmed_at")):
                target["confirmed_at"] = now_iso
            nav_value = _to_float(target.get("nav"))
            shares_value = _to_float(target.get("shares"))
            amount_value = _to_float(target.get("amount_cny"))
            if nav_value <= 0 and shares_value > 0 and amount_value > 0:
                nav_value = amount_value / shares_value
                target["nav"] = nav_value
            if shares_value <= 0 and nav_value > 0 and amount_value > 0:
                shares_value = amount_value / nav_value
                target["shares"] = shares_value
            if _to_float(target.get("nav")) <= 0:
                raise ValueError("confirmed 状态必须提供有效净值（nav）")

        compare_fields = ("occurred_at", "amount_cny", "status", "confirmed_at", "shares", "nav", "fee_cny", "note")
        numeric_fields = {"amount_cny", "shares", "nav", "fee_cny"}
        changed_fields: list[str] = []
        for field in compare_fields:
            if field in numeric_fields:
                if abs(_to_float(before.get(field)) - _to_float(target.get(field))) > 1e-9:
                    changed_fields.append(field)
            else:
                if str(before.get(field) or "") != str(target.get(field) or ""):
                    changed_fields.append(field)

        if not changed_fields:
            return {
                "transaction": before,
                "changed": False,
                "audit_logged": False,
                "changed_fields": [],
            }

        old_source = _normalize_catalog_text(before.get("source"))
        if "manual_patch" in old_source:
            source = old_source
        else:
            source = f"{old_source}|manual_patch" if old_source else "manual_patch"

        conn.execute(
            """
            UPDATE fund_transactions
            SET occurred_at = ?,
                amount_cny = ?,
                status = ?,
                confirmed_at = ?,
                shares = ?,
                nav = ?,
                fee_cny = ?,
                note = ?,
                source = ?,
                updated_at = ?
            WHERE user_id = ? AND id = ?
            """,
            (
                str(target.get("occurred_at") or ""),
                _to_float(target.get("amount_cny")),
                str(target.get("status") or "pending"),
                str(target.get("confirmed_at") or ""),
                _to_float(target.get("shares")),
                _to_float(target.get("nav")),
                _to_float(target.get("fee_cny")),
                str(target.get("note") or ""),
                source,
                now_iso,
                clean_user_id,
                tx_id,
            ),
        )

        updated_row = conn.execute(
            """
            SELECT *
            FROM fund_transactions
            WHERE user_id = ? AND id = ?
            LIMIT 1
            """,
            (clean_user_id, tx_id),
        ).fetchone()
        updated = _row_to_fund_transaction(updated_row) if updated_row else None
        if not updated:
            conn.commit()
            return None

        audit_note_parts = [f"fields={','.join(changed_fields)}"]
        if clean_audit_note:
            audit_note_parts.append(clean_audit_note)
        _insert_audit_log(
            conn=conn,
            user_id=clean_user_id,
            actor_user_id=clean_actor_user_id,
            actor_username=clean_actor_username,
            entity_type="fund_transaction",
            entity_id=str(tx_id),
            action="patch",
            before=before,
            after=updated,
            note=" | ".join(audit_note_parts),
        )
        conn.commit()

    return {
        "transaction": updated,
        "changed": True,
        "audit_logged": True,
        "changed_fields": changed_fields,
    }


def list_audit_logs(
    user_id: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    clean_user_id = str(user_id or "").strip()
    clean_entity_type = str(entity_type or "").strip()
    clean_entity_id = str(entity_id or "").strip()
    safe_limit = max(1, min(int(limit), 500))

    filters = ["user_id = ?"]
    params: list[Any] = [clean_user_id]
    if clean_entity_type:
        filters.append("entity_type = ?")
        params.append(clean_entity_type)
    if clean_entity_id:
        filters.append("entity_id = ?")
        params.append(clean_entity_id)
    params.append(safe_limit)
    where_sql = " AND ".join(filters)

    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM audit_logs
            WHERE {where_sql}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
    return [_row_to_audit_log(row) for row in rows]


def list_holding_audit_logs(user_id: str, fund_id: str, limit: int = 100) -> list[dict[str, Any]]:
    clean_fund_id = _normalize_catalog_text(fund_id)
    if not clean_fund_id:
        return []
    return list_audit_logs(
        user_id=user_id,
        entity_type="holding",
        entity_id=clean_fund_id,
        limit=limit,
    )


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


def _normalize_catalog_item(item: dict[str, Any]) -> dict[str, Any] | None:
    fund_id = _normalize_catalog_text(item.get("fund_id"))
    name = _normalize_catalog_text(item.get("name"))
    if not fund_id or not name:
        return None

    tags = _normalize_tags(item.get("tags"))
    pinyin = _normalize_catalog_text(item.get("pinyin")).lower()
    abbr = _normalize_catalog_text(item.get("abbr")).lower() or _derive_catalog_abbr(name)
    status = _normalize_catalog_text(item.get("status")).lower() or "active"
    bucket = _normalize_catalog_text(item.get("bucket"))
    market_group = _normalize_catalog_text(item.get("market_group")) or decide_market_group(
        name=name,
        tags=tags,
        market=_normalize_catalog_text(item.get("market")),
        currency=_normalize_catalog_text(item.get("currency")),
        asset_class=_normalize_catalog_text(item.get("asset_class")),
    )
    fund_type = _normalize_catalog_text(item.get("fund_type") or item.get("type")).lower()
    source = _normalize_catalog_text(item.get("source")).lower() or "config_sync"
    notify_email_placeholder = _normalize_catalog_text(item.get("notify_email_placeholder"))
    notify_feishu_placeholder = _normalize_catalog_text(item.get("notify_feishu_placeholder"))
    aliases = _derive_catalog_aliases(item=item, name=name, tags=tags)
    return {
        "fund_id": fund_id,
        "name": name,
        "pinyin": pinyin,
        "abbr": abbr,
        "market_group": market_group,
        "fund_type": fund_type,
        "bucket": bucket,
        "tags": tags,
        "source": source,
        "status": status,
        "notify_email_placeholder": notify_email_placeholder,
        "notify_feishu_placeholder": notify_feishu_placeholder,
        "aliases": aliases,
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
        _upsert_fund_master(conn=conn, rows=rows, updated_at=updated_at)
        _replace_fund_aliases(conn=conn, rows=rows, updated_at=updated_at)
        conn.commit()
    return len(rows)


def _replace_fund_aliases(conn: sqlite3.Connection, rows: list[dict[str, Any]], updated_at: str) -> None:
    fund_ids = [str(row.get("fund_id") or "").strip() for row in rows if str(row.get("fund_id") or "").strip()]
    if not fund_ids:
        return

    placeholders = ",".join("?" for _ in fund_ids)
    conn.execute(f"DELETE FROM fund_alias WHERE fund_id IN ({placeholders})", fund_ids)

    alias_rows: list[tuple[str, str, str, str, str]] = []
    for row in rows:
        fund_id = str(row.get("fund_id") or "").strip()
        aliases = row.get("aliases", [])
        if not fund_id or not isinstance(aliases, list):
            continue
        for alias_value in aliases:
            alias = str(alias_value or "").strip()
            normalized_alias = _normalize_alias_text(alias)
            if not normalized_alias:
                continue
            alias_rows.append((fund_id, alias, normalized_alias, "catalog_sync", updated_at))

    if alias_rows:
        conn.executemany(
            """
            INSERT OR REPLACE INTO fund_alias (
                fund_id, alias, normalized_alias, source, updated_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            alias_rows,
        )


def _upsert_fund_master(conn: sqlite3.Connection, rows: list[dict[str, Any]], updated_at: str) -> None:
    if not rows:
        return
    conn.executemany(
        """
        INSERT INTO fund_master (
            fund_id, name, pinyin, abbr, market_group, fund_type, bucket,
            tags_json, aliases_json, status, source, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fund_id) DO UPDATE SET
            name = excluded.name,
            pinyin = excluded.pinyin,
            abbr = excluded.abbr,
            market_group = excluded.market_group,
            fund_type = excluded.fund_type,
            bucket = excluded.bucket,
            tags_json = excluded.tags_json,
            aliases_json = excluded.aliases_json,
            status = excluded.status,
            source = excluded.source,
            updated_at = excluded.updated_at
        """,
        [
            (
                row["fund_id"],
                row["name"],
                row["pinyin"],
                row["abbr"],
                str(row.get("market_group") or ""),
                str(row.get("fund_type") or ""),
                str(row.get("bucket") or ""),
                json.dumps(_normalize_tags(row.get("tags")), ensure_ascii=False),
                json.dumps([str(alias or "").strip() for alias in row.get("aliases", []) if str(alias or "").strip()], ensure_ascii=False),
                row["status"],
                str(row.get("source") or "config_sync"),
                updated_at,
            )
            for row in rows
        ],
    )


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
                    "aliases": item.get("aliases", []),
                    "tags": item.get("tags", []),
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
                    "aliases": item.get("aliases", []),
                    "tags": item.get("tags", []),
                    "status": item.get("status", "active"),
                    "notify_email_placeholder": item.get("notify_email_placeholder", ""),
                    "notify_feishu_placeholder": item.get("notify_feishu_placeholder", ""),
                }
            )

    return upsert_fund_catalog(catalog_rows)


def list_fund_suggestions(keyword: str, limit: int = 10) -> list[dict[str, Any]]:
    clean_keyword = _normalize_catalog_text(keyword)
    clean_keyword_normalized = _normalize_alias_text(clean_keyword)
    safe_limit = max(1, min(int(limit), 50))

    with connect() as conn:
        if clean_keyword:
            prefix = f"{clean_keyword}%"
            fuzzy = f"%{clean_keyword}%"
            fuzzy_lower = f"%{clean_keyword.lower()}%"
            fuzzy_normalized = f"%{clean_keyword_normalized or clean_keyword.lower()}%"
            rows = conn.execute(
                """
                SELECT m.fund_id, m.name, m.pinyin, m.abbr, m.status,
                       c.notify_email_placeholder, c.notify_feishu_placeholder,
                       m.market_group, m.fund_type, m.bucket, m.tags_json,
                       (
                           SELECT GROUP_CONCAT(alias)
                           FROM fund_alias fa_all
                           WHERE fa_all.fund_id = m.fund_id
                       ) AS aliases_csv,
                       (
                           SELECT GROUP_CONCAT(alias)
                           FROM fund_alias fa_hit
                           WHERE fa_hit.fund_id = m.fund_id
                             AND (fa_hit.alias LIKE ? OR fa_hit.normalized_alias LIKE ?)
                       ) AS alias_hits_csv
                FROM fund_master m
                LEFT JOIN fund_catalog c ON c.fund_id = m.fund_id
                WHERE m.fund_id LIKE ?
                   OR m.name LIKE ?
                   OR m.pinyin LIKE ?
                   OR m.abbr LIKE ?
                   OR EXISTS (
                       SELECT 1
                       FROM fund_alias fa_hit
                       WHERE fa_hit.fund_id = m.fund_id
                         AND (fa_hit.alias LIKE ? OR fa_hit.normalized_alias LIKE ?)
                   )
                ORDER BY
                    CASE
                        WHEN m.fund_id LIKE ? THEN 0
                        WHEN m.name LIKE ? THEN 1
                        WHEN EXISTS (
                            SELECT 1
                            FROM fund_alias fa_hit
                            WHERE fa_hit.fund_id = m.fund_id
                              AND (fa_hit.alias LIKE ? OR fa_hit.normalized_alias LIKE ?)
                        ) THEN 2
                        WHEN m.pinyin LIKE ? THEN 3
                        ELSE 4
                    END,
                    m.fund_id ASC
                LIMIT ?
                """,
                (
                    fuzzy,
                    fuzzy_normalized,
                    prefix,
                    fuzzy,
                    fuzzy_lower,
                    fuzzy_lower,
                    fuzzy,
                    fuzzy_normalized,
                    prefix,
                    fuzzy,
                    fuzzy,
                    fuzzy_normalized,
                    fuzzy_lower,
                    safe_limit,
                ),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT m.fund_id, m.name, m.pinyin, m.abbr, m.status,
                       c.notify_email_placeholder, c.notify_feishu_placeholder,
                       m.market_group, m.fund_type, m.bucket, m.tags_json,
                       (
                           SELECT GROUP_CONCAT(alias)
                           FROM fund_alias fa_all
                           WHERE fa_all.fund_id = m.fund_id
                       ) AS aliases_csv
                FROM fund_master m
                LEFT JOIN fund_catalog c ON c.fund_id = m.fund_id
                ORDER BY m.fund_id ASC
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
            "market_group": str(row["market_group"] or ""),
            "fund_type": str(row["fund_type"] or ""),
            "bucket": str(row["bucket"] or ""),
            "tags": _normalize_tags(json.loads(str(row["tags_json"] or "[]")) if str(row["tags_json"] or "").strip() else []),
            "aliases": _parse_alias_csv(row["aliases_csv"]),
            "alias_hits": _parse_alias_csv(row["alias_hits_csv"]) if "alias_hits_csv" in row.keys() else [],
        }
        for row in rows
    ]


def get_fund_catalog_item(fund_id: str) -> dict[str, Any] | None:
    clean_fund_id = _normalize_catalog_text(fund_id)
    if not clean_fund_id:
        return None

    with connect() as conn:
        row = conn.execute(
            """
            SELECT m.fund_id, m.name, m.pinyin, m.abbr, m.status,
                   c.notify_email_placeholder, c.notify_feishu_placeholder, m.updated_at,
                   m.market_group, m.fund_type, m.bucket, m.tags_json, m.source,
                   (
                       SELECT GROUP_CONCAT(alias)
                       FROM fund_alias fa_all
                       WHERE fa_all.fund_id = m.fund_id
                   ) AS aliases_csv
            FROM fund_master m
            LEFT JOIN fund_catalog c ON c.fund_id = m.fund_id
            WHERE m.fund_id = ?
            LIMIT 1
            """,
            (clean_fund_id,),
        ).fetchone()

    if not row:
        return None

    return {
        "fund_id": str(row["fund_id"]),
        "name": str(row["name"]),
        "pinyin": str(row["pinyin"] or ""),
        "abbr": str(row["abbr"] or ""),
        "status": str(row["status"] or "active"),
        "notify_email_placeholder": str(row["notify_email_placeholder"] or ""),
        "notify_feishu_placeholder": str(row["notify_feishu_placeholder"] or ""),
        "market_group": str(row["market_group"] or ""),
        "fund_type": str(row["fund_type"] or ""),
        "bucket": str(row["bucket"] or ""),
        "tags": _normalize_tags(json.loads(str(row["tags_json"] or "[]")) if str(row["tags_json"] or "").strip() else []),
        "aliases": _parse_alias_csv(row["aliases_csv"]),
        "source": str(row["source"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


def list_fund_catalog_ids(limit: int = 200, only_active: bool = True) -> list[str]:
    safe_limit = max(1, min(int(limit), 2000))
    with connect() as conn:
        if only_active:
            rows = conn.execute(
                """
                SELECT fund_id
                FROM fund_catalog
                WHERE status != 'disabled'
                ORDER BY fund_id ASC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT fund_id
                FROM fund_catalog
                ORDER BY fund_id ASC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
    return [str(row["fund_id"]) for row in rows if _normalize_catalog_text(row["fund_id"])]


def upsert_fund_nav_daily(
    fund_id: str,
    trade_date: str,
    estimate_nav: float | None,
    unit_nav: float | None,
    asof: str = "",
    source: str = "",
    confirm_state: str = "estimated",
) -> None:
    clean_fund_id = _normalize_catalog_text(fund_id)
    clean_trade_date = _normalize_catalog_text(trade_date)
    if not clean_fund_id or not clean_trade_date:
        return

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO fund_nav_daily (
                fund_id, trade_date, estimate_nav, unit_nav, asof, source, confirm_state, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fund_id, trade_date) DO UPDATE SET
                estimate_nav = excluded.estimate_nav,
                unit_nav = excluded.unit_nav,
                asof = excluded.asof,
                source = excluded.source,
                confirm_state = excluded.confirm_state,
                updated_at = excluded.updated_at
            """,
            (
                clean_fund_id,
                clean_trade_date,
                _to_float(estimate_nav),
                _to_float(unit_nav),
                str(asof or ""),
                str(source or ""),
                str(confirm_state or "estimated"),
                _now_iso(),
            ),
        )
        conn.commit()


def get_latest_fund_nav_daily(fund_id: str) -> dict[str, Any] | None:
    clean_fund_id = _normalize_catalog_text(fund_id)
    if not clean_fund_id:
        return None

    with connect() as conn:
        row = conn.execute(
            """
            SELECT fund_id, trade_date, estimate_nav, unit_nav, asof, source, confirm_state, updated_at
            FROM fund_nav_daily
            WHERE fund_id = ?
            ORDER BY trade_date DESC, asof DESC
            LIMIT 1
            """,
            (clean_fund_id,),
        ).fetchone()
    if not row:
        return None

    return {
        "fund_id": str(row["fund_id"]),
        "trade_date": str(row["trade_date"]),
        "estimate_nav": _to_float(row["estimate_nav"]),
        "unit_nav": _to_float(row["unit_nav"]),
        "asof": str(row["asof"] or ""),
        "source": str(row["source"] or ""),
        "confirm_state": str(row["confirm_state"] or "estimated"),
        "updated_at": str(row["updated_at"] or ""),
    }


def list_fund_nav_daily(
    fund_id: str,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 120,
) -> list[dict[str, Any]]:
    clean_fund_id = _normalize_catalog_text(fund_id)
    if not clean_fund_id:
        return []

    safe_limit = max(1, min(int(limit), 2000))
    clauses = ["fund_id = ?"]
    params: list[Any] = [clean_fund_id]

    from_text = _normalize_catalog_text(date_from or "")
    to_text = _normalize_catalog_text(date_to or "")
    if from_text:
        clauses.append("trade_date >= ?")
        params.append(from_text)
    if to_text:
        clauses.append("trade_date <= ?")
        params.append(to_text)
    params.append(safe_limit)

    where_sql = " AND ".join(clauses)
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT fund_id, trade_date, estimate_nav, unit_nav, asof, source, confirm_state, updated_at
            FROM fund_nav_daily
            WHERE {where_sql}
            ORDER BY trade_date DESC, asof DESC
            LIMIT ?
            """,
            params,
        ).fetchall()

    items = [
        {
            "fund_id": str(row["fund_id"]),
            "trade_date": str(row["trade_date"]),
            "estimate_nav": _to_float(row["estimate_nav"]),
            "unit_nav": _to_float(row["unit_nav"]),
            "asof": str(row["asof"] or ""),
            "source": str(row["source"] or ""),
            "confirm_state": str(row["confirm_state"] or "estimated"),
            "updated_at": str(row["updated_at"] or ""),
        }
        for row in rows
    ]
    return list(reversed(items))


def create_fund_source_job(job_type: str, requested_by: str, total_count: int) -> str:
    job_id = secrets.token_hex(12)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO fund_source_job (
                job_id, job_type, status, requested_by, started_at,
                finished_at, total_count, success_count, failed_count, error_summary
            ) VALUES (?, ?, 'running', ?, ?, '', ?, 0, 0, '')
            """,
            (
                job_id,
                str(job_type or "fund_sync"),
                str(requested_by or ""),
                _now_iso(),
                max(0, int(total_count)),
            ),
        )
        conn.commit()
    return job_id


def finish_fund_source_job(
    job_id: str,
    status: str,
    success_count: int,
    failed_count: int,
    error_summary: str = "",
) -> None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE fund_source_job
            SET status = ?, finished_at = ?, success_count = ?, failed_count = ?, error_summary = ?
            WHERE job_id = ?
            """,
            (
                str(status or "done"),
                _now_iso(),
                max(0, int(success_count)),
                max(0, int(failed_count)),
                str(error_summary or ""),
                str(job_id),
            ),
        )
        conn.commit()


def get_fund_source_job(job_id: str) -> dict[str, Any] | None:
    clean_job_id = _normalize_catalog_text(job_id)
    if not clean_job_id:
        return None

    with connect() as conn:
        row = conn.execute(
            """
            SELECT job_id, job_type, status, requested_by, started_at, finished_at,
                   total_count, success_count, failed_count, error_summary
            FROM fund_source_job
            WHERE job_id = ?
            LIMIT 1
            """,
            (clean_job_id,),
        ).fetchone()
    if not row:
        return None

    return {
        "job_id": str(row["job_id"]),
        "job_type": str(row["job_type"]),
        "status": str(row["status"]),
        "requested_by": str(row["requested_by"]),
        "started_at": str(row["started_at"] or ""),
        "finished_at": str(row["finished_at"] or ""),
        "total_count": int(row["total_count"] or 0),
        "success_count": int(row["success_count"] or 0),
        "failed_count": int(row["failed_count"] or 0),
        "error_summary": str(row["error_summary"] or ""),
    }


def get_latest_fund_source_job(job_type: str | None = None) -> dict[str, Any] | None:
    clean_type = _normalize_catalog_text(job_type or "")
    with connect() as conn:
        if clean_type:
            row = conn.execute(
                """
                SELECT job_id, job_type, status, requested_by, started_at, finished_at,
                       total_count, success_count, failed_count, error_summary
                FROM fund_source_job
                WHERE job_type = ?
                ORDER BY COALESCE(NULLIF(finished_at, ''), started_at) DESC, started_at DESC
                LIMIT 1
                """,
                (clean_type,),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT job_id, job_type, status, requested_by, started_at, finished_at,
                       total_count, success_count, failed_count, error_summary
                FROM fund_source_job
                ORDER BY COALESCE(NULLIF(finished_at, ''), started_at) DESC, started_at DESC
                LIMIT 1
                """
            ).fetchone()

    if not row:
        return None

    return {
        "job_id": str(row["job_id"]),
        "job_type": str(row["job_type"]),
        "status": str(row["status"]),
        "requested_by": str(row["requested_by"]),
        "started_at": str(row["started_at"] or ""),
        "finished_at": str(row["finished_at"] or ""),
        "total_count": int(row["total_count"] or 0),
        "success_count": int(row["success_count"] or 0),
        "failed_count": int(row["failed_count"] or 0),
        "error_summary": str(row["error_summary"] or ""),
    }


def get_system_status_snapshot(holdings_user_id: str, snapshot_user_id: str) -> dict[str, Any]:
    snapshot_payload = get_latest_estimate_snapshot(snapshot_user_id)
    if isinstance(snapshot_payload, dict):
        estimate_status = {
            "available": True,
            "asof": str(snapshot_payload.get("asof") or snapshot_payload.get("as_of") or ""),
            "updated_at": str(snapshot_payload.get("updated_at") or ""),
            "confirm_state": str(snapshot_payload.get("confirm_state") or ""),
        }
    else:
        estimate_status = {
            "available": False,
            "asof": "",
            "updated_at": "",
            "confirm_state": "",
        }

    with connect() as conn:
        catalog_row = conn.execute(
            "SELECT COUNT(1) AS c FROM fund_catalog WHERE status != 'disabled'"
        ).fetchone()
        nav_row = conn.execute("SELECT COUNT(1) AS c FROM fund_nav_daily").fetchone()
        latest_nav_row = conn.execute(
            """
            SELECT fund_id, trade_date, asof, source, confirm_state, updated_at
            FROM fund_nav_daily
            ORDER BY trade_date DESC, asof DESC
            LIMIT 1
            """
        ).fetchone()
        last_action_row = conn.execute(
            """
            SELECT date, action_key, occurred_at, ts
            FROM actions_log
            WHERE user_id = ?
            ORDER BY COALESCE(NULLIF(occurred_at, ''), ts) DESC, ts DESC
            LIMIT 1
            """,
            (str(holdings_user_id or "legacy"),),
        ).fetchone()
        last_sync_pending_row = conn.execute(
            """
            SELECT MAX(updated_at) AS last_run_at
            FROM fund_transactions
            WHERE user_id = ? AND source LIKE '%sync_pending%'
            """,
            (str(holdings_user_id or "legacy"),),
        ).fetchone()
        sync_stats_row = conn.execute(
            """
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
                SUM(CASE WHEN source LIKE '%sync_pending%' THEN 1 ELSE 0 END) AS synced_total,
                COUNT(DISTINCT CASE WHEN source LIKE '%sync_pending%' THEN fund_id END) AS synced_fund_count,
                MAX(NULLIF(confirmed_at, '')) AS latest_confirmed_at
            FROM fund_transactions
            WHERE user_id = ?
            """,
            (str(holdings_user_id or "legacy"),),
        ).fetchone()

    latest_nav = None
    if latest_nav_row:
        latest_nav = {
            "fund_id": str(latest_nav_row["fund_id"] or ""),
            "trade_date": str(latest_nav_row["trade_date"] or ""),
            "asof": str(latest_nav_row["asof"] or ""),
            "source": str(latest_nav_row["source"] or ""),
            "confirm_state": str(latest_nav_row["confirm_state"] or ""),
            "updated_at": str(latest_nav_row["updated_at"] or ""),
        }

    latest_action = None
    if last_action_row:
        latest_action = {
            "date": str(last_action_row["date"] or ""),
            "action_key": str(last_action_row["action_key"] or ""),
            "occurred_at": str(last_action_row["occurred_at"] or last_action_row["ts"] or ""),
        }

    return {
        "estimate_snapshot": estimate_status,
        "fund_catalog": {
            "active_count": int(catalog_row["c"] or 0) if catalog_row else 0,
        },
        "fund_nav_daily": {
            "record_count": int(nav_row["c"] or 0) if nav_row else 0,
            "latest": latest_nav,
        },
        "fund_sync_job": get_latest_fund_source_job("fund_sync"),
        "actions_log": {
            "latest": latest_action,
        },
        "transactions_sync_pending": {
            "available": True,
            "last_run_at": (
                str(last_sync_pending_row["last_run_at"] or "")
                if last_sync_pending_row and str(last_sync_pending_row["last_run_at"] or "").strip()
                else None
            ),
            "pending_count_current": int(sync_stats_row["pending_count"] or 0) if sync_stats_row else 0,
            "confirmed_count_current": int(sync_stats_row["confirmed_count"] or 0) if sync_stats_row else 0,
            "synced_total": int(sync_stats_row["synced_total"] or 0) if sync_stats_row else 0,
            "synced_fund_count": int(sync_stats_row["synced_fund_count"] or 0) if sync_stats_row else 0,
            "latest_confirmed_at": (
                str(sync_stats_row["latest_confirmed_at"] or "")
                if sync_stats_row and str(sync_stats_row["latest_confirmed_at"] or "").strip()
                else None
            ),
            "note": "sync_pending 对账任务可用（含当前 pending/confirmed 统计）",
        },
    }


def list_fund_nav_history_from_snapshots(
    user_id: str,
    fund_id: str,
    limit: int = 240,
) -> list[dict[str, Any]]:
    clean_fund_id = _normalize_catalog_text(fund_id)
    if not clean_fund_id:
        return []

    snapshots = list_estimate_snapshots(user_id, limit=max(1, min(int(limit), 2000)))
    by_trade_date: dict[str, dict[str, Any]] = {}

    for snapshot in snapshots:
        payload = snapshot.get("payload")
        if not isinstance(payload, dict):
            continue

        asof = str(payload.get("as_of") or payload.get("asof") or snapshot.get("asof") or "").strip()
        if not asof:
            continue
        trade_date = asof[:10]
        if len(trade_date) != 10:
            continue

        funds = payload.get("funds", [])
        if not isinstance(funds, list):
            continue

        target_row = None
        for item in funds:
            if not isinstance(item, dict):
                continue
            if _normalize_catalog_text(item.get("fund_id")) == clean_fund_id:
                target_row = item
                break

        if not isinstance(target_row, dict):
            continue

        estimate_nav = _to_float(target_row.get("estimate_nav"))
        unit_nav = _to_float(target_row.get("unit_nav"))
        if unit_nav is None:
            unit_nav = _to_float(target_row.get("nav"))

        if estimate_nav is None and unit_nav is None:
            continue

        row = {
            "fund_id": clean_fund_id,
            "trade_date": trade_date,
            "estimate_nav": estimate_nav,
            "unit_nav": unit_nav,
            "asof": asof,
            "source": str(target_row.get("source") or "snapshot"),
            "confirm_state": str(target_row.get("confirm_state") or payload.get("confirm_state") or "estimated"),
        }

        existing = by_trade_date.get(trade_date)
        if not existing or str(existing.get("asof", "")) <= asof:
            by_trade_date[trade_date] = row

    return sorted(by_trade_date.values(), key=lambda item: str(item.get("trade_date", "")))


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
