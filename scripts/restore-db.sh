#!/usr/bin/env bash
# Restores a dump made by backup-db.sh. DESTRUCTIVE: replaces the current database contents.
# Usage: ./scripts/restore-db.sh backups/scholarship-20260101T000000Z.dump [--yes]
set -euo pipefail
# Git Bash on Windows would rewrite container paths like /data; no effect on Linux.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

FILE="${1:-}"
[[ -f "$FILE" ]] || { echo "Usage: $0 <backup.dump>" >&2; exit 1; }

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [[ "${2:-}" != "--yes" ]]; then
  read -r -p "This will REPLACE database '${POSTGRES_DB:-scholarship}' with ${FILE}. Type 'restore' to continue: " answer
  [[ "$answer" == "restore" ]] || { echo "Aborted."; exit 1; }
fi

echo "==> Stopping the API"
docker compose stop api

echo "==> Restoring"
docker compose exec -T postgres pg_restore -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scholarship}" \
  --clean --if-exists --no-owner --exit-on-error < "$FILE"

echo "==> Re-applying migrations / role grants"
docker compose run --rm --no-build migrate

docker compose start api
echo "Restore complete."
