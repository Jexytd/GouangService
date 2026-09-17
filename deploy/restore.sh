#!/usr/bin/env bash
# ==============================================================================
# Restore Script - Ricoh Shield Headless API
# Usage: ./deploy/restore.sh <path_to_backup_archive>
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "[ERROR] Usage: $0 <path_to_backup_archive>"
    exit 1
fi

BACKUP_ARCHIVE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ ! -f "${BACKUP_ARCHIVE}" ]; then
    echo "[ERROR] Backup file '${BACKUP_ARCHIVE}' not found."
    exit 1
fi

TEMP_RESTORE_DIR=$(mktemp -d)
cleanup() {
    rm -rf "${TEMP_RESTORE_DIR}"
}
trap cleanup EXIT

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[INFO] Restoring backup from: ${BACKUP_ARCHIVE}...${NC}"

# Check if file is encrypted (.enc)
ACTUAL_ARCHIVE="${BACKUP_ARCHIVE}"
if [[ "${BACKUP_ARCHIVE}" == *.enc ]]; then
    echo -e "${YELLOW}[INFO] File appears to be encrypted. Decrypting with OpenSSL AES-256...${NC}"
    ACTUAL_ARCHIVE="${TEMP_RESTORE_DIR}/decrypted.tar.gz"
    openssl enc -d -aes-256-cbc -pbkdf2 -in "${BACKUP_ARCHIVE}" -out "${ACTUAL_ARCHIVE}"
fi

# Extract archive
tar -xzf "${ACTUAL_ARCHIVE}" -C "${TEMP_RESTORE_DIR}"

# 1. Restore Database
echo -e "${BLUE}[1/3] Restoring database files...${NC}"
TARGET_DB_DIR="${REPO_DIR}/Database"
mkdir -p "${TARGET_DB_DIR}"

if [ -f "${TEMP_RESTORE_DIR}/data/whitelist.json" ]; then
    cp -p "${TEMP_RESTORE_DIR}/data/whitelist.json" "${TARGET_DB_DIR}/"
    echo -e "${GREEN} - whitelist.json restored to ${TARGET_DB_DIR}/${NC}"
fi
if [ -f "${TEMP_RESTORE_DIR}/data/Games.json" ]; then
    cp -p "${TEMP_RESTORE_DIR}/data/Games.json" "${TARGET_DB_DIR}/"
    echo -e "${GREEN} - Games.json restored to ${TARGET_DB_DIR}/${NC}"
fi

# 2. Restore Environment & Config
echo -e "${BLUE}[2/3] Restoring configuration files...${NC}"
if [ -f "${TEMP_RESTORE_DIR}/config/.env" ]; then
    cp -p "${TEMP_RESTORE_DIR}/config/.env" "${REPO_DIR}/.env"
    chmod 600 "${REPO_DIR}/.env"
    echo -e "${GREEN} - .env restored (permissions 600)${NC}"
fi
if [ -f "${TEMP_RESTORE_DIR}/config/config.json" ]; then
    cp -p "${TEMP_RESTORE_DIR}/config/config.json" "${REPO_DIR}/config.json"
    echo -e "${GREEN} - config.json restored${NC}"
fi

# 3. Restore Cloudflare Tunnel Config (requires sudo if writing to /etc/cloudflared)
echo -e "${BLUE}[3/3] Restoring Cloudflare Tunnel credentials...${NC}"
if [ -d "${TEMP_RESTORE_DIR}/cloudflared" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        mkdir -p /etc/cloudflared
        chmod 700 /etc/cloudflared
        cp -p "${TEMP_RESTORE_DIR}/cloudflared/"* /etc/cloudflared/ 2>/dev/null || true
        chmod 600 /etc/cloudflared/* 2>/dev/null || true
        echo -e "${GREEN} - Cloudflare Tunnel configs restored to /etc/cloudflared/${NC}"
    else
        echo -e "${YELLOW}[WARN] Non-root user: Cloudflare Tunnel files extracted to ${REPO_DIR}/cloudflared_restore/${NC}"
        mkdir -p "${REPO_DIR}/cloudflared_restore"
        cp -p "${TEMP_RESTORE_DIR}/cloudflared/"* "${REPO_DIR}/cloudflared_restore/" 2>/dev/null || true
        echo -e "${YELLOW}Please run: sudo cp -p ${REPO_DIR}/cloudflared_restore/* /etc/cloudflared/${NC}"
    fi
fi

echo -e "${GREEN}[SUCCESS] Restore completed successfully!${NC}"
