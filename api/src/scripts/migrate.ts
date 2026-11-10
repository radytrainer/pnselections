/**
 * Applies db/migrations/*.sql in order (each in its own transaction, tracked
 * in public.schema_migrations), then makes sure the API's runtime login role
 * exists with only the privileges it needs.
 *
 * Env:
 *   MIGRATION_DATABASE_URL  owner/superuser connection (falls back to DATABASE_URL)
 *   MIGRATIONS_DIR          default: ./db/migrations or ../db/migrations
 *   APP_DB_USER / APP_DB_PASSWORD   runtime role the API logs in as (optional)
 *   SEED=true | --seed      also run db/seed.sql (idempotent reference data)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

function findDir(envName: string, candidates: string[]) {
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;
  const found = candidates.map((c) => path.resolve(process.cwd(), c)).find((c) => existsSync(c));
  if (!found) throw new Error(`Could not find ${candidates.join(" or ")}; set ${envName}`);
  return found;
}

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("MIGRATION_DATABASE_URL (or DATABASE_URL) is required");

  const migrationsDir = findDir("MIGRATIONS_DIR", ["db/migrations", "../db/migrations"]);
  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    // Only one migrator at a time (e.g. several containers starting together).
    await client.query("select pg_advisory_lock(727272)");
    await client.query(`
      create table if not exists public.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )`);

    const applied = new Set(
      (await client.query<{ version: string }>("select version from public.schema_migrations")).rows.map((r) => r.version),
    );
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      process.stdout.write(`[migrate] ${file} ... `);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into public.schema_migrations (version) values ($1)", [file]);
        await client.query("commit");
        console.log("ok");
        count++;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        console.log("FAILED");
        throw error;
      }
    }
    console.log(`[migrate] ${count} migration(s) applied, ${files.length - count} already up to date`);

    if (process.env.SEED === "true" || process.argv.includes("--seed")) {
      const seedFile = path.join(path.dirname(migrationsDir), "seed.sql");
      if (existsSync(seedFile)) {
        await client.query(readFileSync(seedFile, "utf8"));
        console.log("[migrate] seed.sql applied");
      }
    }

    // Privileges for tables that predate the default privileges in 0000
    // (e.g. restored from a dump). RLS still decides which rows are visible.
    await client.query(`
      grant usage on schema public, auth to authenticated;
      grant select, insert, update, delete on all tables in schema public to authenticated;
      grant usage, select on all sequences in schema public to authenticated;
      grant execute on all functions in schema public, auth to authenticated;
      revoke all on public.schema_migrations from authenticated;
    `);

    await ensureAppRole(client);
  } finally {
    await client.query("select pg_advisory_unlock(727272)").catch(() => {});
    await client.end();
  }
}

/**
 * The API logs in as APP_DB_USER: a NOINHERIT member of `authenticated`
 * with no privileges of its own, so it can only touch data after
 * `set local role authenticated` (api/src/db.ts), where RLS applies.
 */
async function ensureAppRole(client: Client) {
  const user = process.env.APP_DB_USER;
  const password = process.env.APP_DB_PASSWORD;
  if (!user || !password) {
    console.log("[migrate] APP_DB_USER/APP_DB_PASSWORD not set; skipping runtime role setup");
    return;
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(user)) throw new Error("APP_DB_USER must be a plain lowercase identifier");

  const exists = (await client.query("select 1 from pg_roles where rolname = $1", [user])).rowCount;
  const pw = client.escapeLiteral(password);
  if (exists) {
    await client.query(`alter role ${user} with login noinherit nosuperuser nobypassrls password ${pw}`);
  } else {
    await client.query(`create role ${user} with login noinherit nosuperuser nobypassrls password ${pw}`);
  }
  await client.query(`grant authenticated to ${user}`);
  const db = (await client.query<{ db: string }>("select current_database() as db")).rows[0].db;
  await client.query(`grant connect on database ${client.escapeIdentifier(db)} to ${user}`);
  console.log(`[migrate] runtime role "${user}" is ready`);
}

main().catch((error) => {
  console.error("[migrate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
