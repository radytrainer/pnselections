#!/usr/bin/env bash
# Builds and (re)starts the whole stack, running database migrations first.
# Usage: ./scripts/deploy.sh [--pull] [--no-backup] [--no-build]
#   --pull       git pull the current branch before building
#   --no-backup  skip the pre-deploy database backup
#   --no-build   use images already loaded on this machine (see remote-deploy.sh --ship-images)
set -euo pipefail
# Git Bash on Windows would rewrite container paths like /data; no effect on Linux.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

PULL=false
BACKUP=true
BUILD=true
for arg in "$@"; do
  case "$arg" in
    --pull) PULL=true ;;
    --no-backup) BACKUP=false ;;
    --no-build) BUILD=false ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

[[ -f .env ]] || { echo "Missing .env — run ./scripts/init-env.sh first." >&2; exit 1; }
for var in NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_PROJECT_ID FIREBASE_ADMIN_PROJECT_ID FIREBASE_ADMIN_CLIENT_EMAIL; do
  grep -qE "^${var}=.+" .env || { echo "Set ${var} in .env before deploying." >&2; exit 1; }
done

COMPOSE=(docker compose)

if $PULL; then
  echo "==> git pull"
  git pull --ff-only
fi

if $BACKUP && "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "==> Pre-deploy database backup"
  ./scripts/backup-db.sh
fi

if $BUILD; then
  echo "==> Building images"
  "${COMPOSE[@]}" build
fi

echo "==> Starting database + cache"
"${COMPOSE[@]}" up -d postgres redis

echo "==> Running migrations"
"${COMPOSE[@]}" run --rm --no-build migrate

echo "==> Starting api, web, caddy"
"${COMPOSE[@]}" up -d --no-build --remove-orphans api web caddy

echo "==> Waiting for the API to report healthy"
for i in $(seq 1 40); do
  if "${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "API is healthy."
    break
  fi
  if [[ $i -eq 40 ]]; then
    echo "API did not become healthy. Recent logs:" >&2
    "${COMPOSE[@]}" logs --tail=80 api >&2
    exit 1
  fi
  sleep 3
done

docker image prune -f >/dev/null
"${COMPOSE[@]}" ps
SITE=$(grep -E '^SITE_ADDRESS=' .env | cut -d= -f2-)
echo
echo "Deployed. Site address: ${SITE:-:80}"
