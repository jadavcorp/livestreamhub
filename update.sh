#!/usr/bin/env bash
# LiveStream Hub updater
set -euo pipefail
APP_DIR="/opt/livestream-hub"
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

if [[ $EUID -ne 0 ]]; then echo -e "${RED}Run as root${NC}"; exit 1; fi

cd "$APP_DIR"
echo -e "${CYAN}[i] Backing up database before update…${NC}"
mkdir -p storage/backups
if [[ -f storage/livestream-hub.db ]]; then
  cp storage/livestream-hub.db "storage/backups/pre-update-$(date +%Y%m%d-%H%M%S).db"
fi

echo -e "${CYAN}[i] Pulling latest image and rebuilding…${NC}"
docker compose down
docker compose build --pull
docker compose up -d

echo -e "${GREEN}[✓] Update complete. Cleaning up old images…${NC}"
docker image prune -f
echo -e "${GREEN}[✓] LiveStream Hub is up to date.${NC}"
docker compose ps
