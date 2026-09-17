#!/usr/bin/env bash
# ==============================================================================
# Healthcheck Script - Ricoh Shield Headless API
# Usage: ./deploy/healthcheck.sh [local|public|all]
# ==============================================================================
set -euo pipefail

MODE="${1:-all}"
LOCAL_URL="http://127.0.0.1:3000/"
PUBLIC_URL="https://api.tamammrbeast.my.id/"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_endpoint() {
    local target_name="$1"
    local url="$2"
    local timeout=5

    log_info "Testing ${target_name} endpoint: ${url}"

    # Perform request and capture HTTP status code and response body
    local response
    local http_code
    
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" --max-time "${timeout}" "${url}" 2>/dev/null || true)
    
    if [ -z "${response}" ]; then
        log_error "${target_name} (${url}) is unreachable! Connection timed out or failed."
        return 1
    fi

    http_code=$(echo "${response}" | grep 'HTTP_STATUS:' | cut -d':' -f2)
    local body
    body=$(echo "${response}" | grep -v 'HTTP_STATUS:')

    if [ "${http_code}" != "200" ]; then
        log_error "${target_name} returned HTTP status ${http_code} (Expected: 200)"
        echo -e "Response snippet: ${body}\n"
        return 1
    fi

    # Validate JSON signature
    if echo "${body}" | grep -q '"status":"online"'; then
        log_success "${target_name} is HEALTHY! (HTTP 200 - status: online)"
        return 0
    else
        log_warn "${target_name} responded HTTP 200, but JSON payload did not match expected 'status: online'."
        echo -e "Payload: ${body}\n"
        return 1
    fi
}

FAILED=0

if [ "${MODE}" = "local" ] || [ "${MODE}" = "all" ]; then
    if ! check_endpoint "LOCAL API (127.0.0.1:3000)" "${LOCAL_URL}"; then
        FAILED=1
    fi
fi

if [ "${MODE}" = "public" ] || [ "${MODE}" = "all" ]; then
    if ! check_endpoint "PUBLIC API (api.tamammrbeast.my.id)" "${PUBLIC_URL}"; then
        FAILED=1
    fi
fi

if [ "${FAILED}" -ne 0 ]; then
    log_error "Health check FAILED."
    exit 1
else
    log_success "All requested health checks PASSED!"
    exit 0
fi
