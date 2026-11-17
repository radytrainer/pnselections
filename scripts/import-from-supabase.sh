#!/usr/bin/env bash
# ONE-TIME migration of existing production data from the old Supabase project
# into the dockerized PostgreSQL + file storage.
#
#   1. Copies all rows of the public schema (data only) from Supabase.
#      The target schema comes from db/migrations, which matches Supabase's.
#   2. Copies every file from the Supabase Storage buckets into the new
#      storage (local volume or S3) and rewrites stored logo/avatar URLs.
#
# Required env (export them or put them in .env):
#   SUPABASE_DB_URL            Supabase "Session pooler"/direct connection string
#                              (Project Settings -> Database), e.g.
#                              postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
#   SUPABASE_URL               https://<ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY  service_role key (Project Settings -> API)
#
# Usage: ./scripts/import-from-supabase.sh            (asks for confirmation)
# DESTRUCTIVE for the TARGET: all existing rows in the dockerized database are replaced.
set -euo pipefail
# Git Bash on Windows would rewrite container paths like /data; no effect on Linux.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL}"
: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"

DB="${POSTGRES_DB:-scholarship}"
PGUSER_LOCAL="${POSTGRES_USER:-postgres}"

read -r -p "This REPLACES all data in the dockerized database '${DB}' with Supabase's data. Type 'import' to continue: " answer
[[ "$answer" == "import" ]] || { echo "Aborted."; exit 1; }

mkdir -p backups
DUMP="backups/supabase-data-$(date -u +%Y%m%dT%H%M%SZ).sql"

echo "==> Ensuring postgres/redis are up and the schema is migrated"
docker compose up -d postgres redis
docker compose run --rm migrate

echo "==> Dumping data from Supabase (public schema, data only)"
docker run --rm -e PGCONNECT_TIMEOUT=20 postgres:17-alpine \
  pg_dump "${SUPABASE_DB_URL}" --data-only --schema=public --no-owner --no-privileges \
    --exclude-table=public.schema_migrations > "${DUMP}"
echo "    saved to ${DUMP} ($(wc -c < "${DUMP}") bytes)"

echo "==> Clearing target tables"
docker compose exec -T postgres psql -U "${PGUSER_LOCAL}" -d "${DB}" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare t text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ')
    into t
  from pg_tables
  where schemaname = 'public' and tablename <> 'schema_migrations';
  if t is not null then
    execute 'truncate table ' || t || ' restart identity cascade';
  end if;
end $$;
SQL

echo "==> Loading data (triggers disabled during load)"
docker compose exec -T -e PGOPTIONS="-c session_replication_role=replica" postgres \
  psql -U "${PGUSER_LOCAL}" -d "${DB}" -v ON_ERROR_STOP=1 --single-transaction -q < "${DUMP}"

docker compose exec -T postgres psql -U "${PGUSER_LOCAL}" -d "${DB}" -v ON_ERROR_STOP=1 \
  -c "refresh materialized view mv_province_stats;" \
  -c "select 'students' as table, count(*) from students union all select 'users', count(*) from users union all select 'ngo_partners', count(*) from ngo_partners;"

echo "==> Copying files from Supabase Storage"
docker compose run --rm \
  -e SUPABASE_URL="${SUPABASE_URL}" \
  -e SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
  -e MIGRATION_DATABASE_URL="postgres://${PGUSER_LOCAL}:${POSTGRES_PASSWORD}@postgres:5432/${DB}" \
  api node dist/scripts/migrate-storage.js

echo "==> Clearing cached lookups"
docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning --scan --pattern 'cache:*' \
  | xargs -r docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning del >/dev/null || true

echo
echo "Import complete. Users sign in with the same Firebase accounts as before."
