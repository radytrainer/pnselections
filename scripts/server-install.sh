#!/usr/bin/env bash
# First-time install ON THE SERVER, run from inside the git clone. Does every
# step in order and is safe to re-run if one fails part-way:
#   Docker -> .env (domain + Firebase keys) -> build/migrate/start -> restore data
#
# Before running, copy these from your computer into the server's home folder (~):
#   firebase.env                       required on the first run (Firebase keys)
#   scholarship-<stamp>.dump           optional: database to restore
#   storage-<stamp>.tar.gz             optional: uploaded photos/logos to restore
#
# Usage (no sudo — it asks for sudo itself where needed):
#   bash scripts/server-install.sh pn-selection.store www.pn-selection.store
set -euo pipefail
cd "$(dirname "$0")/.."

[[ $# -ge 1 ]] || { sed -n '2,13p' "$0"; exit 1; }
[[ $EUID -ne 0 ]] || { echo "Run without sudo (as your normal user); the script uses sudo where needed." >&2; exit 1; }
SITE="$(printf '%s, ' "$@")"; SITE="${SITE%, }"
ME="$(id -un)"
step() { echo; echo "==> $*"; }

# Docker commands work right after setup-server.sh adds us to the docker group,
# without logging out and back in, by running them through `sg docker`.
dk() {
  if docker info >/dev/null 2>&1; then bash -c "$1"; else sg docker -c "$1"; fi
}

step "1/5 Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "    already installed"
else
  sudo bash scripts/setup-server.sh
fi

step "2/5 Settings (.env)"
if [[ -f .env ]]; then
  echo "    keeping existing .env (passwords unchanged)"
  sudo chown "$ME:$ME" .env
else
  bash scripts/init-env.sh "$SITE" >/dev/null
  echo "    created .env with new database/redis passwords"
fi
sed -i "s|^SITE_ADDRESS=.*|SITE_ADDRESS=\"${SITE}\"|" .env
echo "    site address: ${SITE}"

if [[ -f ~/firebase.env ]]; then
  grep -vE '^(NEXT_PUBLIC_FIREBASE_|FIREBASE_ADMIN_)' .env > .env.tmp
  tr -d '\r' < ~/firebase.env >> .env.tmp
  mv .env.tmp .env
  rm -f ~/firebase.env
  echo "    Firebase keys added from ~/firebase.env"
fi
chmod 600 .env
missing=()
for v in NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN NEXT_PUBLIC_FIREBASE_PROJECT_ID \
         FIREBASE_ADMIN_PROJECT_ID FIREBASE_ADMIN_CLIENT_EMAIL FIREBASE_ADMIN_PRIVATE_KEY; do
  grep -qE "^${v}=.+" .env || missing+=("$v")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "    Missing in .env: ${missing[*]}" >&2
  echo "    Copy firebase.env to ~ from your computer (see the top of this script), then re-run." >&2
  exit 1
fi
echo "    all 6 Firebase keys present"

step "3/5 Build, migrate and start (first build takes ~5-10 minutes)"
dk "bash scripts/deploy.sh"

step "4/5 Restore database"
DUMP="$(ls -t ~/scholarship-*.dump 2>/dev/null | head -1 || true)"
if [[ -n "$DUMP" ]]; then
  mkdir -p backups
  mv "$DUMP" backups/
  dk "bash scripts/restore-db.sh 'backups/$(basename "$DUMP")'"
else
  echo "    no ~/scholarship-*.dump found — skipped (empty database)"
fi

step "5/5 Restore uploaded files"
FILES="$(ls -t ~/storage-*.tar.gz 2>/dev/null | head -1 || true)"
if [[ -n "$FILES" ]]; then
  mkdir -p backups
  mv "$FILES" backups/
  dk "docker compose exec -T api tar -xzf - -C /data/storage < 'backups/$(basename "$FILES")'"
  echo "    restored $(basename "$FILES")"
else
  echo "    no ~/storage-*.tar.gz found — skipped"
fi

FIRST="${SITE%%,*}"
step "Checking https://${FIRST}/api/health"
sleep 5
if curl -fsS --max-time 20 "https://${FIRST}/api/health"; then
  echo; echo; echo "All done: https://${FIRST}"
else
  echo "    HTTPS not answering yet. The certificate can take a minute on first start;"
  echo "    if it persists: check ports 80/443 in the AWS security group, and run"
  echo "    docker compose logs --tail=50 caddy"
fi
echo "Later updates:  cd $(pwd) && ./scripts/deploy.sh --pull"
