import { Pool, type PoolClient, types } from "pg";
import { config } from "./config";

// count(*) is int8 — small enough to be a plain JS number for our purposes.
types.setTypeParser(20, (value) => Number(value));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 20),
  idleTimeoutMillis: 30_000,
  // UTC keeps timestamptz JSON output identical to what PostgREST returned
  // ("2026-01-01T10:00:00.123+00:00"), which the frontend already parses.
  options: "-c TimeZone=UTC -c statement_timeout=30000",
});

export type Claims = Record<string, unknown>;

/**
 * Thin query wrapper scoped to one transaction. Row-returning queries go
 * through row_to_json so the response JSON matches what PostgREST produced
 * before (numeric -> number, timestamptz -> ISO string, nested json
 * embeds stay nested) without per-column type juggling.
 */
export class Db {
  constructor(private readonly client: PoolClient) {}

  async rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.client.query(`select row_to_json(t) as r from (${sql}) t`, params);
    return result.rows.map((row) => row.r as T);
  }

  async one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.rows<T>(sql, params);
    return rows[0] ?? null;
  }

  /** Statements whose result rows aren't needed (or that use RETURNING with plain scalar columns). */
  async exec(sql: string, params: unknown[] = []) {
    return this.client.query(sql, params);
  }

  async value<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const result = await this.client.query(sql, params);
    if (result.rows.length === 0) return null;
    return Object.values(result.rows[0])[0] as T;
  }
}

/**
 * Runs `fn` inside a transaction as the non-privileged `authenticated` role
 * with the caller's verified Firebase claims exposed to RLS via auth.jwt().
 * This is the security boundary: every policy from db/migrations applies
 * exactly as it did under Supabase.
 */
export async function withClaims<T>(claims: Claims, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ ...claims, role: "authenticated" }),
    ]);
    const result = await fn(new Db(client));
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Public, unauthenticated reads (no claims => auth_role() = 'anonymous'). RLS still applies. */
export function withAnonymous<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withClaims({}, fn);
}
