#!/usr/bin/env bash
# Run ON THE SERVER once, from the monorepo root (same folder as deploy-prod.sh).
# Cannot be executed from this assistant's environment — you SSH in and run it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

EXAMPLE="${ROOT}/.deploy.env.example"
TARGET="${ROOT}/.deploy.env"

if [ ! -f "${EXAMPLE}" ]; then
  echo "Missing ${EXAMPLE}; pull the latest repo first."
  exit 1
fi

if [ -f "${TARGET}" ]; then
  echo "[ok] ${TARGET} already exists (not overwriting)."
  echo "     Edit it if needed: DEPLOY_WEBHOOK_SECRET, DEPLOY_BRANCH, VITE_API_URL"
  exit 0
fi

cp "${EXAMPLE}" "${TARGET}"
chmod 600 "${TARGET}"
echo "[created] ${TARGET}"
echo ""
echo "NEXT (required): edit this file and set:"
echo "  - DEPLOY_WEBHOOK_SECRET  (must match GitHub repo → Webhooks → secret)"
echo "  - DEPLOY_BRANCH        (branch this server deploys, e.g. dev or main)"
echo "  - VITE_API_URL         (e.g. https://api.fxincap.com — no trailing slash)"
echo ""
echo "Then:  bash ${ROOT}/run-prod.sh"
echo "GitHub: use the EXISTING webhook https://fxincap.com/hooks/deploy — ensure DEPLOY_WEBHOOK_SECRET matches; do not add a second webhook."
