#!/usr/bin/env bash
# ==============================================================================
# Backup Script - Ricoh Shield Headless API
# Usage: ./deploy/backup.sh [output_dir] [--encrypt]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${1:-${REPO_DIR}/backups}"
ENCRYPT_FLAG="${2:-}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="ricoh_shield_backup_${TIMESTAMP}.tar.gz"
TEMP_STAGE_DIR=$(mktemp -d)

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cleanup() {
    rm -rf "${TEMP_STAGE_DIR}"
}
trap cleanup EXIT

mkdir -p "${BACKUP_DIR}"
mkdir -p "${TEMP_STAGE_DIR}/data"
mkdir -p "${TEMP_STAGE_DIR}/config"
mkdir -p "${TEMP_STAGE_DIR}/cloudflared"

echo -e "${BLUE}[INFO] Starting backup of Ricoh Shield API...${NC}"

# 1. Backup Database (whitelist.json, Games.json)
echo -e "${BLUE}[1/4] Backing up database files...${NC}"
if [ -f "${REPO_DIR}/Database/whitelist.json" ]; then
    cp -p "${REPO_DIR}/Database/whitelist.json" "${TEMP_STAGE_DIR}/data/"
elif [ -f "${REPO_DIR}/../Database/whitelist.json" ]; then
    cp -p "${REPO_DIR}/../Database/whitelist.json" "${TEMP_STAGE_DIR}/data/"
fi

if [ -f "${REPO_DIR}/Database/Games.json" ]; then
    cp -p "${REPO_DIR}/Database/Games.json" "${TEMP_STAGE_DIR}/data/"
elif [ -f "${REPO_DIR}/../Database/Games.json" ]; then
    cp -p "${REPO_DIR}/../Database/Games.json" "${TEMP_STAGE_DIR}/data/"
fi

# 2. Backup Environment & App Configuration
echo -e "${BLUE}[2/4] Backing up environment variables and app configs...${NC}"
if [ -f "${REPO_DIR}/.env" ]; then
    cp -p "${REPO_DIR}/.env" "${TEMP_STAGE_DIR}/config/"
fi
if [ -f "${REPO_DIR}/config.json" ]; then
    cp -p "${REPO_DIR}/config.json" "${TEMP_STAGE_DIR}/config/"
fi
if [ -f "${REPO_DIR}/ecosystem.config.js" ]; then
    cp -p "${REPO_DIR}/ecosystem.config.js" "${TEMP_STAGE_DIR}/config/"
fi

# 3. Backup Cloudflare Tunnel Configuration
echo -e "${BLUE}[3/4] Backing up Cloudflare Tunnel configs...${NC}"
if [ -f "/etc/cloudflared/ricoh-api.yml" ]; then
    cp -p "/etc/cloudflared/ricoh-api.yml" "${TEMP_STAGE_DIR}/cloudflared/" 2>/dev/null || true
fi

# Check for JSON credential files in /etc/cloudflared or ~/.cloudflared
for f in /etc/cloudflared/*.json /home/*/.cloudflared/*.json; do
    if [ -f "${f}" ]; then
        cp -p "${f}" "${TEMP_STAGE_DIR}/cloudflared/" 2>/dev/null || true
    fi
done

# 4. Pack into Archive
echo -e "${BLUE}[4/4] Compressing backup archive...${NC}"
TARGET_FILE="${BACKUP_DIR}/${ARCHIVE_NAME}"
tar -czf "${TARGET_FILE}" -C "${TEMP_STAGE_DIR}" .

# 5. Optional Encryption with OpenSSL
if [ "${ENCRYPT_FLAG}" = "--encrypt" ]; then
    echo -e "${YELLOW}[INFO] Encrypting archive with OpenSSL AES-256...${NC}"
    openssl enc -aes-256-cbc -pbkdf2 -salt -in "${TARGET_FILE}" -out "${TARGET_FILE}.enc"
    rm -f "${TARGET_FILE}"
    TARGET_FILE="${TARGET_FILE}.enc"
    echo -e "${GREEN}[SUCCESS] Encrypted backup created: ${TARGET_FILE}${NC}"
else
    echo -e "${GREEN}[SUCCESS] Backup archive created: ${TARGET_FILE}${NC}"
fi

# Ensure backup permissions are secure (read-only by owner)
chmod 600 "${TARGET_FILE}"

echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}Backup successfully completed!${NC}"
echo -e "Location: ${TARGET_FILE}"
echo -e "Keep this file in a safe place (e.g. download to local machine or secure cloud).${NC}"
