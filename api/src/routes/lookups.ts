import { Router, type Request } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import { badRequest, forbidden, notFound } from "../errors";
import { cached, CACHE_KEYS, invalidate } from "../redis";
import { insertRow, updateRows } from "../sql";
import { uuidParam } from "./util";

export const lookupsRouter = Router();

// Provinces and cycles are readable by everyone (RLS `using (true)`), so a
// shared Redis cache is safe — no per-role variation in the result.
lookupsRouter.get("/provinces", async (req, res) => {
  const data = await cached(CACHE_KEYS.provinces, 3600, () =>
    asUser(req, (db) => db.rows("select id, name_en, name_kh, code from provinces order by name_en")),
  );
  res.json(data);
});

lookupsRouter.get("/schools", async (req, res) => {
  const data = await asUser(req, (db) =>
    db.rows("select id, school_name from school_partners where deleted_at is null order by school_name"),
  );
  res.json(data);
});

lookupsRouter.get("/cycles", async (req, res) => {
  const data = await cached(CACHE_KEYS.cycles, 60, () =>
    asUser(req, (db) => db.rows("select id, year, name, status from selection_cycles order by year desc")),
  );
  res.json(data);
});

lookupsRouter.get("/cycles/active", async (req, res) => {
  const data = await cached(CACHE_KEYS.activeCycle, 60, () =>
    asUser(req, (db) =>
      db.one("select id, year, name, status from selection_cycles where status = 'active' limit 1"),
    ),
  );
  res.json(data);
});

// ---------------------------------------------------------------------------
// Selection cycle management (one cycle = one generation of students).
// Writes are also enforced by RLS (selection_cycles_write: super_admin,
// program_manager); the explicit check just gives a clean 403.
// ---------------------------------------------------------------------------
function requireCycleManager(req: Request) {
  if (!["super_admin", "program_manager"].includes(req.user?.role ?? "")) throw forbidden();
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
const cycleFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  start_date: dateString,
  end_date: dateString.nullable().optional(),
  exam_pass_threshold: z.number().min(0).max(100),
});

function checkDates(values: { start_date: string; end_date?: string | null }) {
  if (values.end_date && values.end_date < values.start_date) throw badRequest("End date must be after the start date");
}

const clearCycleCache = () => invalidate(CACHE_KEYS.cycles, CACHE_KEYS.activeCycle);

/** Every cycle with its student count, for the Admin → Selection Cycles page. */
lookupsRouter.get("/cycles/manage", async (req, res) => {
  const rows = await asUser(req, (db) =>
    db.rows(
      `select c.id, c.year, c.name, c.status, c.start_date, c.end_date, c.exam_pass_threshold, c.created_at,
         (select count(*)::int from students s where s.cycle_id = c.id and s.deleted_at is null) as student_count
       from selection_cycles c order by c.year desc`,
    ),
  );
  res.json(rows);
});

lookupsRouter.post("/cycles", async (req, res) => {
  requireCycleManager(req);
  const input = cycleFields.extend({ year: z.number().int().min(2000).max(2100) }).parse(req.body);
  checkDates(input);
  const created = await asUser(req, async (db) => {
    const taken = await db.value<boolean>("select exists (select 1 from selection_cycles where year = $1)", [input.year]);
    if (taken) throw badRequest(`A cycle for ${input.year} already exists`);
    // New cycles start in "planning"; making one active is a separate, deliberate step.
    return insertRow(db, "selection_cycles", { ...input, end_date: input.end_date ?? null, status: "planning" }, { returning: true });
  });
  await clearCycleCache();
  res.status(201).json(created);
});

lookupsRouter.patch("/cycles/:id", async (req, res) => {
  requireCycleManager(req);
  const id = uuidParam(req, "id");
  const input = cycleFields.parse(req.body);
  checkDates(input);
  await asUser(req, async (db) => {
    const exists = await db.value<boolean>("select exists (select 1 from selection_cycles where id = $1)", [id]);
    if (!exists) throw notFound("Cycle");
    await updateRows(db, "selection_cycles", { ...input, end_date: input.end_date ?? null }, { id });
  });
  await clearCycleCache();
  res.json({ ok: true });
});

/**
 * Makes this cycle the one every page shows by default and the one new
 * students are added to. The previously active cycle is closed (its data
 * stays, viewable from each page's cycle dropdown). One transaction, so
 * there's never zero or two active cycles.
 */
lookupsRouter.post("/cycles/:id/activate", async (req, res) => {
  requireCycleManager(req);
  const id = uuidParam(req, "id");
  await asUser(req, async (db) => {
    // Lock every cycle row so two admins pressing "Make active" at once run one
    // after the other and can never leave two cycles active.
    const locked = await db.exec("select id from selection_cycles for update");
    if (!locked.rows.some((row: { id: string }) => row.id === id)) throw notFound("Cycle");
    await db.exec("update selection_cycles set status = 'closed' where status = 'active' and id <> $1", [id]);
    await db.exec("update selection_cycles set status = 'active' where id = $1", [id]);
  });
  await clearCycleCache();
  res.json({ ok: true });
});
