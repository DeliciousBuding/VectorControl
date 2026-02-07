#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
ENV_FILE="${DEPLOY_DIR}/.env.prod"

if ! command -v docker >/dev/null 2>&1; then
  echo "[FAIL] 未检测到 docker，请先安装 Docker 与 Docker Compose。"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${DEPLOY_DIR}/.env.example" "${ENV_FILE}"
  echo "[INFO] 已生成 ${ENV_FILE}，请先补充 VC_DOMAIN/VC_EMAIL/API_TOKEN 后重试。"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${VC_DOMAIN:-}" || -z "${VC_EMAIL:-}" ]]; then
  echo "[FAIL] VC_DOMAIN 或 VC_EMAIL 未配置。"
  exit 1
fi

VC_ENABLE_TLS="${VC_ENABLE_TLS:-true}"
VC_ENABLE_TLS="$(echo "${VC_ENABLE_TLS}" | tr '[:upper:]' '[:lower:]')"
VC_SCHEME="${VC_SCHEME:-https}"
VC_SCHEME="$(echo "${VC_SCHEME}" | tr '[:upper:]' '[:lower:]')"

if [[ "${VC_ENABLE_TLS}" == "true" ]]; then
  VC_SCHEME="https"
else
  VC_SCHEME="http"
fi

mkdir -p "${DEPLOY_DIR}/certbot/conf" \
  "${DEPLOY_DIR}/certbot/www" \
  "${DEPLOY_DIR}/data/backend" \
  "${DEPLOY_DIR}/data/postgres" \
  "${DEPLOY_DIR}/data/frontend-dist" \
  "${DEPLOY_DIR}/backups"

if [[ "${VC_ENABLE_TLS}" == "true" ]]; then
  sed "s|__VC_DOMAIN__|${VC_DOMAIN}|g" \
    "${DEPLOY_DIR}/nginx/site.conf" > "${DEPLOY_DIR}/nginx/site.rendered.conf"
else
  sed "s|__VC_DOMAIN__|${VC_DOMAIN}|g" \
    "${DEPLOY_DIR}/nginx/site.http.conf" > "${DEPLOY_DIR}/nginx/site.rendered.conf"
fi

echo "[1/5] 构建前端静态资源..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm frontend-build

if [[ "${VC_ENABLE_TLS}" == "true" ]]; then
  echo "[2/5] 签发或复用 HTTPS 证书..."
  if [[ ! -f "${DEPLOY_DIR}/certbot/conf/live/${VC_DOMAIN}/fullchain.pem" ]]; then
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" down nginx >/dev/null 2>&1 || true
    docker run --rm \
      -p 80:80 \
      -v "${DEPLOY_DIR}/certbot/conf:/etc/letsencrypt" \
      -v "${DEPLOY_DIR}/certbot/www:/var/www/certbot" \
      certbot/certbot certonly --standalone \
      --non-interactive --agree-tos --no-eff-email \
      -m "${VC_EMAIL}" -d "${VC_DOMAIN}"
  else
    echo "[INFO] 已存在证书，跳过首次签发。"
  fi
else
  echo "[2/5] 跳过证书签发（VC_ENABLE_TLS=false，HTTP 最小闭环模式）。"
fi

echo "[3/5] 拉起生产容器..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d postgres backend nginx

echo "[4/5] 基础状态检查..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo "[5/5] 执行 Gate-D 验收..."
PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi
VC_DOMAIN="${VC_DOMAIN}" VC_SCHEME="${VC_SCHEME}" "${PYTHON_BIN}" "${ROOT_DIR}/scripts/check_gate_d.py"

echo "[PASS] 生产部署完成。"
