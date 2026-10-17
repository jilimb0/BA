#!/usr/bin/env bash
set -euo pipefail

# Automated backup & disaster recovery script for Business Analyzer (BA)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting Business Analyzer state & database backup at ${TIMESTAMP}..."
if [ -f "./businesses.csv" ]; then
  cp "./businesses.csv" "${BACKUP_DIR}/businesses_${TIMESTAMP}.csv"
  echo "[SUCCESS] Businesses dataset backed up to ${BACKUP_DIR}/businesses_${TIMESTAMP}.csv"
fi

if [ -f "./data/spatial.db" ]; then
  cp "./data/spatial.db" "${BACKUP_DIR}/spatial_${TIMESTAMP}.db"
  echo "[SUCCESS] SQLite spatial database backed up to ${BACKUP_DIR}/spatial_${TIMESTAMP}.db"
fi

echo "{\"timestamp\": \"${TIMESTAMP}\", \"status\": \"snapshot_created\"}" > "${BACKUP_DIR}/snapshot_${TIMESTAMP}.json"

# Retention: keep last 14 backups
find "${BACKUP_DIR}" -type f -mtime +14 -delete
echo "[DONE] Disaster recovery backup completed successfully."
