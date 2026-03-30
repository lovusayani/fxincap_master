#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Using staging repo at: ${BASE_DIR}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd node
require_cmd pnpm

mkdir -p "${BASE_DIR}/logs"
mkdir -p "${BASE_DIR}/fxincapapi/uploads/deposit-screenshots"
mkdir -p "${BASE_DIR}/fxincapapi/uploads/kyc-documents"
mkdir -p "${BASE_DIR}/fxincapapi/uploads/profile-pictures"
mkdir -p "${BASE_DIR}/fxincaptrade/uploads/profile-pictures"

echo "Installing fxincap"
(cd "${BASE_DIR}/fxincap" && pnpm install --frozen-lockfile)

echo "Installing fxincapadmin"
(cd "${BASE_DIR}/fxincapadmin" && pnpm install --frozen-lockfile)

echo "Installing fxincapapi"
(cd "${BASE_DIR}/fxincapapi" && pnpm install --frozen-lockfile)

echo "Installing fxincaptrade"
(cd "${BASE_DIR}/fxincaptrade" && pnpm install --frozen-lockfile)

echo "Installing fxincapws"
(cd "${BASE_DIR}/fxincapws" && pnpm install --frozen-lockfile)

echo "Building fxincap"
(cd "${BASE_DIR}/fxincap" && pnpm build)

echo "Building fxincapadmin"
(cd "${BASE_DIR}/fxincapadmin" && pnpm build)

echo "Building fxincapapi"
(cd "${BASE_DIR}/fxincapapi" && pnpm build)

echo "Building fxincaptrade"
(cd "${BASE_DIR}/fxincaptrade" && pnpm build)

echo "fxincapws has no build step"

echo "Staging installation completed"