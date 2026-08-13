#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEPLOY_ENV_FILE="${BASE_DIR}/.deploy.env"
if [ -f "${DEPLOY_ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${DEPLOY_ENV_FILE}"
  set +a
fi

BRANCH="${DEPLOY_BRANCH:-dev}"

echo "[deploy] repo: ${BASE_DIR}"
echo "[deploy] branch: ${BRANCH}"

if ! command -v git >/dev/null 2>&1; then
  echo "Missing required command: git"
  exit 1
fi

if ! command -v bash >/dev/null 2>&1; then
  echo "Missing required command: bash"
  exit 1
fi

cd "${BASE_DIR}"

if [ -d "${BASE_DIR}/.git" ]; then
  echo "[deploy] fetching latest"
  git fetch --prune origin

  echo "[deploy] resetting working tree to origin/${BRANCH}"
  git reset --hard "origin/${BRANCH}"
else
  echo "[deploy] ERROR: no .git in ${BASE_DIR}"
  echo "        Push-to-live requires a git clone of your GitHub repo at this path."
  echo "        One-time fix: see DEPLOYMENT.md section \"Push-to-live (git clone on server)\"."
  if [ "${DEPLOY_ALLOW_NO_GIT:-0}" = "1" ]; then
    echo "[deploy] DEPLOY_ALLOW_NO_GIT=1 — continuing with rebuild/restart only (code will NOT update from GitHub)."
  else
    exit 1
  fi
fi

echo "[deploy] install + build"
bash "${BASE_DIR}/install-prod.sh"

echo "[deploy] pm2 reload"
bash "${BASE_DIR}/run-prod.sh"

echo "[deploy] done"
