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

mkdir -p "$ROOT_DIR/deploy/data/backend" "$ROOT_DIR/deploy/data/frontend-dist"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build
