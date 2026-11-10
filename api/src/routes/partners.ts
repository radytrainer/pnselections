import { Router } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import type { Db } from "../db";
import { notFound } from "../errors";
import { insertRow, updateRows } from "../sql";
import { toMany, toOne, today, uuidParam } from "./util";

/** NGO and school partners. */
export const partnersRouter = Router();

const body = z.record(z.string(), z.unknown());
const outreachBody = z.object({ outreachStatus: z.string() });
const PROVINCE = (alias: string) => toOne("provinces", "p", ["name_en"], `p.id = ${alias}.province_id`, "provinces");

/** Per-partner stats are aggregated in the service from the active cycle id + raw student rows. */
async function activeCycleId(db: Db) {
  return db.value<string>("select id from selection_cycles where status = 'active' limit 1");
}

// ---------------------------------------------------------------------------
// NGOs
// ---------------------------------------------------------------------------
const NGO_LIST = `select n.*, ${PROVINCE("n")} from ngo_partners n where n.deleted_at is null order by n.organization_name`;

partnersRouter.get("/ngos", async (req, res) => {
  res.json(await asUser(req, (db) => db.rows(NGO_LIST)));
});

partnersRouter.get("/ngos/with-stats", async (req, res) => {
  const result = await asUser(req, async (db) => ({
    ngos: await db.rows(NGO_LIST),
    activeCycleId: await activeCycleId(db),
    students: await db.rows(
      `select s.referred_by_ngo_id, s.cycle_id, s.province_id,
         ${toOne("committee_decisions", "cd", ["decision"], "cd.student_id = s.id", "committee_decisions")}
       from students s where s.referred_by_ngo_id is not null and s.deleted_at is null`,
    ),
  }));
  res.json(result);
});

partnersRouter.get("/ngos/yearly-stats", async (req, res) => {
  res.json(
    await asUser(req, (db) =>
      db.rows(
        `select ${toOne("ngo_partners", "np", ["organization_name"], "np.id = s.referred_by_ngo_id", "ngo_partners")},
           ${toOne("selection_cycles", "c", ["year"], "c.id = s.cycle_id", "selection_cycles")},
           ${toOne("committee_decisions", "cd", ["decision"], "cd.student_id = s.id", "committee_decisions")}
         from students s where s.referred_by_ngo_id is not null and s.deleted_at is null`,
      ),
    ),
  );
});

partnersRouter.get("/ngos/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const ngo = await asUser(req, (db) =>
    db.one(
      `select n.*, ${PROVINCE("n")}, ${toMany("ngo_projects", "pr", "*", "pr.ngo_id = n.id", "ngo_projects")}
       from ngo_partners n where n.id = $1 and n.deleted_at is null`,
      [id],
    ),
  );
  if (!ngo) throw notFound("NGO");
  res.json(ngo);
});

/**
 * Referred vs. selected for one NGO row: every ngo_partners id sharing its
 * organization_name, restricted to students in this row's province (see the
 * grouping note in services/ngoService.ts).
 */
partnersRouter.get("/ngos/:id/performance", async (req, res) => {
  const id = uuidParam(req, "id");
  const result = await asUser(req, async (db) => {
    const ngo = await db.one<{ organization_name: string; province_id: string | null }>(
      "select organization_name, province_id from ngo_partners where id = $1",
      [id],
    );
    if (!ngo) throw notFound("NGO");
    const provinceFilter = ngo.province_id ? "s.province_id = $2" : "s.province_id is null";
    const params: unknown[] = [ngo.organization_name];
    if (ngo.province_id) params.push(ngo.province_id);
    return db.one<{ referred: number; selected: number }>(
      `select count(*) as referred,
              count(*) filter (where exists (
                select 1 from committee_decisions cd where cd.student_id = s.id and cd.decision = 'selected'
              )) as selected
       from students s
       where s.deleted_at is null and ${provinceFilter}
         and s.referred_by_ngo_id in (select id from ngo_partners where organization_name = $1 and deleted_at is null)`,
      params,
    );
  });
  res.json(result);
});

partnersRouter.post("/ngos", async (req, res) => {
  res.status(201).json(await asUser(req, (db) => insertRow(db, "ngo_partners", body.parse(req.body), { returning: true })));
});

partnersRouter.patch("/ngos/:id/outreach", async (req, res) => {
  const id = uuidParam(req, "id");
  const { outreachStatus } = outreachBody.parse(req.body);
  await asUser(req, (db) =>
    updateRows(db, "ngo_partners", { outreach_status: outreachStatus, last_contacted_at: today() }, { id }),
  );
  res.json({ ok: true });
});

partnersRouter.patch("/ngos/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const rows = await asUser(req, (db) => updateRows(db, "ngo_partners", body.parse(req.body), { id }, { returning: true }));
  if (!rows[0]) throw notFound("NGO");
  res.json(rows[0]);
});

partnersRouter.delete("/ngos/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, (db) => updateRows(db, "ngo_partners", { deleted_at: new Date().toISOString() }, { id }));
  res.json({ ok: true });
});

partnersRouter.post("/ngos/:id/projects", async (req, res) => {
  const ngoId = uuidParam(req, "id");
  const { name, description } = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
  const created = await asUser(req, (db) =>
    insertRow(db, "ngo_projects", { ngo_id: ngoId, name, description: description || null }, { returning: true }),
  );
  res.status(201).json(created);
});

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------
const SCHOOL_LIST = `select sc.*, ${PROVINCE("sc")} from school_partners sc where sc.deleted_at is null order by sc.school_name`;

partnersRouter.get("/schools", async (req, res) => {
  res.json(await asUser(req, (db) => db.rows(SCHOOL_LIST)));
});

partnersRouter.get("/schools/with-stats", async (req, res) => {
  const result = await asUser(req, async (db) => ({
    schools: await db.rows(SCHOOL_LIST),
    activeCycleId: await activeCycleId(db),
    students: await db.rows(
      `select s.school_id, s.cycle_id,
         ${toOne("committee_decisions", "cd", ["decision"], "cd.student_id = s.id", "committee_decisions")}
       from students s where s.school_id is not null and s.deleted_at is null`,
    ),
  }));
  res.json(result);
});

partnersRouter.get("/schools/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const school = await asUser(req, (db) =>
    db.one(`select sc.*, ${PROVINCE("sc")} from school_partners sc where sc.id = $1 and sc.deleted_at is null`, [id]),
  );
  if (!school) throw notFound("School");
  res.json(school);
});

partnersRouter.get("/schools/:id/performance", async (req, res) => {
  const id = uuidParam(req, "id");
  const result = await asUser(req, (db) =>
    db.one(
      `select count(*) as referred,
              count(*) filter (where exists (
                select 1 from committee_decisions cd where cd.student_id = s.id and cd.decision = 'selected'
              )) as selected
       from students s where s.school_id = $1 and s.deleted_at is null`,
      [id],
    ),
  );
  res.json(result);
});

partnersRouter.post("/schools", async (req, res) => {
  res.status(201).json(await asUser(req, (db) => insertRow(db, "school_partners", body.parse(req.body), { returning: true })));
});

partnersRouter.patch("/schools/:id/outreach", async (req, res) => {
  const id = uuidParam(req, "id");
  const { outreachStatus } = outreachBody.parse(req.body);
  await asUser(req, (db) =>
    updateRows(db, "school_partners", { outreach_status: outreachStatus, last_contacted_at: today() }, { id }),
  );
  res.json({ ok: true });
});

partnersRouter.patch("/schools/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const rows = await asUser(req, (db) => updateRows(db, "school_partners", body.parse(req.body), { id }, { returning: true }));
  if (!rows[0]) throw notFound("School");
  res.json(rows[0]);
});

partnersRouter.delete("/schools/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, (db) => updateRows(db, "school_partners", { deleted_at: new Date().toISOString() }, { id }));
  res.json({ ok: true });
});
