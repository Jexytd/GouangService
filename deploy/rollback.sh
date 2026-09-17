#!/usr/bin/env bash
# ==============================================================================
# Automated Rollback Script - Ricoh Shield Headless API
# Usage: ./deploy/rollback.sh [commit_hash]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_COMMIT="${1:-HEAD@{1}}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}[ALERT] Initiating automated rollback for Ricoh Shield API...${NC}"
cd "${REPO_DIR}"

CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo -e "${BLUE}[INFO] Current commit: ${CURRENT_COMMIT}${NC}"
echo -e "${BLUE}[INFO] Rolling back to: ${TARGET_COMMIT}${NC}"

# 1. Revert Git repository
git reset --hard "${TARGET_COMMIT}"

# 2. Re-install exact dependencies of that commit
echo -e "${BLUE}[INFO] Re-installing dependencies for rolled-back version...${NC}"
npm ci --production --prefer-offline 2>/dev/null || npm install --production

# 3. Reload PM2
echo -e "${BLUE}[INFO] Reloading PM2 process...${NC}"
pm2 reload ecosystem.config.js --env production || pm2 restart ecosystem.config.js --env production

# 4. Verification
echo -e "${BLUE}[INFO] Verifying local health after rollback...${NC}"
sleep 2
if "${SCRIPT_DIR}/healthcheck.sh" local; then
    echo -e "${GREEN}[SUCCESS] Rollback completed and verified! Service is back online at commit $(git rev-parse --short HEAD).${NC}"
    exit 0
else
    echo -e "${RED}[FATAL] Service failed healthcheck even after rollback! Check PM2 logs:${NC}"
    pm2 logs ricoh-shield-api --lines 20 --nostream
    exit 1
fi
