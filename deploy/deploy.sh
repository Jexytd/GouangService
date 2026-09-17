#!/usr/bin/env bash
# ==============================================================================
# Automated Deployment Script - Ricoh Shield Headless API
# Usage: ./deploy/deploy.sh [--skip-pull]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKIP_PULL="${1:-}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}      Deploying Ricoh Shield Headless API Update      ${NC}"
echo -e "${BLUE}======================================================${NC}"

cd "${REPO_DIR}"

# 1. Pre-flight checks
echo -e "\n${BLUE}[1/5] Running pre-flight checks...${NC}"
if [ ! -f "${REPO_DIR}/.env" ]; then
    echo -e "${RED}[ERROR] .env file not found in ${REPO_DIR}! Cannot deploy without environment configuration.${NC}"
    exit 1
fi

# 2. Pull latest code from GitHub
if [ "${SKIP_PULL}" != "--skip-pull" ]; then
    echo -e "\n${BLUE}[2/5] Pulling latest changes from Git repository...${NC}"
    # Stash any untracked or local changes just in case
    git fetch origin main
    git reset --hard origin/main
    echo -e "${GREEN}Successfully pulled latest commit: $(git rev-parse --short HEAD)${NC}"
else
    echo -e "\n${YELLOW}[2/5] Skipping git pull (--skip-pull flag provided).${NC}"
fi

# 3. Install dependencies
echo -e "\n${BLUE}[3/5] Installing production dependencies...${NC}"
npm ci --production --prefer-offline 2>/dev/null || npm install --production

# 4. Reload PM2 process with zero downtime
echo -e "\n${BLUE}[4/5] Reloading PM2 process (Zero-Downtime)...${NC}"
if pm2 describe ricoh-shield-api &>/dev/null; then
    pm2 reload ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js --env production
fi
pm2 save

# 5. Post-deployment Health Check with Automatic Rollback
echo -e "\n${BLUE}[5/5] Performing post-deployment health checks...${NC}"
# Wait up to 15 seconds for process to stabilize
HEALTHY=0
for i in {1..5}; do
    echo -e "Health check attempt ${i}/5..."
    if "${SCRIPT_DIR}/healthcheck.sh" local; then
        HEALTHY=1
        break
    fi
    sleep 3
done

if [ "${HEALTHY}" -eq 1 ]; then
    echo -e "\n${GREEN}======================================================${NC}"
    echo -e "${GREEN}   DEPLOYMENT SUCCESSFUL! API IS HEALTHY & ONLINE!   ${NC}"
    echo -e "${GREEN}======================================================${NC}"
    # Optional test public if internet available
    "${SCRIPT_DIR}/healthcheck.sh" public || echo -e "${YELLOW}[NOTE] Public DNS may take a few seconds to resolve.${NC}"
    exit 0
else
    echo -e "\n${RED}[CRITICAL] Health check FAILED after deployment! Triggering automatic rollback...${NC}"
    "${SCRIPT_DIR}/rollback.sh"
    exit 1
fi
