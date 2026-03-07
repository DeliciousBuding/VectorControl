#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${VC_BACKUP_DIR:-$ROOT_DIR/deploy/backups}"
DB_PATH="$ROOT_DIR/deploy/data/backend/app.db"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/app-$TIMESTAMP.db"
TMP_SQLITE="${TMPDIR:-/tmp}/vectorcontrol-backup-$TIMESTAMP.db"
trap 'rm -f "$TMP_SQLITE"' EXIT

if [ ! -f "$DB_PATH" ]; then
  echo "SQLite database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
python3 - "$DB_PATH" "$TMP_SQLITE" <<'PY'
import sqlite3
import sys

source, target = sys.argv[1], sys.argv[2]
source_conn = sqlite3.connect(source)
target_conn = sqlite3.connect(target)
with target_conn:
    source_conn.backup(target_conn)
source_conn.close()
target_conn.close()
PY
mv "$TMP_SQLITE" "$TARGET"

echo "$TARGET"
