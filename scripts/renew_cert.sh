#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
ENV_FILE="${DEPLOY_DIR}/.env.prod"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[FAIL] 未找到 ${ENV_FILE}"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${VC_DOMAIN:-}" || -z "${VC_EMAIL:-}" ]]; then
  echo "[FAIL] VC_DOMAIN 或 VC_EMAIL 未配置。"
  exit 1
fi

echo "[1/3] 停止 Nginx 释放 80/443 ..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop nginx

echo "[2/3] 执行 certbot 续期 ..."
docker run --rm \
  -p 80:80 \
  -v "${DEPLOY_DIR}/certbot/conf:/etc/letsencrypt" \
  -v "${DEPLOY_DIR}/certbot/www:/var/www/certbot" \
  certbot/certbot renew --standalone

echo "[3/3] 重启 Nginx ..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d nginx

echo "[PASS] 证书续期流程完成。"
