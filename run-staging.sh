#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Missing required command: pm2"
  exit 1
fi

mkdir -p "${BASE_DIR}/logs"

cd "${BASE_DIR}"
pm2 startOrReload ecosystem.staging.portable.cjs --env staging --update-env
pm2 save
pm2 status

echo "Staging apps started"