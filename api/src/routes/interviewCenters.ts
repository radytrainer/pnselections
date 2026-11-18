/**
 * Interview centers (Motivation Interview venues) per cycle, and assigning
 * students to them (migration 0058). Assignment goes through the
 * assign_interview_center() function so the interview team can do it too.
 */
import { Router } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import { badRequest, notFound } from "../errors";
import { deleteRows, insertRow, updateRows } from "../sql";
import { qs, uuidParam } from "./util";

export const interviewCentersRouter = Router();
const uuid = z.string().uuid();

interviewCentersRouter.get("/interview-centers", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  if (!cycleId || !uuid.safeParse(cycleId).success) throw badRequest("cycleId is required");
  const rows = await asUser(req, (db) =>
    db.rows(
      `select ic.id, ic.cycle_id, ic.name, ic.province_id, ic.address,
         (select p.name_en from provinces p where p.id = ic.province_id) as province_name,
         (select count(*)::int from students s where s.interview_center_id = ic.id and s.deleted_at is null) as students
       from interview_centers ic where ic.cycle_id = $1 order by ic.name`,
      [cycleId],
    ),
  );
  res.json(rows);
});

const fields = { name: z.string().trim().min(1).max(120), provinceId: uuid.nullish(), address: z.string().trim().max(300).nullish() };

interviewCentersRouter.post("/interview-centers", async (req, res) => {
  const input = z.object({ cycleId: uuid, ...fields }).parse(req.body);
  const row = await asUser(req, async (db) => {
    if (await db.value<boolean>("select exists (select 1 from interview_centers where cycle_id = $1 and lower(name) = lower($2))", [input.cycleId, input.name])) {
      throw badRequest("An interview center with that name already exists");
    }
    return insertRow(
      db,
      "interview_centers",
      { cycle_id: input.cycleId, name: input.name, province_id: input.provinceId ?? null, address: input.address ?? null },
      { returning: true },
    );
  });
  res.status(201).json(row);
});

interviewCentersRouter.patch("/interview-centers/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z.object(fields).partial().parse(req.body);
  await asUser(req, async (db) => {
    const exists = await db.value<boolean>("select exists (select 1 from interview_centers where id = $1)", [id]);
    if (!exists) throw notFound("Interview center");
    await updateRows(db, "interview_centers", { name: input.name, province_id: input.provinceId, address: input.address }, { id });
  });
  res.json({ ok: true });
});

/** Deleting a center un-assigns its students (they keep everything else). */
interviewCentersRouter.delete("/interview-centers/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, (db) => deleteRows(db, "interview_centers", { id }));
  res.json({ ok: true });
});

interviewCentersRouter.post("/interview-centers/assign", async (req, res) => {
  const input = z.object({ studentIds: z.array(uuid).min(1).max(5000), centerId: uuid.nullable() }).parse(req.body);
  const assigned = await asUser(req, (db) => db.value<number>("select assign_interview_center($1::uuid[], $2)", [input.studentIds, input.centerId]));
  res.json({ assigned: assigned ?? 0 });
});
