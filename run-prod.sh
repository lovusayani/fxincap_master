#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ENV_FILE="${BASE_DIR}/.deploy.env"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Missing required command: pm2"
  exit 1
fi

mkdir -p "${BASE_DIR}/logs"

cd "${BASE_DIR}"

if [ -f "${DEPLOY_ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${DEPLOY_ENV_FILE}"
fi

pm2 delete fxincap-app fxincap-admin fxincap-api fxincap-trade fxincap-ws >/dev/null 2>&1 || true

NODE_ENV=production PORT=4000 pm2 start pnpm --name fxincap-app --cwd "${BASE_DIR}/fxincap" -- start
NODE_ENV=production PORT=5001 pm2 start pnpm --name fxincap-admin --cwd "${BASE_DIR}/fxincapadmin" -- run start
NODE_ENV=production PORT=7000 pm2 start node --name fxincap-api --cwd "${BASE_DIR}/fxincapapi" -- dist/index.js
NODE_ENV=production PORT=3000 pm2 start node --name fxincap-trade --cwd "${BASE_DIR}/fxincaptrade" -- dist/server/start.js
NODE_ENV=production WS_PORT=4040 pm2 start node --name fxincap-ws --cwd "${BASE_DIR}/fxincapws" -- src/server.js
if [ -z "${DEPLOY_WEBHOOK_SECRET:-}" ]; then
  echo "Missing DEPLOY_WEBHOOK_SECRET (set it in ${DEPLOY_ENV_FILE})"
  exit 1
fi
if pm2 describe fxincap-deploy-webhook >/dev/null 2>&1; then
  NODE_ENV=production DEPLOY_PORT=9010 DEPLOY_PATH=/hooks/deploy DEPLOY_BRANCH="${DEPLOY_BRANCH:-dev}" DEPLOY_SCRIPT="${BASE_DIR}/deploy-prod.sh" DEPLOY_WEBHOOK_SECRET="${DEPLOY_WEBHOOK_SECRET:-}" pm2 restart fxincap-deploy-webhook --update-env
else
  NODE_ENV=production DEPLOY_PORT=9010 DEPLOY_PATH=/hooks/deploy DEPLOY_BRANCH="${DEPLOY_BRANCH:-dev}" DEPLOY_SCRIPT="${BASE_DIR}/deploy-prod.sh" DEPLOY_WEBHOOK_SECRET="${DEPLOY_WEBHOOK_SECRET:-}" pm2 start node --name fxincap-deploy-webhook --cwd "${BASE_DIR}" -- deploy/webhook-server.cjs
fi

pm2 save
pm2 status

echo "Production apps started"
