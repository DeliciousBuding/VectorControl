#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

echo "[1/4] 切换到 dev 并拉取最新代码..."
git checkout dev
git pull --ff-only origin dev

echo "[2/4] 执行生产更新部署..."
bash "${ROOT_DIR}/scripts/deploy_prod.sh"

echo "[3/4] 再次执行 Gate-D 验收..."
set -a
source "${ROOT_DIR}/deploy/.env.prod"
set +a
VC_DOMAIN="${VC_DOMAIN}" python3 "${ROOT_DIR}/scripts/check_gate_d.py"

echo "[4/4] 更新完成。"
