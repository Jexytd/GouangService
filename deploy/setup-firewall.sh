#!/usr/bin/env bash
# ==============================================================================
# Firewall Setup Script (UFW) - Ricoh Shield Headless API
# Usage: sudo ./deploy/setup-firewall.sh [SSH_PORT]
# ==============================================================================
set -euo pipefail

# Ensure running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run as root (or with sudo)."
    exit 1
fi

SSH_PORT="${1:-9017}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[INFO] Setting up UFW Firewall for Ricoh Shield VPS...${NC}"

# Detect active SSH port from sshd_config or current connection
DETECTED_SSH_PORT=$(ss -tulpn 2>/dev/null | grep -E 'sshd' | awk '{print $5}' | awk -F':' '{print $NF}' | head -n 1 || echo "")
if [ -n "${DETECTED_SSH_PORT}" ] && [ "${DETECTED_SSH_PORT}" != "${SSH_PORT}" ]; then
    echo -e "${YELLOW}[WARN] Active SSH daemon appears to listen on port ${DETECTED_SSH_PORT} as well.${NC}"
    echo -e "${BLUE}[INFO] Opening detected SSH port ${DETECTED_SSH_PORT} for safety.${NC}"
    ufw allow "${DETECTED_SSH_PORT}/tcp" comment "Active SSH Port" || true
fi

# 1. ALWAYS allow custom SSH port FIRST to prevent lockout
echo -e "${BLUE}[INFO] Allowing SSH on port ${SSH_PORT}/tcp...${NC}"
ufw allow "${SSH_PORT}/tcp" comment "Custom SSH Port"

# 2. Allow fallback SSH port 22 just in case
ufw allow 22/tcp comment "Standard SSH fallback"

# 3. Explicitly DENY public inbound to Node.js API port 3000
echo -e "${BLUE}[INFO] Denying public access to port 3000 (API is strictly Cloudflare Tunnel only)...${NC}"
ufw deny 3000/tcp comment "Block public API port (127.0.0.1 loopback only)"

# 4. Set default policies
ufw default deny incoming
ufw default allow outgoing

# 5. Enable UFW non-interactively
echo -e "${BLUE}[INFO] Enabling UFW...${NC}"
ufw --force enable

echo -e "${GREEN}[SUCCESS] Firewall configured successfully! Current status:${NC}"
ufw status verbose
