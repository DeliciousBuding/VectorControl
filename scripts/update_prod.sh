#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "[1/4] 切换到 main 并拉取最新代码..."
git checkout main
git pull --ff-only origin main

echo "[2/4] 执行生产更新部署..."
bash "${ROOT_DIR}/scripts/deploy_prod.sh"

echo "[3/4] 再次执行 Gate-D 验收..."
set -a
source "${ROOT_DIR}/deploy/.env.prod"
set +a

PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi
VC_DOMAIN="${VC_DOMAIN}" VC_SCHEME="${VC_SCHEME:-https}" "${PYTHON_BIN}" "${ROOT_DIR}/scripts/check_gate_d.py"

echo "[4/4] 生产更新完成。"