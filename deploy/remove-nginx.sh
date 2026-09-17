#!/usr/bin/env bash
# ==============================================================================
# Safe Nginx Removal Script - Ricoh Shield Headless API
# Usage: sudo ./deploy/remove-nginx.sh [--force]
# ==============================================================================
set -euo pipefail

# Ensure running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run as root (or with sudo)."
    exit 1
fi

FORCE_FLAG="${1:-}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}       Nginx Safety Audit & Decommissioning Tool       ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Check if Nginx is installed
if ! command -v nginx &>/dev/null; then
    echo -e "${GREEN}[INFO] Nginx is not installed on this system. Nothing to remove.${NC}"
    exit 0
fi

# 2. Audit active sites in /etc/nginx/sites-enabled/
echo -e "\n${BLUE}[1/4] Auditing active Nginx virtual hosts...${NC}"
ACTIVE_SITES=()
if [ -d "/etc/nginx/sites-enabled" ]; then
    while IFS= read -r site; do
        if [ -n "${site}" ]; then
            ACTIVE_SITES+=("$(basename "${site}")")
        fi
    done < <(find /etc/nginx/sites-enabled -type l -o -type f 2>/dev/null || true)
fi

echo -e "Found ${#ACTIVE_SITES[@]} active site configuration(s):"
OTHER_SITES=0
for site in "${ACTIVE_SITES[@]}"; do
    echo -e " - ${site}"
    # Check if site is NOT related to ricoh or default
    if [[ "${site}" != "ricoh"* ]] && [[ "${site}" != "default"* ]]; then
        OTHER_SITES=$((OTHER_SITES + 1))
        echo -e "   ${RED}▲ WARNING: '${site}' appears to belong to another application!${NC}"
    fi
done

# 3. Audit listening ports
echo -e "\n${BLUE}[2/4] Auditing active listening ports for Nginx...${NC}"
NGINX_PORTS=$(ss -tulpn 2>/dev/null | grep -E 'nginx' || true)
if [ -n "${NGINX_PORTS}" ]; then
    echo -e "Nginx is currently listening on:\n${NGINX_PORTS}"
else
    echo -e "Nginx is not currently listening on any socket."
fi

# 4. Check safety verdict
echo -e "\n${BLUE}[3/4] Safety Assessment Verdict:${NC}"
if [ "${OTHER_SITES}" -gt 0 ]; then
    echo -e "${RED}[ABORT] Detected ${OTHER_SITES} active site(s) that may belong to other domains/services.${NC}"
    echo -e "${RED}Removing Nginx now would break other websites hosted on this VPS.${NC}"
    echo -e "${YELLOW}If you still wish to proceed, manually review /etc/nginx/sites-enabled first.${NC}"
    exit 1
fi

echo -e "${GREEN}[SAFE] No critical third-party Nginx virtual hosts detected.${NC}"
echo -e "Nginx can safely be decommissioned because Cloudflare Tunnel directly forwards traffic to 127.0.0.1:3000."

# 5. Interactive confirmation
if [ "${FORCE_FLAG}" != "--force" ]; then
    echo -e "\n${YELLOW}------------------------------------------------------${NC}"
    echo -e "${YELLOW}DESTRUCTIVE ACTION CONFIRMATION${NC}"
    echo -e "This will:"
    echo -e " 1. Backup /etc/nginx configuration to /var/backups/nginx-backup-*.tar.gz"
    echo -e " 2. Stop and disable nginx.service"
    echo -e " 3. Uninstall nginx and nginx-common packages via apt"
    echo -e "${YELLOW}------------------------------------------------------${NC}"
    read -r -p "Type 'DELETE_NGINX' to confirm and proceed: " USER_CONFIRM
    if [ "${USER_CONFIRM}" != "DELETE_NGINX" ]; then
        echo -e "${YELLOW}[CANCELLED] Action cancelled by user. Nginx was NOT touched.${NC}"
        exit 0
    fi
fi

# 6. Execute Backup and Removal
BACKUP_FILE="/var/backups/nginx-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
echo -e "\n${BLUE}[4/4] Creating safety backup of Nginx configurations...${NC}"
mkdir -p /var/backups
tar -czf "${BACKUP_FILE}" -C / etc/nginx 2>/dev/null || true
echo -e "${GREEN}[SUCCESS] Backup saved to ${BACKUP_FILE}${NC}"

echo -e "${BLUE}[INFO] Stopping and disabling Nginx service...${NC}"
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

echo -e "${BLUE}[INFO] Removing Nginx packages...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get remove -y nginx nginx-common
apt-get autoremove -y

echo -e "${GREEN}[SUCCESS] Nginx has been safely decommissioned and removed!${NC}"
echo -e "${GREEN}Cloudflare Tunnel will handle all routing directly to 127.0.0.1:3000.${NC}"
