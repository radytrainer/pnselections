import type { Db } from "./db";
import { badRequest } from "./errors";

/**
 * Generic insert/update/upsert builders that mirror what supabase-js
 * `.insert() / .update() / .upsert()` did: only real, writable columns of
 * the target table are accepted (looked up from information_schema once per
 * process), so a request body can never smuggle in a generated column or a
 * table that isn't named here. Row visibility/permission is still decided by
 * RLS in the database.
 */

const SYSTEM_COLUMNS = new Set(["id", "created_at", "updated_at"]);
const columnCache = new Map<string, Promise<Set<string>>>();

function writableColumns(db: Db, table: string): Promise<Set<string>> {
  let cached = columnCache.get(table);
  if (!cached) {
    cached = db
      .rows<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER'`,
        [table],
      )
      .then((rows) => {
        if (rows.length === 0) throw new Error(`Unknown table ${table}`);
        return new Set(rows.map((r) => r.column_name).filter((c) => !SYSTEM_COLUMNS.has(c)));
      });
    cached.catch(() => columnCache.delete(table));
    columnCache.set(table, cached);
  }
  return cached;
}

export const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

async function pickEntries(db: Db, table: string, data: Row): Promise<[string, unknown][]> {
  const allowed = await writableColumns(db, table);
  return Object.entries(data).filter(([key, value]) => allowed.has(key) && value !== undefined);
}

function whereClause(where: Where, startIndex: number): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of Object.entries(where)) {
    if (Array.isArray(value)) {
      params.push(value);
      parts.push(`${ident(column)} = any($${startIndex + params.length})`);
    } else if (value === null) {
      parts.push(`${ident(column)} is null`);
    } else {
      params.push(value);
      parts.push(`${ident(column)} = $${startIndex + params.length}`);
    }
  }
  if (parts.length === 0) throw new Error("Refusing to run an unfiltered write");
  return { sql: parts.join(" and "), params };
}

/** Runs a data-modifying statement with RETURNING and returns rows as JSON (same shape as Db.rows). */
async function mutateReturning(db: Db, sql: string, params: unknown[]): Promise<Row[]> {
  const result = await db.exec(`with m as (${sql}) select row_to_json(m) as r from m`, params);
  return result.rows.map((row) => row.r as Row);
}

export async function insertRows(
  db: Db,
  table: string,
  rows: Row[],
  options: { onConflict?: string[]; returning?: boolean } = {},
): Promise<Row[]> {
  if (rows.length === 0) return [];
  const allowed = await writableColumns(db, table);
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row).filter((k) => allowed.has(k) && row[k] !== undefined))),
  );
  if (columns.length === 0) throw badRequest("No valid fields to save");

  const params: unknown[] = [];
  const values = rows.map(
    (row) =>
      `(${columns
        .map((column) => {
          if (row[column] === undefined) return "default";
          params.push(row[column]);
          return `$${params.length}`;
        })
        .join(", ")})`,
  );

  let sql = `insert into ${ident(table)} (${columns.map(ident).join(", ")}) values ${values.join(", ")}`;
  if (options.onConflict?.length) {
    const updatable = columns.filter((c) => !options.onConflict!.includes(c));
    sql += ` on conflict (${options.onConflict.map(ident).join(", ")}) `;
    sql += updatable.length
      ? `do update set ${updatable.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`
      : "do nothing";
  }

  if (options.returning) return mutateReturning(db, `${sql} returning *`, params);
  await db.exec(sql, params);
  return [];
}

export async function insertRow(
  db: Db,
  table: string,
  row: Row,
  options: { onConflict?: string[]; returning?: boolean } = {},
): Promise<Row | null> {
  const rows = await insertRows(db, table, [row], options);
  return rows[0] ?? null;
}

export async function updateRows(
  db: Db,
  table: string,
  data: Row,
  where: Where,
  options: { returning?: boolean } = {},
): Promise<Row[]> {
  const entries = await pickEntries(db, table, data);
  if (entries.length === 0) throw badRequest("No valid fields to update");

  const params = entries.map(([, value]) => value);
  const set = entries.map(([column], i) => `${ident(column)} = $${i + 1}`).join(", ");
  const filter = whereClause(where, params.length);
  const sql = `update ${ident(table)} set ${set} where ${filter.sql}`;

  if (options.returning) return mutateReturning(db, `${sql} returning *`, [...params, ...filter.params]);
  await db.exec(sql, [...params, ...filter.params]);
  return [];
}

export async function deleteRows(db: Db, table: string, where: Where) {
  const filter = whereClause(where, 0);
  const result = await db.exec(`delete from ${ident(table)} where ${filter.sql}`, filter.params);
  return result.rowCount ?? 0;
}
