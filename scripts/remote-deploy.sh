#!/usr/bin/env bash
# Run this FROM YOUR COMPUTER (Git Bash / macOS / Linux). It copies the app to
# an AWS EC2 server over SSH and deploys it there with docker compose.
#
# Usage:
#   ./scripts/remote-deploy.sh <user@server-ip> [--key path/to/key.pem] [--domain tracker.example.org] [--data backups/<file>.dump]
#
#   --key     SSH private key (the .pem downloaded when you launched the EC2 instance)
#   --domain  Domain whose DNS A record points at the server -> automatic HTTPS.
#             Omit to serve plain HTTP on the server's IP address.
#   --data    Database dump (from ./scripts/backup-db.sh) to restore on the server.
#             You will be asked to type "restore" on the server to confirm.
#   --ship-images  Build the Docker images on THIS computer and upload them, instead
#             of building on the server. Use for small servers (< 2 GB RAM).
#             Needs Docker running locally and the same CPU type (x86_64).
#
# Safe to re-run for updates: the server's .env (passwords) is created only once
# and kept afterwards; the database is only replaced when --data is given.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

TARGET=""
KEY=""
DOMAIN=""
DATA=""
SHIP=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --key) KEY="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --data) DATA="$2"; shift 2 ;;
    --ship-images) SHIP=true; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) if [[ -z "$TARGET" ]]; then TARGET="$1"; shift; else echo "Unknown argument: $1" >&2; exit 1; fi ;;
  esac
done
[[ -n "$TARGET" ]] || { sed -n '2,19p' "$0"; exit 1; }
[[ -z "$DATA" || -f "$DATA" ]] || { echo "Dump file not found: $DATA" >&2; exit 1; }

REMOTE_DIR="selection-tracker"
HOST="${TARGET#*@}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
run() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }
copy() { scp "${SSH_OPTS[@]}" "$1" "$TARGET:$2"; }

# Firebase keys come from the local .env (or .env.local).
SOURCE_ENV=".env"
[[ -f "$SOURCE_ENV" ]] || SOURCE_ENV=".env.local"
for var in NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN NEXT_PUBLIC_FIREBASE_PROJECT_ID \
           FIREBASE_ADMIN_PROJECT_ID FIREBASE_ADMIN_CLIENT_EMAIL FIREBASE_ADMIN_PRIVATE_KEY; do
  grep -qE "^${var}=.+" "$SOURCE_ENV" || { echo "Missing ${var} in ${SOURCE_ENV}" >&2; exit 1; }
done

echo "==> Connecting to ${TARGET}"
run 'echo "    connected to $(hostname) ($(. /etc/os-release && echo $PRETTY_NAME), $(nproc) CPU, $(free -g | awk "/Mem:/{print \$2}") GB RAM)"'

echo "==> Packaging the app"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar -czf "$WORK/app.tar.gz" \
  --exclude=./node_modules --exclude=./api/node_modules --exclude=./api/dist \
  --exclude=./.next --exclude=./.git --exclude=./.env --exclude=./.env.local --exclude=./api/.env \
  --exclude=./backups --exclude='*.backup.gz' --exclude=./storage-data --exclude=./api/storage-data \
  --exclude=./tsconfig.tsbuildinfo --exclude=./.claude \
  .
echo "    $(du -h "$WORK/app.tar.gz" | cut -f1)"

echo "==> Uploading"
copy "$WORK/app.tar.gz" "app.tar.gz"
run "mkdir -p ${REMOTE_DIR} && tar -xzf app.tar.gz -C ${REMOTE_DIR} && rm app.tar.gz \
  && cd ${REMOTE_DIR} && sed -i 's/\r\$//' scripts/*.sh deploy/Caddyfile && chmod +x scripts/*.sh"

if ! run "command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1"; then
  echo "==> Installing Docker on the server (one time)"
  run -t "cd ${REMOTE_DIR} && sudo ./scripts/setup-server.sh"
fi

if run "test -f ${REMOTE_DIR}/.env"; then
  echo "==> Keeping the server's existing .env"
else
  echo "==> Creating the server's .env (new passwords + your Firebase keys)"
  gen() { openssl rand -hex 24; }
  awk -v site="${DOMAIN:-:80}" -v pg="$(gen)" -v app="$(gen)" -v rd="$(gen)" '
    NR == FNR { if (match($0, /^[A-Z0-9_]+=/)) { k = substr($0, 1, RLENGTH - 1); if (k ~ /FIREBASE/) src[k] = $0 } next }
    /^SITE_ADDRESS=/      { print "SITE_ADDRESS=" site; next }
    /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pg; next }
    /^APP_DB_PASSWORD=/   { print "APP_DB_PASSWORD=" app; next }
    /^REDIS_PASSWORD=/    { print "REDIS_PASSWORD=" rd; next }
    {
      if (match($0, /^[A-Z0-9_]+=/)) { k = substr($0, 1, RLENGTH - 1); if (k in src) { print src[k]; next } }
      print
    }' "$SOURCE_ENV" .env.example > "$WORK/server.env"
  copy "$WORK/server.env" "${REMOTE_DIR}/.env"
  run "chmod 600 ${REMOTE_DIR}/.env"
fi

if $SHIP; then
  echo "==> Building images locally"
  docker compose --env-file "$SOURCE_ENV" build api web
  echo "==> Uploading images (a few hundred MB, takes a while on slow links)"
  docker save scholarship-tracker-api:latest scholarship-tracker-web:latest | gzip -1     | ssh "${SSH_OPTS[@]}" "$TARGET" "gunzip | docker load"
  echo "==> Starting on the server"
  run "cd ${REMOTE_DIR} && ./scripts/deploy.sh --no-build"
else
  echo "==> Building and starting on the server (first build takes ~5-10 minutes)"
  run "cd ${REMOTE_DIR} && ./scripts/deploy.sh"
fi

if [[ -n "$DATA" ]]; then
  echo "==> Uploading database dump $(basename "$DATA")"
  run "mkdir -p ${REMOTE_DIR}/backups"
  copy "$DATA" "${REMOTE_DIR}/backups/$(basename "$DATA")"
  run -t "cd ${REMOTE_DIR} && ./scripts/restore-db.sh backups/$(basename "$DATA")"
fi

URL="http://${HOST}"
[[ -n "$DOMAIN" ]] && URL="https://${DOMAIN}"
echo
echo "==> Checking ${URL}/api/health"
sleep 3
curl -fsS --max-time 15 "${URL}/api/health" && echo || echo "    (not reachable from here yet — check the security group allows ports 80/443, and DNS if using a domain)"
echo
echo "Done: ${URL}"
echo "Remember: add '${DOMAIN:-$HOST}' to Firebase console -> Authentication -> Settings -> Authorized domains."
