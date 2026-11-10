import { Router, type Request } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import type { Db } from "../db";
import { badRequest, HttpError, notFound } from "../errors";
import { deleteRows, insertRow, updateRows } from "../sql";
import { isUuid, Params, qs, toMany, toOne, uuidParam } from "./util";

export const studentsRouter = Router();

const PROVINCE = toOne("provinces", "p", ["name_en"], "p.id = s.province_id", "provinces");
const SCHOOL = toOne("school_partners", "sp", ["school_name"], "sp.id = s.school_id", "school_partners");
const NGO = toOne("ngo_partners", "np", ["organization_name"], "np.id = s.referred_by_ngo_id", "ngo_partners");
const DOCUMENTS = toMany("student_documents", "d", ["doc_type", "file_path", "uploaded_at"], "d.student_id = s.id", "student_documents");

/** students list embed (STUDENT_LIST_SELECT); `visitorParam` narrows the social_assessments embed like `!inner` + eq did. */
function listSelect(visitorParam?: string) {
  const visitorFilter = visitorParam ? ` and sa.visitor_name = ${visitorParam}` : "";
  return `s.*, ${PROVINCE}, ${SCHOOL}, ${NGO},
    ${toOne("committee_decisions", "cd", ["decision", "poor_level"], "cd.student_id = s.id", "committee_decisions")},
    ${toMany("social_assessments", "sa", ["visitor_id", "visitor_name", "visit_number"], `sa.student_id = s.id${visitorFilter}`, "social_assessments")},
    ${DOCUMENTS}`;
}

type ListFilters = {
  cycleId?: string;
  provinceId?: string;
  status?: string;
  gender?: string;
  homeVisitor?: string;
  ngoIds?: string[];
  search?: string;
};

function readFilters(req: Request): ListFilters {
  const ngoIds = qs(req, "ngoIds")?.split(",").filter(isUuid);
  return {
    cycleId: qs(req, "cycleId"),
    provinceId: qs(req, "provinceId"),
    status: qs(req, "status"),
    gender: qs(req, "gender"),
    homeVisitor: qs(req, "homeVisitor"),
    ngoIds: ngoIds && ngoIds.length > 0 ? ngoIds : undefined,
    search: qs(req, "search"),
  };
}

function filterConditions(filters: ListFilters, params: Params, { includeGender = true } = {}) {
  const where = ["s.deleted_at is null"];
  if (filters.cycleId) where.push(`s.cycle_id = ${params.add(filters.cycleId)}`);
  // "__none__" is a sentinel value meaning "province not set"
  if (filters.provinceId === "__none__") where.push("s.province_id is null");
  else if (filters.provinceId) where.push(`s.province_id = ${params.add(filters.provinceId)}`);
  if (filters.status) where.push(`s.status = ${params.add(filters.status)}`);
  if (includeGender && filters.gender) where.push(`s.gender = ${params.add(filters.gender)}`);
  let visitorParam: string | undefined;
  if (filters.homeVisitor) {
    visitorParam = params.add(filters.homeVisitor);
    where.push(`exists (select 1 from social_assessments sa where sa.student_id = s.id and sa.visitor_name = ${visitorParam})`);
  }
  if (filters.ngoIds) where.push(`s.referred_by_ngo_id = any(${params.add(filters.ngoIds)}::uuid[])`);
  if (filters.search) {
    const term = params.add(`%${filters.search}%`);
    where.push(`(s.first_name ilike ${term} or s.last_name ilike ${term} or s.student_code ilike ${term})`);
  }
  return { where: where.join(" and "), visitorParam };
}

studentsRouter.get("/", async (req, res) => {
  const filters = readFilters(req);
  const page = Math.max(1, Number(qs(req, "page") ?? 1) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(qs(req, "pageSize") ?? 25) || 25));

  const result = await asUser(req, async (db) => {
    const params = new Params();
    const { where, visitorParam } = filterConditions(filters, params);
    const total = await db.value<number>(`select count(*) from students s where ${where}`, params.values);
    const limit = params.add(pageSize);
    const offset = params.add((page - 1) * pageSize);
    const data = await db.rows(
      `select ${listSelect(visitorParam)} from students s where ${where}
       order by s.created_at desc limit ${limit} offset ${offset}`,
      params.values,
    );
    return { data, total: total ?? 0 };
  });

  res.json({ ...result, page, pageSize });
});

studentsRouter.get("/gender-counts", async (req, res) => {
  const filters = readFilters(req);
  const counts = await asUser(req, (db) => {
    const params = new Params();
    const { where } = filterConditions(filters, params, { includeGender: false });
    return db.one(
      `select count(*) filter (where s.gender = 'male') as male,
              count(*) filter (where s.gender = 'female') as female,
              count(*) filter (where s.gender not in ('male', 'female')) as other,
              count(*) as total
       from students s where ${where}`,
      params.values,
    );
  });
  res.json(counts);
});

studentsRouter.get("/home-visitors", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  const rows = await asUser(req, (db) => {
    const params = new Params();
    const cycleFilter = cycleId ? ` and sa.cycle_id = ${params.add(cycleId)}` : "";
    return db.rows<{ visitor_name: string }>(
      `select distinct sa.visitor_name from social_assessments sa
       join students s on s.id = sa.student_id
       where sa.visitor_name is not null and sa.visitor_name <> '' and s.deleted_at is null${cycleFilter}`,
      params.values,
    );
  });
  res.json(rows.map((r) => r.visitor_name).sort());
});

studentsRouter.get("/finalists", async (req, res) => {
  const decision = qs(req, "decision");
  if (decision !== "selected" && decision !== "waitlisted") throw badRequest("decision must be selected or waitlisted");
  const cycleId = qs(req, "cycleId");

  const rows = await asUser(req, (db) => {
    const params = new Params();
    const d = params.add(decision);
    const cycleFilter = cycleId ? ` and s.cycle_id = ${params.add(cycleId)}` : "";
    return db.rows(
      `select s.*, ${PROVINCE}, ${SCHOOL}, ${NGO},
         ${toOne("committee_decisions", "cd", ["decision", "poor_level"], `cd.student_id = s.id and cd.decision = ${d}`, "committee_decisions")},
         ${toMany("social_assessments", "sa", ["age", "major", "visit_number"], "sa.student_id = s.id", "social_assessments")}
       from students s
       where s.deleted_at is null
         and exists (select 1 from committee_decisions cd where cd.student_id = s.id and cd.decision = ${d})${cycleFilter}
       order by s.first_name asc`,
      params.values,
    );
  });
  res.json(rows);
});

studentsRouter.get("/trash", async (req, res) => {
  const rows = await asUser(req, (db) =>
    db.rows(`select ${listSelect()} from students s where s.deleted_at is not null order by s.deleted_at desc`),
  );
  res.json(rows);
});

/** Next sequential student code for a cycle year, e.g. ST-26-0123 (see the original note in services/studentService.ts). */
studentsRouter.get("/next-code", async (req, res) => {
  const year = Number(qs(req, "year"));
  if (!Number.isInteger(year)) throw badRequest("year is required");
  const prefix = `ST-${String(year).slice(-2)}-`;
  const last = await asUser(req, (db) =>
    db.value<string>(
      "select student_code from students where student_code like $1 order by student_code desc limit 1",
      [`${prefix}%`],
    ),
  );
  const lastSeq = last ? Number(last.slice(prefix.length)) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  res.json({ code: `${prefix}${String(next).padStart(4, "0")}` });
});

studentsRouter.get("/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const student = await asUser(req, (db) =>
    db.one(
      `select s.*, ${PROVINCE}, ${SCHOOL},
         (select row_to_json(er) from exam_results er where er.student_id = s.id) as exam_results,
         (select row_to_json(iv) from interviews iv where iv.student_id = s.id) as interviews,
         ${toMany("social_assessments", "sa", "*", "sa.student_id = s.id", "social_assessments")},
         ${DOCUMENTS},
         (select row_to_json(cd) from committee_decisions cd where cd.student_id = s.id) as committee_decisions
       from students s where s.id = $1 and s.deleted_at is null`,
      [id],
    ),
  );
  if (!student) throw notFound("Student");
  res.json(student);
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
const DUPLICATE_FIELDS = [
  "dob",
  "phone",
  "province_id",
  "district_name",
  "commune_name",
  "village_name",
  "school_id",
  "referred_by_ngo_id",
  "information_session",
  "exam_center",
  "father_name",
  "mother_name",
  "parent_occupation",
] as const;
const DUPLICATE_NUMERIC_FIELDS = ["family_income_monthly", "siblings_count"] as const;

/**
 * Same name alone isn't suspicious (common in Cambodia), so this only flags
 * a duplicate when every other identifying/demographic field also matches
 * an existing, non-deleted student. excludeId lets editing skip itself.
 */
async function findDuplicateStudent(db: Db, input: Record<string, unknown>, excludeId?: string) {
  const params = new Params();
  const where = [
    "deleted_at is null",
    `first_name ilike ${params.add(String(input.first_name ?? "").trim())}`,
    `last_name ilike ${params.add(String(input.last_name ?? "").trim())}`,
  ];
  if (input.gender) where.push(`gender = ${params.add(input.gender)}`);
  for (const field of DUPLICATE_FIELDS) {
    where.push(input[field] ? `${field} = ${params.add(input[field])}` : `${field} is null`);
  }
  for (const field of DUPLICATE_NUMERIC_FIELDS) {
    where.push(input[field] != null ? `${field} = ${params.add(input[field])}` : `${field} is null`);
  }
  if (excludeId) where.push(`id <> ${params.add(excludeId)}`);

  return db.one<{ id: string; student_code: string; first_name: string; last_name: string }>(
    `select id, student_code, first_name, last_name from students where ${where.join(" and ")} limit 1`,
    params.values,
  );
}

function duplicateError(existing: { id: string; student_code: string; first_name: string; last_name: string }) {
  return new HttpError(
    409,
    `This looks like a duplicate of ${existing.first_name} ${existing.last_name} (${existing.student_code}) — every field matches an existing student.`,
    { duplicate: existing },
  );
}

const body = z.record(z.string(), z.unknown());

studentsRouter.post("/", async (req, res) => {
  const input = body.parse(req.body);
  const created = await asUser(req, async (db) => {
    if (input.first_name && input.last_name) {
      const duplicate = await findDuplicateStudent(db, input);
      if (duplicate) throw duplicateError(duplicate);
    }
    return insertRow(db, "students", input, { returning: true });
  });
  res.status(201).json(created);
});

studentsRouter.post("/bulk-delete", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(req.body);
  if (ids.length > 0) {
    await asUser(req, (db) => updateRows(db, "students", { deleted_at: new Date().toISOString() }, { id: ids }));
  }
  res.json({ ok: true });
});

studentsRouter.patch("/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = body.parse(req.body);
  const updated = await asUser(req, async (db) => {
    if (input.first_name && input.last_name) {
      const duplicate = await findDuplicateStudent(db, input, id);
      if (duplicate) throw duplicateError(duplicate);
    }
    const rows = await updateRows(db, "students", input, { id }, { returning: true });
    return rows[0] ?? null;
  });
  if (!updated) throw notFound("Student");
  res.json(updated);
});

studentsRouter.delete("/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, (db) => updateRows(db, "students", { deleted_at: new Date().toISOString() }, { id }));
  res.json({ ok: true });
});

studentsRouter.post("/:id/restore", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, (db) => updateRows(db, "students", { deleted_at: null }, { id }));
  res.json({ ok: true });
});

/** Irreversible. RLS (0042) restricts this to super_admin regardless of the UI. */
studentsRouter.delete("/:id/permanent", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, (db) => deleteRows(db, "students", { id }));
  res.json({ ok: true });
});
