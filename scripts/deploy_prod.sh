#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${VC_ENV_FILE:-$ROOT_DIR/deploy/.env.prod}"
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.prod.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Create it first: cp deploy/.env.example deploy/.env.prod" >&2
  exit 1
fi

mkdir -p \
  "$ROOT_DIR/deploy/data/backend" \
  "$ROOT_DIR/deploy/data/frontend-dist" \
  "$ROOT_DIR/deploy/certbot/conf" \
  "$ROOT_DIR/deploy/certbot/www"

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

"$PYTHON_BIN" "$ROOT_DIR/scripts/render_nginx_site.py" \
  --env-file "$ENV_FILE" \
  --output "$ROOT_DIR/deploy/nginx/site.rendered.conf"

set -a
. "$ENV_FILE"
set +a

if [[ "${VC_ENABLE_TLS:-false}" =~ ^(1|true|yes|on)$ ]]; then
  if [ -z "${VC_DOMAIN:-}" ]; then
    echo "VC_ENABLE_TLS=true 时必须配置 VC_DOMAIN" >&2
    exit 1
  fi
  if [ ! -f "$ROOT_DIR/deploy/certbot/conf/live/${VC_DOMAIN}/fullchain.pem" ] || [ ! -f "$ROOT_DIR/deploy/certbot/conf/live/${VC_DOMAIN}/privkey.pem" ]; then
    echo "缺少 TLS 证书，请先为 ${VC_DOMAIN} 准备 Let's Encrypt 证书。" >&2
    exit 1
  fi
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build
