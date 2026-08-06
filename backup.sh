#!/usr/bin/env bash
# LiveStream Hub backup script - run via cron
# Example crontab (daily at 3 AM):
#   0 3 * * * /opt/livestream-hub/backup.sh >> /var/lib/livestream-hub/logs/backup.log 2>&1
set -euo pipefail

APP_DIR="/opt/livestream-hub"
BACKUP_DIR="/var/lib/livestream-hub/backups"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/livestream-hub-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

echo "[$(date)] Starting backup…"

# Use the in-app API (triggers tar of DB, videos, thumbnails, settings)
# Or direct archive of storage:
tar -czf "$BACKUP_FILE" \
  --exclude='storage/hls/*' \
  --exclude='storage/backups/*' \
  storage/ 2>/dev/null || true

echo "[$(date)] Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Prune old backups
find "$BACKUP_DIR" -name "livestream-hub-*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Pruned backups older than $RETENTION_DAYS days"
echo "[$(date)] Done."
