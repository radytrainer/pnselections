import { Router } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import type { Db } from "../db";
import { insertRow, insertRows, updateRows } from "../sql";
import { uuidParam } from "./util";
import { badRequest, forbidden, notFound } from "../errors";

/**
 * Exam results, interviews (+ per-question answers), the interview question
 * bank, and home-visit social assessments.
 */
export const assessmentsRouter = Router();

/** Advances students.status when the client computed a later pipeline stage (lib/constants#advanceStatus). */
async function applyNextStatus(db: Db, studentId: string, nextStatus: string | undefined) {
  if (nextStatus) await updateRows(db, "students", { status: nextStatus }, { id: studentId });
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
assessmentsRouter.get("/exams/:studentId", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  res.json(await asUser(req, (db) => db.one("select * from exam_results where student_id = $1", [studentId])));
});

const examBody = z.object({
  cycleId: z.string().uuid(),
  mathScore: z.number(),
  englishScore: z.number(),
  logicScore: z.number(),
  computerScore: z.number(),
  nextStatus: z.string().optional(),
});

assessmentsRouter.put("/exams/:studentId", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  const input = examBody.parse(req.body);
  await asUser(req, async (db) => {
    await insertRow(
      db,
      "exam_results",
      {
        student_id: studentId,
        cycle_id: input.cycleId,
        math_score: input.mathScore,
        english_score: input.englishScore,
        logic_score: input.logicScore,
        computer_score: input.computerScore,
      },
      { onConflict: ["student_id"] },
    );
    await applyNextStatus(db, studentId, input.nextStatus);
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------
assessmentsRouter.get("/interviews/student/:studentId", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  res.json(await asUser(req, (db) => db.one("select * from interviews where student_id = $1", [studentId])));
});

assessmentsRouter.get("/interviews/:interviewId/answers", async (req, res) => {
  const interviewId = uuidParam(req, "interviewId");
  res.json(
    await asUser(req, (db) =>
      db.rows("select question_id, score from interview_answers where interview_id = $1", [interviewId]),
    ),
  );
});

/** Raw data behind the profile's Interview tab; services/interviewService.ts groups it by category. */
assessmentsRouter.get("/interviews/student/:studentId/summary", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  const result = await asUser(req, async (db) => {
    const interview = await db.one<{ id: string }>(
      "select id, recommendation, comments from interviews where student_id = $1",
      [studentId],
    );
    if (!interview) return { interview: null, answers: [] };
    const answers = await db.rows(
      `select ia.score,
         (select json_build_object(
            'category_id', q.category_id,
            'interview_categories', (select json_build_object('name', c.name, 'display_order', c.display_order)
                                     from interview_categories c where c.id = q.category_id))
          from interview_questions q where q.id = ia.question_id) as interview_questions
       from interview_answers ia where ia.interview_id = $1`,
      [interview.id],
    );
    return { interview, answers };
  });
  res.json(result);
});

const interviewBody = z.object({
  cycleId: z.string().uuid(),
  comments: z.string().nullable(),
  recommendation: z.string().nullable(),
  answers: z.array(z.object({ questionId: z.string().uuid(), score: z.number().int() })),
  /** Kept for older clients/offline queues; the outcome is decided by apply_interview_outcome. */
  nextStatus: z.string().optional(),
  interviewCenterId: z.string().uuid().nullish(),
});

assessmentsRouter.put("/interviews/student/:studentId", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  const input = interviewBody.parse(req.body);
  await asUser(req, async (db) => {
    const interview = await insertRow(
      db,
      "interviews",
      {
        student_id: studentId,
        cycle_id: input.cycleId,
        comments: input.comments,
        recommendation: input.recommendation,
      },
      { onConflict: ["student_id"], returning: true },
    );
    await insertRows(
      db,
      "interview_answers",
      input.answers.map((a) => ({ interview_id: interview!.id, question_id: a.questionId, score: a.score })),
      { onConflict: ["interview_id", "question_id"] },
    );
    // Outcome (migration 0058, apply_interview_outcome): passed → Interview done; failed →
    // eliminated "Did not pass the Motivation Interview" (out of the working lists, still counted
    // on Selection Process); a later "passed" undoes it. Also records the interview center.
    // Runs in the database so the interview team (who can't edit student records) and interviews
    // synced from offline follow the same rule.
    await db.exec("select apply_interview_outcome($1, $2, $3)", [studentId, input.recommendation, input.interviewCenterId ?? null]);
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Interview pass rule (migration 0059) — per cycle, set by super_admin /
// program_manager (selection_cycles_write RLS). Same rule as
// features/interview/schema.ts#computeGrade on the client.
// ---------------------------------------------------------------------------
type PassRule = { mode: "percent" | "points"; value: number };

function gradeFor(total: number, max: number, rule: PassRule): "A1" | "A2" | "not_recommended" {
  if (max <= 0) return "not_recommended";
  const pass = rule.mode === "points" ? total >= rule.value : (total / max) * 100 >= rule.value;
  if (!pass) return "not_recommended";
  return total / max >= 0.6 ? "A1" : "A2";
}

const passRuleBody = z.object({
  mode: z.enum(["percent", "points"]),
  value: z.number().min(0),
});

async function loadPassRule(db: Db, cycleId: string): Promise<PassRule> {
  const row = await db.one<{ interview_pass_mode: PassRule["mode"]; interview_pass_value: string }>(
    "select interview_pass_mode, interview_pass_value from selection_cycles where id = $1",
    [cycleId],
  );
  if (!row) throw notFound("Cycle");
  return { mode: row.interview_pass_mode, value: Number(row.interview_pass_value) };
}

/** Every saved interview in the cycle with its total / max and current recommendation. */
async function cycleInterviewTotals(db: Db, cycleId: string) {
  return db.rows<{ id: string; student_id: string; recommendation: string | null; total: number; max: number }>(
    `select iv.id, iv.student_id, iv.recommendation,
            coalesce(sum(ia.score), 0)::int as total, (count(ia.id) * 5)::int as max
       from interviews iv left join interview_answers ia on ia.interview_id = iv.id
      where iv.cycle_id = $1
      group by iv.id`,
    [cycleId],
  );
}

function compareRule(rows: Awaited<ReturnType<typeof cycleInterviewTotals>>, rule: PassRule) {
  let passed = 0;
  let failed = 0;
  let toPass = 0;
  let toFail = 0;
  for (const r of rows) {
    if (r.max <= 0) continue;
    const next = gradeFor(r.total, r.max, rule);
    const wasPass = r.recommendation === "A1" || r.recommendation === "A2";
    const isPass = next !== "not_recommended";
    if (isPass) passed++;
    else failed++;
    if (isPass && !wasPass) toPass++;
    if (!isPass && wasPass) toFail++;
  }
  return { interviewed: passed + failed, passed, failed, toPass, toFail };
}

assessmentsRouter.get("/interview-pass-rule", async (req, res) => {
  const cycleId = z.string().uuid().parse(req.query.cycleId);
  res.json(
    await asUser(req, async (db) => {
      const rule = await loadPassRule(db, cycleId);
      const questionCount = await db.value<number>(
        "select count(*)::int from interview_questions where is_active and deleted_at is null",
      );
      return { ...rule, questionCount: questionCount ?? 0 };
    }),
  );
});

/** What a candidate rule would do to the interviews already saved in the cycle (nothing is changed). */
assessmentsRouter.get("/interview-pass-rule/preview", async (req, res) => {
  const cycleId = z.string().uuid().parse(req.query.cycleId);
  const rule = passRuleBody.parse({ mode: req.query.mode, value: Number(req.query.value) });
  res.json(await asUser(req, async (db) => compareRule(await cycleInterviewTotals(db, cycleId), rule)));
});

/**
 * Saves the cycle's rule. With reapply, interviews already saved are re-graded
 * with it: their result is updated and students move in/out of the process
 * the same way as when an interview is saved (apply_interview_outcome).
 */
assessmentsRouter.put("/interview-pass-rule", async (req, res) => {
  if (!["super_admin", "program_manager"].includes(req.user?.role ?? "")) throw forbidden();
  const input = passRuleBody.extend({ cycleId: z.string().uuid(), reapply: z.boolean().optional() }).parse(req.body);
  if (input.mode === "percent" && input.value > 100) throw badRequest("A percentage can't be above 100");
  const result = await asUser(req, async (db) => {
    await loadPassRule(db, input.cycleId);
    await updateRows(
      db,
      "selection_cycles",
      { interview_pass_mode: input.mode, interview_pass_value: input.value },
      { id: input.cycleId },
    );
    let changed = 0;
    if (input.reapply) {
      const rule = { mode: input.mode, value: input.value };
      for (const r of await cycleInterviewTotals(db, input.cycleId)) {
        if (r.max <= 0) continue;
        const next = gradeFor(r.total, r.max, rule);
        if (next === r.recommendation) continue;
        const flips = (next === "not_recommended") !== (r.recommendation === "not_recommended") || !r.recommendation;
        await updateRows(db, "interviews", { recommendation: next }, { id: r.id });
        if (flips) {
          await db.exec("select apply_interview_outcome($1, $2, null)", [r.student_id, next]);
          changed++;
        }
      }
    }
    return { changed };
  });
  res.json({ ok: true, ...result });
});

// ---------------------------------------------------------------------------
// Interview question bank (super_admin manages; RLS enforces)
// ---------------------------------------------------------------------------
assessmentsRouter.get("/interview-categories", async (req, res) => {
  res.json(
    await asUser(req, (db) =>
      db.rows(
        `select c.*, coalesce((select json_agg(row_to_json(q)) from interview_questions q where q.category_id = c.id), '[]'::json) as interview_questions
         from interview_categories c where c.deleted_at is null order by c.display_order`,
      ),
    ),
  );
});

assessmentsRouter.post("/interview-categories", async (req, res) => {
  const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
  const created = await asUser(req, async (db) => {
    const count = await db.value<number>("select count(*) from interview_categories where deleted_at is null");
    return insertRow(db, "interview_categories", { name, display_order: (count ?? 0) + 1 }, { returning: true });
  });
  res.status(201).json(created);
});

assessmentsRouter.put("/interview-categories/order", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(req.body);
  await asUser(req, async (db) => {
    for (let i = 0; i < ids.length; i++) {
      await updateRows(db, "interview_categories", { display_order: i + 1 }, { id: ids[i] });
    }
  });
  res.json({ ok: true });
});

assessmentsRouter.patch("/interview-categories/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
  await asUser(req, (db) => updateRows(db, "interview_categories", { name }, { id }));
  res.json({ ok: true });
});

assessmentsRouter.post("/interview-questions", async (req, res) => {
  const input = z
    .object({ categoryId: z.string().uuid(), textEn: z.string().min(1), textKm: z.string().optional() })
    .parse(req.body);
  const created = await asUser(req, async (db) => {
    const count = await db.value<number>(
      "select count(*) from interview_questions where category_id = $1 and deleted_at is null",
      [input.categoryId],
    );
    return insertRow(
      db,
      "interview_questions",
      {
        category_id: input.categoryId,
        text_en: input.textEn,
        text_km: input.textKm || null,
        display_order: (count ?? 0) + 1,
      },
      { returning: true },
    );
  });
  res.status(201).json(created);
});

assessmentsRouter.put("/interview-questions/order", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(req.body);
  await asUser(req, async (db) => {
    for (let i = 0; i < ids.length; i++) {
      await updateRows(db, "interview_questions", { display_order: i + 1 }, { id: ids[i] });
    }
  });
  res.json({ ok: true });
});

assessmentsRouter.patch("/interview-questions/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z
    .object({ text_en: z.string().min(1).optional(), text_km: z.string().nullable().optional(), is_active: z.boolean().optional() })
    .parse(req.body);
  await asUser(req, (db) => updateRows(db, "interview_questions", input, { id }));
  res.json({ ok: true });
});

assessmentsRouter.delete("/interview-questions/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, (db) => updateRows(db, "interview_questions", { deleted_at: new Date().toISOString() }, { id }));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Social assessments (home visit form)
// ---------------------------------------------------------------------------
assessmentsRouter.get("/social-assessments/student/:studentId/latest", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  res.json(
    await asUser(req, (db) =>
      db.one("select * from social_assessments where student_id = $1 order by visit_number desc limit 1", [studentId]),
    ),
  );
});

const socialBody = z.object({
  /** Updates this row if set; otherwise inserts a new visit. */
  id: z.string().uuid().optional(),
  studentId: z.string().uuid(),
  row: z.record(z.string(), z.unknown()),
  /** Only status/gender may be changed on the student from here. */
  studentUpdate: z
    .object({ status: z.string().optional(), gender: z.string().optional() })
    .optional(),
});

assessmentsRouter.post("/social-assessments/save", async (req, res) => {
  const input = socialBody.parse(req.body);
  await asUser(req, async (db) => {
    const row = { ...input.row, student_id: input.studentId };
    if (input.id) await updateRows(db, "social_assessments", row, { id: input.id });
    else await insertRow(db, "social_assessments", row);

    const studentUpdate = Object.fromEntries(
      Object.entries(input.studentUpdate ?? {}).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(studentUpdate).length > 0) {
      await updateRows(db, "students", studentUpdate, { id: input.studentId });
    }
  });
  res.json({ ok: true });
});
