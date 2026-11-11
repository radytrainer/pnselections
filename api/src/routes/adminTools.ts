import { Router, type Request } from "express";
import { asUser } from "../auth";
import type { Db } from "../db";
import { forbidden, notFound } from "../errors";
import { Params, isUuid, qs, uuidParam } from "./util";

/**
 * Configuration → Audit Logs and Configuration → Backup.
 * Every query still runs under the caller's own claims (RLS): audit_logs is
 * readable by super_admin/program_manager only (0001 audit_admin_only), and
 * the backup reads exactly what a super_admin can see.
 */
export const adminToolsRouter = Router();

function requireRole(req: Request, roles: string[]) {
  if (!roles.includes(req.user?.role ?? "")) throw forbidden();
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

/**
 * The student a log row is about: the row itself for `students`, otherwise
 * the `student_id` stored in the logged data (social forms, exams, votes...),
 * or — for interview answers — the student of the parent interview.
 */
const SUBJECT_STUDENT_ID = `
  case
    when a.table_name = 'students' then a.record_id
    when coalesce(a.new_data, a.old_data) ->> 'student_id' ~* '^[0-9a-f-]{36}$'
      then (coalesce(a.new_data, a.old_data) ->> 'student_id')::uuid
    when a.table_name = 'interview_answers'
      then (select iv.student_id from interviews iv
            where iv.id::text = coalesce(a.new_data, a.old_data) ->> 'interview_id')
  end`;

/** Fields whose value differs between old and new (updates only), minus bookkeeping columns. */
const CHANGED_FIELDS = `
  case when a.action in ('update', 'soft_delete') then (
    select coalesce(array_agg(n.key order by n.key), '{}')
    from jsonb_each(a.new_data) n
    where n.value is distinct from a.old_data -> n.key
      and n.key not in ('updated_at')
  ) end`;

function auditFilters(req: Request, params: Params) {
  const where: string[] = [];
  const table = qs(req, "table");
  if (table) where.push(`a.table_name = ${params.add(table)}`);
  const action = qs(req, "action");
  if (action === "delete") where.push(`a.action in ('delete', 'soft_delete')`);
  else if (action) where.push(`a.action = ${params.add(action)}`);
  const userId = qs(req, "userId");
  if (userId === "system") where.push("a.changed_by is null");
  else if (isUuid(userId)) where.push(`a.changed_by = ${params.add(userId)}`);
  const from = qs(req, "from");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) where.push(`a.changed_at >= ${params.add(from)}::date`);
  const to = qs(req, "to");
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) where.push(`a.changed_at < ${params.add(to)}::date + 1`);
  const search = qs(req, "search")?.trim();
  if (search) {
    const term = params.add(`%${search}%`);
    where.push(`(
      u.full_name ilike ${term} or u.email ilike ${term}
      or s.first_name || ' ' || s.last_name ilike ${term} or s.student_code ilike ${term}
      or coalesce(a.new_data, a.old_data) ->> 'organization_name' ilike ${term}
      or coalesce(a.new_data, a.old_data) ->> 'school_name' ilike ${term}
      or coalesce(a.new_data, a.old_data) ->> 'full_name' ilike ${term}
      or coalesce(a.new_data, a.old_data) ->> 'name' ilike ${term}
    )`);
  }
  return where.length ? `where ${where.join(" and ")}` : "";
}

const AUDIT_FROM = `
  from audit_logs a
  left join users u on u.id = a.changed_by
  left join students s on s.id = (${SUBJECT_STUDENT_ID})`;

adminToolsRouter.get("/audit-logs", async (req, res) => {
  requireRole(req, ["super_admin", "program_manager"]);
  const page = Math.max(1, Number(qs(req, "page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(qs(req, "pageSize") ?? 50) || 50));

  const result = await asUser(req, async (db) => {
    const params = new Params();
    const where = auditFilters(req, params);
    const total = await db.value<number>(`select count(*) ${AUDIT_FROM} ${where}`, params.values);
    const limit = params.add(pageSize);
    const offset = params.add((page - 1) * pageSize);
    const rows = await db.rows(
      `select a.id, a.table_name, a.record_id, a.action, a.changed_at,
         case when u.id is null then null else json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) end as actor,
         case when s.id is null then null else json_build_object('id', s.id, 'name', s.first_name || ' ' || s.last_name, 'code', s.student_code) end as student,
         coalesce(
           coalesce(a.new_data, a.old_data) ->> 'organization_name',
           coalesce(a.new_data, a.old_data) ->> 'school_name',
           coalesce(a.new_data, a.old_data) ->> 'full_name',
           coalesce(a.new_data, a.old_data) ->> 'name',
           coalesce(a.new_data, a.old_data) ->> 'text_en'
         ) as label,
         ${CHANGED_FIELDS} as changed_fields
       ${AUDIT_FROM} ${where}
       order by a.changed_at desc, a.id desc
       limit ${limit} offset ${offset}`,
      params.values,
    );
    return { rows, total: total ?? 0 };
  });
  res.json({ ...result, page, pageSize });
});

/** Filter options: who has activity, and which areas appear in the log. */
adminToolsRouter.get("/audit-logs/meta", async (req, res) => {
  requireRole(req, ["super_admin", "program_manager"]);
  const result = await asUser(req, async (db) => ({
    users: await db.rows(
      `select u.id, u.full_name, u.email from users u
       where exists (select 1 from audit_logs a where a.changed_by = u.id)
       order by u.full_name`,
    ),
    tables: (await db.rows<{ table_name: string }>("select distinct table_name from audit_logs order by 1")).map(
      (r) => r.table_name,
    ),
  }));
  res.json(result);
});

adminToolsRouter.get("/audit-logs/:id", async (req, res) => {
  requireRole(req, ["super_admin", "program_manager"]);
  const id = uuidParam(req, "id");
  const row = await asUser(req, (db) =>
    db.one(
      `select a.id, a.table_name, a.record_id, a.action, a.changed_at, a.old_data, a.new_data,
         case when u.id is null then null else json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) end as actor,
         case when s.id is null then null else json_build_object('id', s.id, 'name', s.first_name || ' ' || s.last_name, 'code', s.student_code) end as student
       ${AUDIT_FROM}
       where a.id = $1`,
      [id],
    ),
  );
  if (!row) throw notFound("Audit log entry");
  res.json(row);
});

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Tables that are schema bookkeeping, not data. */
const SKIP_TABLES = new Set(["schema_migrations"]);

async function listTables(db: Db) {
  const tables = await db.rows<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  return tables.map((t) => t.table_name).filter((t) => !SKIP_TABLES.has(t));
}

async function insertableColumns(db: Db, table: string) {
  const cols = await db.rows<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER'
     order by ordinal_position`,
    [table],
  );
  return cols.map((c) => c.column_name);
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Runs `fn` for one table inside a savepoint so a table this role can't read
 * is reported as skipped instead of aborting the whole backup.
 */
async function perTable<T>(db: Db, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  await db.exec("savepoint backup_table");
  try {
    const value = await fn();
    await db.exec("release savepoint backup_table");
    return { ok: true, value };
  } catch (error) {
    await db.exec("rollback to savepoint backup_table");
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function requestedTables(req: Request, all: string[]) {
  const wanted = qs(req, "tables")?.split(",").filter(Boolean);
  return wanted ? all.filter((t) => wanted.includes(t)) : all;
}

adminToolsRouter.get("/backup/tables", async (req, res) => {
  requireRole(req, ["super_admin"]);
  const result = await asUser(req, async (db) => {
    const out: { name: string; rows: number | null }[] = [];
    for (const table of await listTables(db)) {
      const count = await perTable(db, () => db.value<number>(`select count(*) from ${ident(table)}`));
      out.push({ name: table, rows: count.ok ? (count.value ?? 0) : null });
    }
    return out;
  });
  res.json(result);
});

/**
 * Data-only SQL dump: INSERT statements for every table, restorable onto a
 * database that already has the schema (db/migrations). Values are rendered
 * by Postgres itself (quote_nullable), so every type round-trips exactly.
 */
adminToolsRouter.get("/backup/sql", async (req, res) => {
  requireRole(req, ["super_admin"]);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const chunks: string[] = [];
  const summary: string[] = [];
  let dumped: string[] = [];
  await asUser(req, async (db) => {
    const tables = requestedTables(req, await listTables(db));
    dumped = tables;
    for (const table of tables) {
      const cols = await insertableColumns(db, table);
      if (cols.length === 0) continue;
      const result = await perTable(db, () =>
        db.exec(
          `select '(' || concat_ws(', ', ${cols.map((c) => `quote_nullable(${ident(c)}::text)`).join(", ")}) || ')' as v
           from ${ident(table)}`,
        ),
      );
      if (!result.ok) {
        summary.push(`--   ${table}: SKIPPED (${result.error})`);
        continue;
      }
      const rows = result.value.rows as { v: string }[];
      summary.push(`--   ${table}: ${rows.length} rows`);
      if (rows.length === 0) continue;
      const head = `insert into public.${ident(table)} (${cols.map(ident).join(", ")}) values\n`;
      chunks.push(`\n-- ${table} (${rows.length} rows)\n`);
      for (let i = 0; i < rows.length; i += 500) {
        chunks.push(head + rows.slice(i, i + 500).map((r) => `  ${r.v}`).join(",\n") + "\non conflict do nothing;\n");
      }
    }
  });

  const header = [
    "-- PN Selection Tracker — data backup",
    `-- Created: ${new Date().toISOString()} by ${String(req.user?.claims.email ?? req.user?.uid ?? "unknown")}`,
    "--",
    "-- Data only (INSERT statements). To restore into a new, empty database:",
    "--   1. Create the schema with the app's migrations (npm run db:migrate).",
    "--   2. The migrations add some starter rows (provinces, roles, default interview",
    "--      questions...). To restore an exact copy, uncomment the TRUNCATE line",
    "--      below so those are replaced by the rows in this file.",
    "--   3. Run this file as a superuser:",
    "--        psql -v ON_ERROR_STOP=1 -U postgres -d scholarship -f this-file.sql",
    "-- Rows that already exist are skipped (on conflict do nothing).",
    "-- User sign-in accounts live in Firebase, not here: restored users keep their",
    "-- profile and role, but their Firebase login must still exist.",
    "--",
    "-- Tables:",
    ...summary,
    "",
    "begin;",
    "set local session_replication_role = replica; -- skip FK/trigger checks while loading",
    `-- truncate ${dumped.map((t) => `public.${ident(t)}`).join(", ")} cascade;`,
    "",
  ].join("\n");

  res.setHeader("Content-Type", "application/sql; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="pn-selection-backup-${stamp}.sql"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(header + chunks.join("") + "\ncommit;\n");
});

/** Raw rows per table as JSON — the browser turns this into the Excel workbook. */
adminToolsRouter.get("/backup/data", async (req, res) => {
  requireRole(req, ["super_admin"]);
  const result = await asUser(req, async (db) => {
    const tables = requestedTables(req, await listTables(db));
    const out: { name: string; columns: string[]; rows: Record<string, unknown>[]; error?: string }[] = [];
    for (const table of tables) {
      const cols = await insertableColumns(db, table);
      const rows = await perTable(db, () => db.rows(`select * from ${ident(table)}`));
      out.push(
        rows.ok ? { name: table, columns: cols, rows: rows.value } : { name: table, columns: cols, rows: [], error: rows.error },
      );
    }
    return out;
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ createdAt: new Date().toISOString(), tables: result });
});
