#!/usr/bin/env bash
# ==============================================================================
# Master VPS Bootstrap Script - Ricoh Shield Headless API
# Supports: Ubuntu 20.04 / 22.04 / 24.04 LTS
# Usage: sudo ./deploy/bootstrap.sh
# ==============================================================================
set -euo pipefail

# Ensure running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This bootstrap script must be run as root (or with sudo)."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}     Ricoh Shield Headless API - Automated VPS Bootstrapper     ${NC}"
echo -e "${CYAN}================================================================${NC}"

# Detect current non-root user (for PM2 and file permissions)
TARGET_USER="${SUDO_USER:-ubuntu}"
if ! id "${TARGET_USER}" &>/dev/null; then
    TARGET_USER="root"
fi
echo -e "${BLUE}[INFO] Running provisioning for target user: ${TARGET_USER}${NC}"

# ------------------------------------------------------------------------------
# STEP 1: System Package Update & Core Tooling
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[1/8] Updating package repository and installing prerequisites...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl wget git tar jq openssl ufw ca-certificates gnupg lsb-release

# ------------------------------------------------------------------------------
# STEP 2: Node.js 20 LTS Installation (NodeSource)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/8] Checking Node.js runtime...${NC}"
NEED_NODE=1
if command -v node &>/dev/null; then
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "${NODE_VER}" -ge 18 ]; then
        echo -e "${GREEN}Node.js $(node -v) is already installed.${NC}"
        NEED_NODE=0
    fi
fi

if [ "${NEED_NODE}" -eq 1 ]; then
    echo -e "${BLUE}Installing Node.js 20 LTS from NodeSource...${NC}"
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update -y
    apt-get install -y nodejs
    echo -e "${GREEN}Installed Node.js: $(node -v) and npm: $(npm -v)${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 3: PM2 Process Manager Installation
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/8] Checking PM2 process supervisor...${NC}"
if ! command -v pm2 &>/dev/null; then
    echo -e "${BLUE}Installing PM2 globally...${NC}"
    npm install -g pm2
    echo -e "${GREEN}PM2 $(pm2 -v) installed.${NC}"
else
    echo -e "${GREEN}PM2 $(pm2 -v) is already installed.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 4: Cloudflared Daemon Installation
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/8] Installing / Verifying Cloudflare Tunnel (cloudflared)...${NC}"
if ! command -v cloudflared &>/dev/null; then
    echo -e "${BLUE}Downloading official cloudflared Linux package...${NC}"
    ARCH=$(dpkg --print-architecture)
    curl -L --output /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
    dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
    rm -f /tmp/cloudflared.deb
    echo -e "${GREEN}Cloudflared $(cloudflared --version) installed successfully.${NC}"
else
    echo -e "${GREEN}Cloudflared $(cloudflared --version) is already installed.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 5: Environment Variables & Secrets Configuration (.env)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/8] Configuring application environment secrets (.env)...${NC}"
if [ ! -f "${REPO_DIR}/.env" ]; then
    echo -e "${YELLOW}File .env not found. Setting up production secrets interactively...${NC}"
    
    # Prompt user for secrets
    read -r -p "Enter Dashboard Admin Password: " INPUT_PASS
    INPUT_PASS="${INPUT_PASS:-bosridho67}"

    read -r -p "Enter Server Secret Salt: " INPUT_SECRET
    INPUT_SECRET="${INPUT_SECRET:-ricoh-chuko-lito-secret-salt-2026}"

    read -r -p "Enter Discord Bot Token (leave empty if not using bot): " INPUT_DISCORD_TOKEN
    INPUT_DISCORD_TOKEN="${INPUT_DISCORD_TOKEN:-}"

    read -r -p "Enter Cloudflare Tunnel ID [51f06a50-5435-427a-aa8f-6fb311146a37]: " INPUT_TUNNEL_ID
    INPUT_TUNNEL_ID="${INPUT_TUNNEL_ID:-51f06a50-5435-427a-aa8f-6fb311146a37}"

    cat <<EOF > "${REPO_DIR}/.env"
NODE_ENV=production
PORT=3000
DASHBOARD_PASSWORD=${INPUT_PASS}
SERVER_SECRET=${INPUT_SECRET}
CORS_ORIGIN=*
DISCORD_TOKEN=${INPUT_DISCORD_TOKEN}
DATABASE_FILE_PATH=./Database/whitelist.json
CLOUDFLARE_TUNNEL_ID=${INPUT_TUNNEL_ID}
CLOUDFLARE_HOSTNAME=api.tamammrbeast.my.id
EOF
    echo -e "${GREEN}Created ${REPO_DIR}/.env with secure parameters.${NC}"
else
    echo -e "${GREEN}Existing .env configuration found. Keeping current secrets.${NC}"
fi

# Enforce secure file permissions
chmod 600 "${REPO_DIR}/.env"
if [ "${TARGET_USER}" != "root" ]; then
    chown "${TARGET_USER}:${TARGET_USER}" "${REPO_DIR}/.env"
fi

# ------------------------------------------------------------------------------
# STEP 6: Cloudflare Tunnel & Systemd Setup
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[6/8] Configuring Cloudflare Tunnel & Systemd Service...${NC}"
mkdir -p /etc/cloudflared
chmod 700 /etc/cloudflared

# Extract TUNNEL_ID from .env
TUNNEL_ID=$(grep -E '^CLOUDFLARE_TUNNEL_ID=' "${REPO_DIR}/.env" | cut -d'=' -f2 || echo "51f06a50-5435-427a-aa8f-6fb311146a37")

# Generate /etc/cloudflared/ricoh-api.yml
cat <<EOF > /etc/cloudflared/ricoh-api.yml
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: api.tamammrbeast.my.id
    service: http://127.0.0.1:3000
    originRequest:
      connectTimeout: 15s
      noTLSVerify: false
      tcpKeepAlive: 30s
      keepAliveConnections: 100
      keepAliveTimeout: 1m30s
  - service: http_status:404
EOF
chmod 600 /etc/cloudflared/ricoh-api.yml
echo -e "${GREEN}Configured /etc/cloudflared/ricoh-api.yml for tunnel ID ${TUNNEL_ID}.${NC}"

# Check for credentials JSON
CRED_FOUND=0
if [ -f "/etc/cloudflared/${TUNNEL_ID}.json" ]; then
    CRED_FOUND=1
    chmod 600 "/etc/cloudflared/${TUNNEL_ID}.json"
elif [ -f "/home/${TARGET_USER}/.cloudflared/${TUNNEL_ID}.json" ]; then
    cp "/home/${TARGET_USER}/.cloudflared/${TUNNEL_ID}.json" "/etc/cloudflared/${TUNNEL_ID}.json"
    chmod 600 "/etc/cloudflared/${TUNNEL_ID}.json"
    CRED_FOUND=1
fi

if [ "${CRED_FOUND}" -eq 1 ]; then
    echo -e "${GREEN}Tunnel credentials JSON verified at /etc/cloudflared/${TUNNEL_ID}.json${NC}"
else
    echo -e "${YELLOW}[ACTION REQUIRED] Credentials file '/etc/cloudflared/${TUNNEL_ID}.json' not yet found.${NC}"
    echo -e "${YELLOW}Please place your tunnel credentials JSON file there, or restore from backup.${NC}"
fi

# Install Systemd Service
cp "${REPO_DIR}/infrastructure/systemd/cloudflared-ricoh-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable cloudflared-ricoh-api.service
if [ "${CRED_FOUND}" -eq 1 ]; then
    systemctl restart cloudflared-ricoh-api.service || true
    echo -e "${GREEN}cloudflared-ricoh-api.service enabled and started.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 7: Application Dependencies & PM2 Process Initialization
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[7/8] Installing dependencies and starting Node.js with PM2...${NC}"
mkdir -p "${REPO_DIR}/Database"
mkdir -p "${REPO_DIR}/logs"

if [ "${TARGET_USER}" != "root" ]; then
    chown -R "${TARGET_USER}:${TARGET_USER}" "${REPO_DIR}"
fi

# Run npm install and pm2 under TARGET_USER
sudo -u "${TARGET_USER}" bash <<EOF
cd "${REPO_DIR}"
npm install --production
pm2 startOrReload ecosystem.config.js --env production
pm2 save
EOF

# Setup PM2 auto-startup on reboot
env PATH=\$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u "${TARGET_USER}" --hp "/home/${TARGET_USER}" 2>/dev/null || true

# ------------------------------------------------------------------------------
# STEP 8: Firewall Hardening & Final Health Check
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[8/8] Applying firewall rules and testing connectivity...${NC}"
"${SCRIPT_DIR}/setup-firewall.sh" 9017

echo -e "\n${BLUE}Verifying local API status...${NC}"
sleep 2
if "${SCRIPT_DIR}/healthcheck.sh" local; then
    echo -e "\n${GREEN}================================================================${NC}"
    echo -e "${GREEN}       BOOTSTRAP COMPLETED SUCCESSFULLY! API IS ONLINE!        ${NC}"
    echo -e "${GREEN}================================================================${NC}"
    echo -e "• Local Loopback: http://127.0.0.1:3000"
    echo -e "• Cloudflare Ingress: https://api.tamammrbeast.my.id/"
    echo -e "• PM2 Process: pm2 status"
    echo -e "• Cloudflared Service: systemctl status cloudflared-ricoh-api"
    echo -e "${CYAN}================================================================${NC}"
else
    echo -e "${YELLOW}[WARN] Local API is booting up or failed health check. Check logs with:${NC}"
    echo -e "  pm2 logs ricoh-shield-api"
fi
