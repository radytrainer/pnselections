#!/usr/bin/env bash
# Dumps the PostgreSQL database (custom format, compressed) into ./backups,
# optionally uploads it to S3 (BACKUP_S3_URI), and prunes old local dumps.
# Usage: ./scripts/backup-db.sh
# Cron (daily 02:30): 30 2 * * * cd /home/ec2-user/selection-tracker && ./scripts/backup-db.sh >> backups/backup.log 2>&1
set -euo pipefail
# Git Bash on Windows would rewrite container paths like /data; no effect on Linux.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

mkdir -p backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="backups/${POSTGRES_DB:-scholarship}-${STAMP}.dump"

echo "==> Dumping database to ${FILE}"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scholarship}" -Fc > "${FILE}"

# Also archive uploaded files when stored on the local volume.
if [[ "${STORAGE_DRIVER:-local}" == "local" ]] && docker compose ps --status running --services | grep -qx api; then
  echo "==> Archiving uploaded files"
  docker compose exec -T api tar -czf - -C /data storage > "backups/storage-${STAMP}.tar.gz"
fi

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  echo "==> Uploading to ${BACKUP_S3_URI}"
  aws s3 cp "${FILE}" "${BACKUP_S3_URI%/}/$(basename "${FILE}")"
  if [[ -f "backups/storage-${STAMP}.tar.gz" ]]; then
    aws s3 cp "backups/storage-${STAMP}.tar.gz" "${BACKUP_S3_URI%/}/storage-${STAMP}.tar.gz"
  fi
fi

find backups -maxdepth 1 -type f \( -name '*.dump' -o -name 'storage-*.tar.gz' \) \
  -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete

echo "Backup complete: ${FILE}"
