import { Router } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import type { Db } from "../db";
import { badRequest, forbidden, HttpError, notFound } from "../errors";
import { deleteRows, insertRow, insertRows, updateRows } from "../sql";
import { qs, uuidParam } from "./util";

/**
 * Written exams (migration 0052): papers, answer keys, subjects, ZipGrade
 * imports, candidates and pass rules for one selection cycle.
 *
 * Scoring is deliberately not done here — the client calculates scores from
 * the raw answers and the current key (features/written-exam/scoring.ts), so
 * key corrections and pass-mark changes take effect without rewriting rows.
 * RLS limits every table to super_admin / program_manager / selection_team.
 */
export const writtenExamsRouter = Router();

const uuid = z.string().uuid();
const letters = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-J](,[A-J])*$/, "Answer must be letters like B or A,B");

async function currentUserId(db: Db) {
  return db.value<string>("select id from users where firebase_uid = (auth.jwt() ->> 'sub')");
}

/** Throws when the cycle's results are locked (rules/keys/imports frozen). */
async function assertUnlocked(db: Db, cycleId: string) {
  const locked = await db.value<boolean>("select exam_rules_locked from selection_cycles where id = $1", [cycleId]);
  if (locked == null) throw notFound("Cycle");
  if (locked) throw new HttpError(409, "Exam results are locked for this cycle. A Super Admin must unlock them first.");
}

async function paperCycle(db: Db, paperId: string) {
  const cycleId = await db.value<string>("select cycle_id from exam_papers where id = $1", [paperId]);
  if (!cycleId) throw notFound("Exam paper");
  return cycleId;
}

// ---------------------------------------------------------------------------
// Everything for one cycle (the client scores it)
// ---------------------------------------------------------------------------
writtenExamsRouter.get("/written-exams", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  if (!cycleId || !uuid.safeParse(cycleId).success) throw badRequest("cycleId is required");
  const data = await asUser(req, async (db) => {
    const cycle = await db.one("select id, name, year, exam_rules_locked from selection_cycles where id = $1", [cycleId]);
    if (!cycle) throw notFound("Cycle");
    const papers = await db.rows(
      `select p.*,
         coalesce((select json_agg(q order by q.number) from exam_questions q where q.paper_id = p.id), '[]'::json) as questions,
         coalesce((select json_agg(s order by s.sort_order, s.from_question) from exam_subjects s where s.paper_id = p.id), '[]'::json) as subjects,
         coalesce((select json_agg(v order by v.version) from exam_key_versions v where v.paper_id = p.id), '[]'::json) as key_versions,
         (select row_to_json(i) from exam_imports i where i.paper_id = p.id order by i.created_at desc limit 1) as last_import
       from exam_papers p where p.cycle_id = $1 order by p.sort_order, p.created_at`,
      [cycleId],
    );
    const centers = await db.rows(
      `select ce.*,
         coalesce((select json_agg(r order by r.sort_order, r.name) from exam_rooms r where r.center_id = ce.id), '[]'::json) as rooms,
         coalesce((select json_agg(s order by s.session_date, s.start_time) from exam_sessions s where s.center_id = ce.id), '[]'::json) as sessions,
         (select p.name_en from provinces p where p.id = ce.province_id) as province_name
       from exam_centers ce where ce.cycle_id = $1 order by ce.name`,
      [cycleId],
    );
    const candidates = await db.rows(
      `select c.id, c.exam_number, c.full_name, c.student_id, c.excluded, c.exclude_reason,
         c.gender, c.center_id, c.session_id, c.room_id,
         c.first_name, c.last_name, c.dob, c.high_school, c.province, c.ngo,
         (select json_build_object('id', s.id, 'name', s.first_name || ' ' || s.last_name, 'code', s.student_code,
                                   'status', s.status, 'gender', s.gender,
                                   'first_name', s.first_name, 'last_name', s.last_name, 'dob', s.dob,
                                   'school', (select sp.school_name from school_partners sp where sp.id = s.school_id),
                                   'province', (select pr.name_en from provinces pr where pr.id = s.province_id),
                                   'ngo', (select n.organization_name from ngo_partners n where n.id = s.referred_by_ngo_id))
            from students s where s.id = c.student_id) as student
       from exam_candidates c where c.cycle_id = $1 order by c.exam_number`,
      [cycleId],
    );
    const sheets = await db.rows(
      `select sh.id, sh.paper_id, sh.candidate_id, sh.answers, sh.name_on_sheet, sh.zip_earned, sh.zip_possible, sh.key_version
       from exam_sheets sh join exam_papers p on p.id = sh.paper_id where p.cycle_id = $1`,
      [cycleId],
    );
    const rules = await db.rows("select * from exam_rules where cycle_id = $1 order by sort_order, created_at", [cycleId]);
    const overrides = await db.rows(
      `select o.candidate_id, o.paper_id, o.score, o.reason, o.updated_at
       from exam_score_overrides o join exam_papers p on p.id = o.paper_id where p.cycle_id = $1`,
      [cycleId],
    );
    return { cycle, papers, candidates, sheets, rules, centers, overrides };
  });
  res.json(data);
});

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------
writtenExamsRouter.post("/written-exams/papers", async (req, res) => {
  const input = z.object({ cycleId: uuid, name: z.string().trim().min(1).max(80) }).parse(req.body);
  const paper = await asUser(req, async (db) => {
    await assertUnlocked(db, input.cycleId);
    const order = (await db.value<number>("select count(*) from exam_papers where cycle_id = $1", [input.cycleId])) ?? 0;
    return insertRow(
      db,
      "exam_papers",
      { cycle_id: input.cycleId, name: input.name, sort_order: order, created_by: await currentUserId(db) },
      { returning: true },
    );
  });
  res.status(201).json(paper);
});

writtenExamsRouter.patch("/written-exams/papers/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
  await asUser(req, async (db) => {
    await assertUnlocked(db, await paperCycle(db, id));
    await updateRows(db, "exam_papers", { name: input.name }, { id });
  });
  res.json({ ok: true });
});

writtenExamsRouter.delete("/written-exams/papers/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, async (db) => {
    await assertUnlocked(db, await paperCycle(db, id));
    await deleteRows(db, "exam_papers", { id });
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Answer key + subjects
// ---------------------------------------------------------------------------
const questionInput = z.object({
  number: z.number().int().min(1).max(500),
  answer: letters,
  points: z.number().min(0).max(100).default(1),
  options: z.number().int().min(2).max(10).default(4),
  topic: z.string().trim().max(120).nullish(),
  cancelled: z.boolean().default(false),
});

/** Replaces the whole key (new upload). */
writtenExamsRouter.put("/written-exams/papers/:id/key", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z.object({ questions: z.array(questionInput).min(1).max(500) }).parse(req.body);
  const numbers = new Set(input.questions.map((q) => q.number));
  if (numbers.size !== input.questions.length) throw badRequest("Each question number may appear only once");
  await asUser(req, async (db) => {
    await assertUnlocked(db, await paperCycle(db, id));
    await deleteRows(db, "exam_questions", { paper_id: id });
    await insertRows(
      db,
      "exam_questions",
      input.questions.map((q) => ({ paper_id: id, ...q, topic: q.topic || null })),
    );
  });
  res.json({ ok: true, questions: input.questions.length });
});

/**
 * Saves one answer-key version (e.g. shuffled paper "B"). answers[i] is the key
 * for question i+1 on that version's sheet; questionMap[i] the main question it is.
 */
writtenExamsRouter.put("/written-exams/papers/:id/versions/:version", async (req, res) => {
  const id = uuidParam(req, "id");
  const version = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{1,10}$/, "Version must be letters or digits, e.g. B")
    .parse(req.params.version)
    .toUpperCase();
  const input = z
    .object({
      answers: z.array(letters).min(1).max(500),
      questionMap: z.array(z.number().int().min(1).max(500)).min(1).max(500),
    })
    .parse(req.body);
  if (input.answers.length !== input.questionMap.length) throw badRequest("Each question needs both an answer and a main question number");
  if (new Set(input.questionMap).size !== input.questionMap.length) throw badRequest("Two questions on this version point to the same main question");
  await asUser(req, async (db) => {
    await assertUnlocked(db, await paperCycle(db, id));
    const main = new Set(
      (await db.rows<{ number: number }>("select number from exam_questions where paper_id = $1", [id])).map((q) => q.number),
    );
    if (!main.size) throw badRequest("Upload the main answer key first");
    const unknown = input.questionMap.filter((n) => !main.has(n));
    if (unknown.length) throw badRequest(`Main question ${unknown.slice(0, 5).join(", ")} isn't in the main key`);
    await insertRow(
      db,
      "exam_key_versions",
      { paper_id: id, version, answers: input.answers, question_map: input.questionMap },
      { onConflict: ["paper_id", "version"] },
    );
  });
  res.json({ ok: true });
});

writtenExamsRouter.delete("/written-exams/papers/:id/versions/:version", async (req, res) => {
  const id = uuidParam(req, "id");
  const version = String(req.params.version).toUpperCase();
  await asUser(req, async (db) => {
    await assertUnlocked(db, await paperCycle(db, id));
    await deleteRows(db, "exam_key_versions", { paper_id: id, version });
  });
  res.json({ ok: true });
});

/** Correct one question: accepted answer(s), cancel/restore, topic or points. */
writtenExamsRouter.patch("/written-exams/questions/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z
    .object({
      answer: letters.optional(),
      cancelled: z.boolean().optional(),
      topic: z.string().trim().max(120).nullish(),
      points: z.number().min(0).max(100).optional(),
    })
    .parse(req.body);
  await asUser(req, async (db) => {
    const paperId = await db.value<string>("select paper_id from exam_questions where id = $1", [id]);
    if (!paperId) throw notFound("Question");
    await assertUnlocked(db, await paperCycle(db, paperId));
    await updateRows(db, "exam_questions", { ...input, topic: input.topic === undefined ? undefined : input.topic || null }, { id });
  });
  res.json({ ok: true });
});

/**
 * Saves the subject list. Existing subjects (with id) are updated in place so
 * pass rules pointing at them survive; missing ones are deleted.
 */
writtenExamsRouter.put("/written-exams/papers/:id/subjects", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z
    .object({
      subjects: z
        .array(
          z
            .object({
              id: uuid.optional(),
              name: z.string().trim().min(1).max(60),
              fromQuestion: z.number().int().min(1),
              toQuestion: z.number().int().min(1),
            })
            .refine((s) => s.toQuestion >= s.fromQuestion, "A subject's last question must come after its first"),
        )
        .max(20),
    })
    .parse(req.body);
  await asUser(req, async (db) => {
    await assertUnlocked(db, await paperCycle(db, id));
    const existing = await db.rows<{ id: string }>("select id from exam_subjects where paper_id = $1", [id]);
    const keep = new Set(input.subjects.map((s) => s.id).filter(Boolean));
    for (const e of existing) if (!keep.has(e.id)) await deleteRows(db, "exam_subjects", { id: e.id });
    for (const [i, s] of input.subjects.entries()) {
      const row = { name: s.name, from_question: s.fromQuestion, to_question: s.toQuestion, sort_order: i };
      if (s.id && existing.some((e) => e.id === s.id)) await updateRows(db, "exam_subjects", row, { id: s.id });
      else await insertRow(db, "exam_subjects", { ...row, paper_id: id });
    }
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// ZipGrade import (already reviewed in the browser)
// ---------------------------------------------------------------------------
const importInput = z.object({
  fileName: z.string().max(255).optional(),
  rowsInFile: z.number().int().min(0),
  summary: z.record(z.string(), z.unknown()).default({}),
  /** Only used when the paper has no key yet: the key read from the file's PriKey columns. */
  keyFromFile: z.array(z.object({ number: z.number().int().min(1), answer: letters })).optional(),
  sheets: z
    .array(
      z.object({
        examNumber: z.string().regex(/^[0-9]{1,12}$/),
        name: z.string().trim().max(200).optional(),
        answers: z.array(z.string().max(10)).min(1).max(500),
        zipEarned: z.number().nullish(),
        zipPossible: z.number().nullish(),
        keyVersion: z.string().max(20).nullish(),
      }),
    )
    .min(1)
    .max(5000),
  /**
   * merge (default): add these sheets and replace only the same exam numbers,
   * so each exam center's file can be imported separately.
   * replace: delete every sheet of the paper first (a full re-import).
   */
  mode: z.enum(["merge", "replace"]).default("merge"),
});

/** Saves imported sheets: merges by exam number, or replaces the paper's sheets (mode). */
writtenExamsRouter.post("/written-exams/papers/:id/import", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = importInput.parse(req.body);
  if (new Set(input.sheets.map((s) => canonical(s.examNumber))).size !== input.sheets.length) {
    throw badRequest("Each exam number may appear only once — resolve duplicates first");
  }

  const result = await asUser(req, async (db) => {
    const cycleId = await paperCycle(db, id);
    // Use the existing spelling of each number ("7" in the file = candidate "0007").
    const existing = await existingByValue(db, cycleId, input.sheets.map((s) => s.examNumber));
    for (const s of input.sheets) s.examNumber = existing.get(canonical(s.examNumber)) ?? s.examNumber;
    const numbers = input.sheets.map((s) => s.examNumber);
    await assertUnlocked(db, cycleId);
    const userId = await currentUserId(db);

    const hasKey = (await db.value<number>("select count(*) from exam_questions where paper_id = $1", [id])) ?? 0;
    if (!hasKey) {
      if (!input.keyFromFile?.length) throw badRequest("This paper has no answer key yet — upload one or use the key from the file");
      await insertRows(
        db,
        "exam_questions",
        input.keyFromFile.map((q) => ({ paper_id: id, number: q.number, answer: q.answer, points: 1, options: 4 })),
      );
    }

    // Candidates: create missing ones; keep existing names (the first import names them).
    await insertRows(
      db,
      "exam_candidates",
      input.sheets.map((s) => ({ cycle_id: cycleId, exam_number: s.examNumber })),
      { onConflict: ["cycle_id", "exam_number"] },
    );
    await db.exec(
      `update exam_candidates c set full_name = v.name
       from unnest($2::text[], $3::text[]) as v(num, name)
       where c.cycle_id = $1 and c.exam_number = v.num and c.full_name is null and v.name <> ''`,
      [cycleId, input.sheets.map((s) => s.examNumber), input.sheets.map((s) => s.name ?? "")],
    );
    const ids = await db.rows<{ id: string; exam_number: string }>(
      "select id, exam_number from exam_candidates where cycle_id = $1 and exam_number = any($2::text[])",
      [cycleId, numbers],
    );
    const idByNumber = new Map(ids.map((r) => [r.exam_number, r.id]));

    const imp = await insertRow(
      db,
      "exam_imports",
      {
        paper_id: id,
        file_name: input.fileName ?? null,
        rows_in_file: input.rowsInFile,
        sheets_saved: input.sheets.length,
        summary: JSON.stringify(input.summary),
        imported_by: userId,
      },
      { returning: true },
    );

    let replaced = 0;
    if (input.mode === "replace") {
      replaced = (await db.value<number>("select count(*)::int from exam_sheets where paper_id = $1", [id])) ?? 0;
      await deleteRows(db, "exam_sheets", { paper_id: id });
    } else {
      const r = await db.exec("delete from exam_sheets where paper_id = $1 and candidate_id = any($2::uuid[])", [id, [...idByNumber.values()]]);
      replaced = r.rowCount ?? 0;
    }
    // Insert in chunks to keep each statement's parameter count reasonable.
    for (let i = 0; i < input.sheets.length; i += 300) {
      await insertRows(
        db,
        "exam_sheets",
        input.sheets.slice(i, i + 300).map((s) => ({
          paper_id: id,
          candidate_id: idByNumber.get(s.examNumber),
          answers: s.answers.map((a) => a.toUpperCase()),
          name_on_sheet: s.name ?? null,
          zip_earned: s.zipEarned ?? null,
          zip_possible: s.zipPossible ?? null,
          key_version: s.keyVersion ?? null,
          import_id: imp?.id,
        })),
      );
    }
    const total = (await db.value<number>("select count(*)::int from exam_sheets where paper_id = $1", [id])) ?? 0;
    return { saved: input.sheets.length, replaced, total, keyCreated: !hasKey };
  });
  res.json(result);
});

// ---------------------------------------------------------------------------
// Pass rules
// ---------------------------------------------------------------------------
writtenExamsRouter.put("/written-exams/rules", async (req, res) => {
  const input = z
    .object({
      cycleId: uuid,
      rules: z
        .array(
          z.object({
            paperId: uuid,
            subjectId: uuid.nullable(),
            minValue: z.number().min(0),
            unit: z.enum(["points", "percent"]),
            orPrevious: z.boolean().default(false),
          }),
        )
        .max(30),
    })
    .parse(req.body);
  for (const r of input.rules) if (r.unit === "percent" && r.minValue > 100) throw badRequest("A percentage can't be above 100");
  await asUser(req, async (db) => {
    await assertUnlocked(db, input.cycleId);
    const paperIds = new Set(
      (await db.rows<{ id: string }>("select id from exam_papers where cycle_id = $1", [input.cycleId])).map((p) => p.id),
    );
    if (input.rules.some((r) => !paperIds.has(r.paperId))) throw badRequest("A rule points to a paper from another cycle");
    await deleteRows(db, "exam_rules", { cycle_id: input.cycleId });
    await insertRows(
      db,
      "exam_rules",
      input.rules.map((r, i) => ({
        cycle_id: input.cycleId,
        sort_order: i,
        paper_id: r.paperId,
        subject_id: r.subjectId,
        min_value: r.minValue,
        unit: r.unit,
        or_previous: i > 0 && r.orPrevious,
      })),
    );
  });
  res.json({ ok: true });
});

/**
 * Lock results once announced. Locking: super_admin / program_manager (the
 * roles selection_cycles' RLS lets update a cycle). Unlocking: super_admin only.
 */
writtenExamsRouter.post("/written-exams/lock", async (req, res) => {
  const input = z.object({ cycleId: uuid, locked: z.boolean() }).parse(req.body);
  if (!input.locked && req.user?.role !== "super_admin") throw forbidden("Only a Super Admin can unlock exam results");
  if (!["super_admin", "program_manager"].includes(req.user?.role ?? "")) {
    throw forbidden("Only a Super Admin or Program Manager can lock exam results");
  }
  await asUser(req, (db) => updateRows(db, "selection_cycles", { exam_rules_locked: input.locked }, { id: input.cycleId }));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------
const gender = z.enum(["male", "female", "lgbtqia+"]);

/** Exam numbers compare by value: Excel turns "0001" into 1, so "1" = "01" = "0001". */
const canonical = (n: string) => n.trim().replace(/^0+(?=\d)/, "");

/** Existing candidates whose number has the same value as one of these, keyed by canonical value. */
async function existingByValue(db: Db, cycleId: string, numbers: string[]) {
  if (!numbers.length) return new Map<string, string>();
  const rows = await db.rows<{ exam_number: string }>(
    `select exam_number from exam_candidates
     where cycle_id = $1 and regexp_replace(exam_number, '^0+(?=\\d)', '') = any($2::text[])`,
    [cycleId, [...new Set(numbers.map(canonical))]],
  );
  return new Map(rows.map((r) => [canonical(r.exam_number), r.exam_number]));
}

/** Optional details printed on the attendance sheet (for candidates not linked to a student). */
const optText = (max: number) => z.string().trim().max(max).nullish();
const detailFields = {
  firstName: optText(100),
  lastName: optText(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD").nullish(),
  highSchool: optText(200),
  province: optText(100),
  ngo: optText(200),
};
type Details = { firstName?: string | null; lastName?: string | null; dob?: string | null; highSchool?: string | null; province?: string | null; ngo?: string | null };
/** Maps provided detail fields to columns; undefined stays undefined (left unchanged), "" becomes null. */
function detailColumns(d: Details) {
  const v = (x: string | null | undefined) => (x === undefined ? undefined : x || null);
  return { first_name: v(d.firstName), last_name: v(d.lastName), dob: v(d.dob), high_school: v(d.highSchool), province: v(d.province), ngo: v(d.ngo) };
}
function joinName(first: string | null | undefined, last: string | null | undefined) {
  if (first === undefined && last === undefined) return undefined;
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || undefined;
}

writtenExamsRouter.patch("/written-exams/candidates/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z
    .object({
      excluded: z.boolean().optional(),
      excludeReason: z.string().trim().max(300).nullish(),
      studentId: uuid.nullish(),
      fullName: z.string().trim().min(1).max(200).optional(),
      gender: gender.nullish(),
      ...detailFields,
    })
    .parse(req.body);
  await asUser(req, async (db) => {
    const cycleId = await db.value<string>("select cycle_id from exam_candidates where id = $1", [id]);
    if (!cycleId) throw notFound("Candidate");
    // Linking to a student is allowed while locked (it doesn't change results).
    if (input.excluded !== undefined || input.fullName !== undefined) await assertUnlocked(db, cycleId);
    if (input.studentId) {
      const ok = await db.value<boolean>("select exists (select 1 from students where id = $1 and cycle_id = $2 and deleted_at is null)", [input.studentId, cycleId]);
      if (!ok) throw badRequest("That student isn't in this cycle");
      const taken = await db.value<string>("select exam_number from exam_candidates where student_id = $1 and id <> $2", [input.studentId, id]);
      if (taken) throw badRequest(`That student is already linked to exam number ${taken}`);
    }
    await updateRows(
      db,
      "exam_candidates",
      {
        excluded: input.excluded,
        exclude_reason: input.excluded === false ? null : (input.excludeReason ?? undefined),
        student_id: input.studentId,
        full_name: input.fullName ?? joinName(input.firstName, input.lastName),
        gender: input.gender,
        ...detailColumns(input),
      },
      { id },
    );
  });
  res.json({ ok: true });
});

/** Deletes a candidate that has no imported sheet (e.g. added by mistake). */
writtenExamsRouter.delete("/written-exams/candidates/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, async (db) => {
    const cycleId = await db.value<string>("select cycle_id from exam_candidates where id = $1", [id]);
    if (!cycleId) throw notFound("Candidate");
    await assertUnlocked(db, cycleId);
    const sheets = (await db.value<number>("select count(*) from exam_sheets where candidate_id = $1", [id])) ?? 0;
    if (sheets) throw badRequest("This candidate has imported exam sheets and can't be deleted. Exclude them instead.");
    await deleteRows(db, "exam_candidates", { id });
  });
  res.json({ ok: true });
});

/** Next free exam numbers for a cycle: after the highest existing number, never below `start`. */
async function nextNumbers(db: Db, cycleId: string, count: number, start?: number, digits?: number) {
  const max = (await db.value<number>(
    "select coalesce(max(exam_number::bigint), 0) from exam_candidates where cycle_id = $1",
    [cycleId],
  )) ?? 0;
  let n = Math.max(Number(max) + 1, start ?? 1);
  const width = digits ?? 4;
  return Array.from({ length: count }, () => String(n++).padStart(width, "0"));
}

const numbering = { startNumber: z.number().int().min(1).max(999999999).optional(), digits: z.number().int().min(1).max(9).optional() };

/** Adds candidates by hand or from an imported list; missing exam numbers are generated. */
writtenExamsRouter.post("/written-exams/candidates", async (req, res) => {
  const input = z
    .object({
      cycleId: uuid,
      ...numbering,
      candidates: z
        .array(
          z.object({
            examNumber: z.string().regex(/^[0-9]{1,12}$/).optional(),
            fullName: z.string().trim().min(1).max(200),
            gender: gender.nullish(),
            ...detailFields,
          }),
        )
        .min(1)
        .max(5000),
    })
    .parse(req.body);
  const given = input.candidates.map((c) => c.examNumber).filter(Boolean) as string[];
  if (new Set(given.map(canonical)).size !== given.length) throw badRequest("An exam number appears more than once in the list");
  const result = await asUser(req, async (db) => {
    await assertUnlocked(db, input.cycleId);
    // A number that already exists (compared by value: "1" = "0001") updates that candidate
    // instead: e.g. results imported first without names, then the candidate list.
    const existing = await existingByValue(db, input.cycleId, given);
    const toUpdate = input.candidates.filter((c) => c.examNumber && existing.has(canonical(c.examNumber)));
    const toCreate = input.candidates.filter((c) => !c.examNumber || !existing.has(canonical(c.examNumber)));
    for (const c of toUpdate) {
      const number = existing.get(canonical(c.examNumber!))!;
      const cols = detailColumns(c);
      // The list's values win, but empty cells never erase what's already there.
      await db.exec(
        `update exam_candidates set
           full_name = coalesce(nullif($3, ''), full_name), gender = coalesce($4, gender),
           first_name = coalesce($5, first_name), last_name = coalesce($6, last_name), dob = coalesce($7::date, dob),
           high_school = coalesce($8, high_school), province = coalesce($9, province), ngo = coalesce($10, ngo)
         where cycle_id = $1 and exam_number = $2`,
        [input.cycleId, number, c.fullName, c.gender ?? null, cols.first_name ?? null, cols.last_name ?? null, cols.dob ?? null, cols.high_school ?? null, cols.province ?? null, cols.ngo ?? null],
      );
    }
    const generated = await nextNumbers(db, input.cycleId, toCreate.filter((c) => !c.examNumber).length, input.startNumber, input.digits);
    let g = 0;
    const rows = toCreate.map((c) => ({
      cycle_id: input.cycleId,
      exam_number: c.examNumber ?? generated[g++],
      full_name: c.fullName,
      gender: c.gender ?? null,
      ...detailColumns(c),
    }));
    if (rows.length) await insertRows(db, "exam_candidates", rows);
    return { created: rows.length, updated: toUpdate.length };
  });
  res.status(201).json(result);
});

/** Creates a candidate (with a new exam number) for every student in the cycle who isn't one yet. */
writtenExamsRouter.post("/written-exams/candidates/from-students", async (req, res) => {
  const input = z.object({ cycleId: uuid, ...numbering, statuses: z.array(z.string()).optional() }).parse(req.body);
  const created = await asUser(req, async (db) => {
    await assertUnlocked(db, input.cycleId);
    const students = await db.rows<{ id: string; name: string; gender: string; first_name: string; last_name: string }>(
      `select s.id, trim(s.first_name || ' ' || s.last_name) as name, s.gender, s.first_name, s.last_name from students s
       where s.cycle_id = $1 and s.deleted_at is null
         and not exists (select 1 from exam_candidates c where c.student_id = s.id)
         ${input.statuses?.length ? "and s.status = any($2::text[])" : ""}
       order by s.student_code`,
      input.statuses?.length ? [input.cycleId, input.statuses] : [input.cycleId],
    );
    if (!students.length) return 0;
    const numbers = await nextNumbers(db, input.cycleId, students.length, input.startNumber, input.digits);
    await insertRows(
      db,
      "exam_candidates",
      students.map((s, i) => ({
        cycle_id: input.cycleId,
        exam_number: numbers[i],
        full_name: s.name,
        first_name: s.first_name,
        last_name: s.last_name,
        gender: s.gender,
        student_id: s.id,
      })),
    );
    return students.length;
  });
  res.json({ created });
});

/** Assigns many candidates to a center (and optionally a session and room) at once; null clears. */
writtenExamsRouter.post("/written-exams/candidates/assign", async (req, res) => {
  const input = z
    .object({
      cycleId: uuid,
      candidateIds: z.array(uuid).min(1).max(5000),
      centerId: uuid.nullable(),
      sessionId: uuid.nullable().optional(),
      roomId: uuid.nullable().optional(),
    })
    .parse(req.body);
  await asUser(req, async (db) => {
    await assertUnlocked(db, input.cycleId);
    if (input.centerId) {
      const ok = await db.value<boolean>("select exists (select 1 from exam_centers where id = $1 and cycle_id = $2)", [input.centerId, input.cycleId]);
      if (!ok) throw badRequest("Unknown exam center");
      if (input.sessionId && !(await db.value<boolean>("select exists (select 1 from exam_sessions where id = $1 and center_id = $2)", [input.sessionId, input.centerId]))) {
        throw badRequest("That session belongs to another center");
      }
      if (input.roomId && !(await db.value<boolean>("select exists (select 1 from exam_rooms where id = $1 and center_id = $2)", [input.roomId, input.centerId]))) {
        throw badRequest("That room belongs to another center");
      }
    }
    await db.exec(
      `update exam_candidates set center_id = $3, session_id = $4, room_id = $5
       where cycle_id = $1 and id = any($2::uuid[])`,
      [input.cycleId, input.candidateIds, input.centerId, input.centerId ? (input.sessionId ?? null) : null, input.centerId ? (input.roomId ?? null) : null],
    );
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Exam centers, rooms, sessions
// ---------------------------------------------------------------------------
async function centerCycle(db: Db, centerId: string) {
  const cycleId = await db.value<string>("select cycle_id from exam_centers where id = $1", [centerId]);
  if (!cycleId) throw notFound("Exam center");
  return cycleId;
}

const centerFields = {
  name: z.string().trim().min(1).max(120),
  provinceId: uuid.nullish(),
  address: z.string().trim().max(300).nullish(),
};

writtenExamsRouter.post("/written-exams/centers", async (req, res) => {
  const input = z.object({ cycleId: uuid, ...centerFields }).parse(req.body);
  const center = await asUser(req, async (db) => {
    await assertUnlocked(db, input.cycleId);
    return insertRow(
      db,
      "exam_centers",
      { cycle_id: input.cycleId, name: input.name, province_id: input.provinceId ?? null, address: input.address || null },
      { returning: true },
    );
  });
  res.status(201).json(center);
});

writtenExamsRouter.patch("/written-exams/centers/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z.object(centerFields).partial().parse(req.body);
  await asUser(req, async (db) => {
    await assertUnlocked(db, await centerCycle(db, id));
    await updateRows(
      db,
      "exam_centers",
      { name: input.name, province_id: input.provinceId, address: input.address === undefined ? undefined : input.address || null },
      { id },
    );
  });
  res.json({ ok: true });
});

writtenExamsRouter.delete("/written-exams/centers/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, async (db) => {
    await assertUnlocked(db, await centerCycle(db, id));
    await deleteRows(db, "exam_centers", { id });
  });
  res.json({ ok: true });
});

/** Rooms and sessions are saved as whole lists; rows with an id are updated (keeping assignments), missing ones deleted. */
async function saveChildren(db: Db, table: "exam_rooms" | "exam_sessions", centerId: string, rows: { id?: string; values: Record<string, unknown> }[]) {
  const existing = await db.rows<{ id: string }>(`select id from ${table} where center_id = $1`, [centerId]);
  const keep = new Set(rows.map((r) => r.id).filter(Boolean));
  for (const e of existing) if (!keep.has(e.id)) await deleteRows(db, table, { id: e.id });
  for (const r of rows) {
    if (r.id && existing.some((e) => e.id === r.id)) await updateRows(db, table, r.values, { id: r.id });
    else await insertRow(db, table, { ...r.values, center_id: centerId });
  }
}

writtenExamsRouter.put("/written-exams/centers/:id/rooms", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z
    .object({ rooms: z.array(z.object({ id: uuid.optional(), name: z.string().trim().min(1).max(60), capacity: z.number().int().min(1).max(10000).nullish() })).max(200) })
    .parse(req.body);
  await asUser(req, async (db) => {
    await assertUnlocked(db, await centerCycle(db, id));
    await saveChildren(db, "exam_rooms", id, input.rooms.map((r, i) => ({ id: r.id, values: { name: r.name, capacity: r.capacity ?? null, sort_order: i } })));
  });
  res.json({ ok: true });
});

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish();
writtenExamsRouter.put("/written-exams/centers/:id/sessions", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z
    .object({
      sessions: z
        .array(z.object({ id: uuid.optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: time, end: time, label: z.string().trim().max(80).nullish() }))
        .max(100),
    })
    .parse(req.body);
  for (const s of input.sessions) if (s.start && s.end && s.end <= s.start) throw badRequest(`Session on ${s.date}: the end time must be after the start time`);
  await asUser(req, async (db) => {
    await assertUnlocked(db, await centerCycle(db, id));
    await saveChildren(
      db,
      "exam_sessions",
      id,
      input.sessions.map((s) => ({ id: s.id, values: { session_date: s.date, start_time: s.start || null, end_time: s.end || null, label: s.label || null } })),
    );
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Phase 3: students
// ---------------------------------------------------------------------------
/** Students of a cycle, for linking candidates. */
writtenExamsRouter.get("/written-exams/students", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  if (!cycleId || !uuid.safeParse(cycleId).success) throw badRequest("cycleId is required");
  const rows = await asUser(req, (db) =>
    db.rows(
      `select s.id, s.first_name, s.last_name, s.student_code as code, s.gender, s.status,
         (select c.exam_number from exam_candidates c where c.student_id = s.id) as exam_number
       from students s where s.cycle_id = $1 and s.deleted_at is null order by s.first_name, s.last_name`,
      [cycleId],
    ),
  );
  res.json(rows);
});

const normName = (s: string) => s.toLowerCase().replace(/[^a-zក-៿]/g, "");

/** Links unlinked candidates to unlinked students whose name matches exactly (either order). Only unique matches. */
writtenExamsRouter.post("/written-exams/candidates/auto-link", async (req, res) => {
  const input = z.object({ cycleId: uuid }).parse(req.body);
  const result = await asUser(req, async (db) => {
    const students = await db.rows<{ id: string; first_name: string; last_name: string }>(
      `select s.id, s.first_name, s.last_name from students s
       where s.cycle_id = $1 and s.deleted_at is null and not exists (select 1 from exam_candidates c where c.student_id = s.id)`,
      [input.cycleId],
    );
    const byName = new Map<string, string[]>();
    for (const s of students) {
      for (const key of new Set([normName(s.first_name + s.last_name), normName(s.last_name + s.first_name)])) {
        byName.set(key, [...(byName.get(key) ?? []), s.id]);
      }
    }
    const candidates = await db.rows<{ id: string; full_name: string | null }>(
      "select id, full_name from exam_candidates where cycle_id = $1 and student_id is null and full_name is not null",
      [input.cycleId],
    );
    const used = new Set<string>();
    const pairs: [string, string][] = [];
    let ambiguous = 0;
    for (const c of candidates) {
      const ids = [...new Set(byName.get(normName(c.full_name ?? "")) ?? [])];
      if (ids.length === 1 && !used.has(ids[0])) {
        used.add(ids[0]);
        pairs.push([c.id, ids[0]]);
      } else if (ids.length > 1) ambiguous++;
    }
    for (const [cid, sid] of pairs) await updateRows(db, "exam_candidates", { student_id: sid }, { id: cid });
    return { linked: pairs.length, ambiguous, unlinkedLeft: candidates.length - pairs.length };
  });
  res.json(result);
});

/**
 * Applies the exam outcome to linked students. The outcome is calculated by
 * the client from the current key and rules (same code the Results tab shows).
 *  - passed: registered → exam_completed
 *  - not passed: registered / exam_completed → eliminated, with the reason
 * Students already further along (interview, home visit, decided) are left alone.
 */
writtenExamsRouter.post("/written-exams/apply-to-students", async (req, res) => {
  const input = z
    .object({
      cycleId: uuid,
      passed: z.array(uuid).max(5000),
      failed: z.array(z.object({ candidateId: uuid, reason: z.string().trim().min(1).max(300) })).max(5000),
    })
    .parse(req.body);
  const result = await asUser(req, async (db) => {
    const ids = [...input.passed, ...input.failed.map((f) => f.candidateId)];
    const links = await db.rows<{ id: string; student_id: string; status: string }>(
      `select c.id, c.student_id, s.status from exam_candidates c join students s on s.id = c.student_id
       where c.cycle_id = $1 and c.id = any($2::uuid[]) and s.deleted_at is null`,
      [input.cycleId, ids],
    );
    const byCandidate = new Map(links.map((l) => [l.id, l]));
    let advanced = 0;
    let eliminated = 0;
    let unchanged = 0;
    for (const id of input.passed) {
      const l = byCandidate.get(id);
      if (l?.status === "registered") {
        await updateRows(db, "students", { status: "exam_completed" }, { id: l.student_id });
        advanced++;
      } else if (l) unchanged++;
    }
    for (const f of input.failed) {
      const l = byCandidate.get(f.candidateId);
      if (l && (l.status === "registered" || l.status === "exam_completed")) {
        await updateRows(db, "students", { status: "eliminated", elimination_reason: f.reason }, { id: l.student_id });
        eliminated++;
      } else if (l) unchanged++;
    }
    return { advanced, eliminated, unchanged };
  });
  res.json(result);
});

/** Creates student records (status exam_completed) for candidates that aren't linked to one yet. */
writtenExamsRouter.post("/written-exams/create-students", async (req, res) => {
  const input = z.object({ cycleId: uuid, candidateIds: z.array(uuid).min(1).max(2000) }).parse(req.body);
  const result = await asUser(req, async (db) => {
    const year = await db.value<number>("select year from selection_cycles where id = $1", [input.cycleId]);
    if (!year) throw notFound("Cycle");
    const prefix = `ST-${String(year).slice(-2)}-`;
    const last = await db.value<string>(
      "select student_code from students where student_code like $1 order by student_code desc limit 1",
      [`${prefix}%`],
    );
    let seq = last ? Number(last.slice(prefix.length)) || 0 : 0;
    const candidates = await db.rows<{ id: string; full_name: string | null; gender: string | null }>(
      "select id, full_name, gender from exam_candidates where cycle_id = $1 and id = any($2::uuid[]) and student_id is null",
      [input.cycleId, input.candidateIds],
    );
    let created = 0;
    const skipped: string[] = [];
    for (const c of candidates) {
      const name = (c.full_name ?? "").trim().replace(/\s+/g, " ");
      if (!name || !c.gender) {
        skipped.push(c.id);
        continue;
      }
      const [first, ...rest] = name.split(" ");
      const student = await insertRow(
        db,
        "students",
        {
          cycle_id: input.cycleId,
          student_code: `${prefix}${String(++seq).padStart(4, "0")}`,
          first_name: first,
          last_name: rest.join(" "),
          gender: c.gender,
          status: "exam_completed",
        },
        { returning: true },
      );
      await updateRows(db, "exam_candidates", { student_id: student?.id }, { id: c.id });
      created++;
    }
    return { created, skipped: skipped.length };
  });
  res.json(result);
});

/** One student's written-exam data, for the student profile. */
writtenExamsRouter.get("/written-exams/student/:studentId", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  const data = await asUser(req, async (db) => {
    const candidate = await db.one(
      `select c.id, c.cycle_id, c.exam_number, c.full_name, c.student_id, c.excluded, c.exclude_reason, c.gender,
         c.center_id, c.session_id, c.room_id, c.first_name, c.last_name, c.dob, c.high_school, c.province, c.ngo,
         null::json as student
       from exam_candidates c where c.student_id = $1`,
      [studentId],
    );
    if (!candidate) return null;
    const cycleId = (candidate as { cycle_id: string }).cycle_id;
    const papers = await db.rows(
      `select p.*,
         coalesce((select json_agg(q order by q.number) from exam_questions q where q.paper_id = p.id), '[]'::json) as questions,
         coalesce((select json_agg(s order by s.sort_order, s.from_question) from exam_subjects s where s.paper_id = p.id), '[]'::json) as subjects,
         coalesce((select json_agg(v order by v.version) from exam_key_versions v where v.paper_id = p.id), '[]'::json) as key_versions,
         null::json as last_import
       from exam_papers p where p.cycle_id = $1 order by p.sort_order, p.created_at`,
      [cycleId],
    );
    const sheets = await db.rows("select * from exam_sheets where candidate_id = $1", [(candidate as { id: string }).id]);
    const rules = await db.rows("select * from exam_rules where cycle_id = $1 order by sort_order, created_at", [cycleId]);
    const overrides = await db.rows(
      "select candidate_id, paper_id, score, reason, updated_at from exam_score_overrides where candidate_id = $1",
      [(candidate as { id: string }).id],
    );
    return { candidate, papers, sheets, rules, overrides };
  });
  res.json(data);
});

/**
 * Sets (or with score = null removes) a manual score for one candidate and
 * paper. It replaces the score calculated from the scanned sheet.
 */
writtenExamsRouter.put("/written-exams/overrides", async (req, res) => {
  const input = z
    .object({
      candidateId: uuid,
      paperId: uuid,
      score: z.number().min(0).max(1000).nullable(),
      reason: z.string().trim().max(300).nullish(),
    })
    .parse(req.body);
  if (input.score != null && !input.reason) throw badRequest("Give a reason for the manual score");
  await asUser(req, async (db) => {
    const cycleId = await paperCycle(db, input.paperId);
    const candCycle = await db.value<string>("select cycle_id from exam_candidates where id = $1", [input.candidateId]);
    if (!candCycle) throw notFound("Candidate");
    if (candCycle !== cycleId) throw badRequest("The candidate and paper are from different cycles");
    await assertUnlocked(db, cycleId);
    if (input.score == null) {
      await deleteRows(db, "exam_score_overrides", { candidate_id: input.candidateId, paper_id: input.paperId });
      return;
    }
    const max = Number(
      (await db.value<string>("select coalesce(sum(points) filter (where not cancelled), 0) from exam_questions where paper_id = $1", [input.paperId])) ?? 0,
    );
    if (max > 0 && input.score > max) throw badRequest(`The score can't be above ${max}, the paper's maximum`);
    await insertRow(
      db,
      "exam_score_overrides",
      { candidate_id: input.candidateId, paper_id: input.paperId, score: input.score, reason: input.reason, updated_by: await currentUserId(db) },
      { onConflict: ["candidate_id", "paper_id"] },
    );
  });
  res.json({ ok: true });
});
