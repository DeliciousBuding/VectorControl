#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
BACKUP_DIR="${DEPLOY_DIR}/backups"
SQLITE_FILE="${DEPLOY_DIR}/data/backend/app.db"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${SQLITE_FILE}" ]]; then
  echo "[FAIL] 未找到 SQLite 数据库文件：${SQLITE_FILE}"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/app-${STAMP}.db"

cp "${SQLITE_FILE}" "${TARGET}"
gzip -f "${TARGET}"

find "${BACKUP_DIR}" -type f -name "app-*.db.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "[PASS] 备份完成：${TARGET}.gz"
