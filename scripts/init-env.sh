#!/usr/bin/env bash
# Creates .env from .env.example with freshly generated database/redis passwords.
# Usage: ./scripts/init-env.sh [site-address]
#   ./scripts/init-env.sh                       # SITE_ADDRESS=:80
#   ./scripts/init-env.sh tracker.example.org   # automatic HTTPS for that domain
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo ".env already exists — not overwriting. Delete it first to regenerate." >&2
  exit 1
fi

gen() { openssl rand -hex 24; }

cp .env.example .env
sed -i.bak \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(gen)|" \
  -e "s|^APP_DB_PASSWORD=.*|APP_DB_PASSWORD=$(gen)|" \
  -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(gen)|" \
  .env
if [[ $# -ge 1 ]]; then
  sed -i.bak -e "s|^SITE_ADDRESS=.*|SITE_ADDRESS=$1|" .env
fi
rm -f .env.bak
chmod 600 .env

echo "Created .env with generated passwords."
echo "Next: fill in the NEXT_PUBLIC_FIREBASE_* and FIREBASE_ADMIN_* values, then run ./scripts/deploy.sh"
