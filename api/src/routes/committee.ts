import { Router } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import { notFound } from "../errors";
import { publish, subscribe } from "../redis";
import { insertRow, updateRows } from "../sql";
import { Params, qs, toMany, toOne, today, uuidParam } from "./util";

export const committeeRouter = Router();

const PROVINCE = toOne("provinces", "p", ["name_en"], "p.id = s.province_id", "provinces");
const SCHOOL = toOne("school_partners", "sp", ["school_name"], "sp.id = s.school_id", "school_partners");
const DOCUMENTS = toMany("student_documents", "d", ["doc_type", "file_path", "uploaded_at"], "d.student_id = s.id", "student_documents");
const RATINGS = toMany("committee_ratings", "cr", "*", "cr.student_id = s.id", "committee_ratings");

const ratingsChannel = (studentId: string) => `committee_ratings:${studentId}`;

/** Students who've finished the pipeline but have no committee decision yet. */
committeeRouter.get("/queue", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  const rows = await asUser(req, (db) => {
    const params = new Params();
    const cycleFilter = cycleId ? ` and s.cycle_id = ${params.add(cycleId)}` : "";
    return db.rows(
      `select s.id, s.student_code, s.first_name, s.last_name, s.gender, s.cycle_id, s.gpa, s.family_income_monthly,
         s.elimination_reason, s.province_id, s.photo_drive_url, ${PROVINCE}, ${SCHOOL},
         ${toOne("exam_results", "er", ["total_score", "rank_in_cycle", "pass_status"], "er.student_id = s.id", "exam_results")},
         ${toOne("interviews", "iv", ["recommendation"], "iv.student_id = s.id", "interviews")},
         ${toMany("social_assessments", "sa", ["final_score", "category", "manual_failed", "visitor_comments", "visitor_id", "visitor_name"], "sa.student_id = s.id", "social_assessments")},
         ${DOCUMENTS}, ${RATINGS}
       from students s
       where s.status = 'committee_review' and s.deleted_at is null${cycleFilter}
       order by s.created_at asc`,
      params.values,
    );
  });
  res.json(rows);
});

/** Single-student consolidated view backing the Committee Dossier page. */
committeeRouter.get("/dossier/:studentId", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  const dossier = await asUser(req, (db) =>
    db.one(
      `select s.id, s.student_code, s.first_name, s.last_name, s.gender, s.dob, s.status, s.cycle_id, s.gpa, s.grade,
         s.district_name, s.commune_name, s.village_name, s.family_income_monthly, s.elimination_reason, s.photo_drive_url,
         ${PROVINCE}, ${SCHOOL},
         ${toOne("ngo_partners", "np", ["organization_name"], "np.id = s.referred_by_ngo_id", "ngo_partners")},
         ${toOne("exam_results", "er", ["math_score", "english_score", "logic_score", "computer_score", "total_score", "rank_in_cycle", "rank_in_province", "pass_status"], "er.student_id = s.id", "exam_results")},
         ${toOne("interviews", "iv", ["comments", "recommendation"], "iv.student_id = s.id", "interviews")},
         ${toMany("social_assessments", "sa", "*", "sa.student_id = s.id", "social_assessments")},
         ${DOCUMENTS},
         ${toOne("committee_decisions", "cd", ["decision", "decision_date", "poor_level", "approval_status"], "cd.student_id = s.id", "committee_decisions")},
         ${RATINGS}
       from students s where s.id = $1`,
      [studentId],
    ),
  );
  if (!dossier) throw notFound("Student");
  res.json(dossier);
});

const decisionBody = z.object({
  studentId: z.string().uuid(),
  cycleId: z.string().uuid(),
  decision: z.string(),
  poorLevel: z.string().nullable().optional(),
});

/**
 * Upsert so a decision can be changed later; approval resets to "pending"
 * on every change (see the original note in services/committeeService.ts).
 */
committeeRouter.post("/decisions", async (req, res) => {
  const input = decisionBody.parse(req.body);
  await asUser(req, async (db) => {
    await insertRow(
      db,
      "committee_decisions",
      {
        student_id: input.studentId,
        cycle_id: input.cycleId,
        decision: input.decision,
        decision_date: today(),
        poor_level: input.poorLevel ?? null,
        approval_status: "pending",
        approved_by: null,
      },
      { onConflict: ["student_id"] },
    );
    await updateRows(db, "students", { status: input.decision }, { id: input.studentId });
  });
  res.json({ ok: true });
});

committeeRouter.get("/pending-approvals", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  const rows = await asUser(req, (db) => {
    const params = new Params();
    const cycleFilter = cycleId ? ` and cd.cycle_id = ${params.add(cycleId)}` : "";
    return db.rows(
      `select cd.id, cd.decision, cd.decision_date,
         ${toOne("students", "s", ["id", "student_code", "first_name", "last_name"], "s.id = cd.student_id", "students")}
       from committee_decisions cd
       where cd.approval_status = 'pending'${cycleFilter}
       order by cd.decision_date asc`,
      params.values,
    );
  });
  res.json(rows);
});

committeeRouter.post("/decisions/:id/approval", async (req, res) => {
  const id = uuidParam(req, "id");
  const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
  await asUser(req, (db) =>
    updateRows(db, "committee_decisions", { approval_status: approve ? "approved" : "rejected" }, { id }),
  );
  res.json({ ok: true });
});

/** Hands a case to the committee (or sends a decided one back), clearing any stale decision first. */
committeeRouter.post("/send/:studentId", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  await asUser(req, async (db) => {
    await db.exec(
      `update committee_decisions set decision = null, poor_level = null, approval_status = 'pending', approved_by = null
       where student_id = $1`,
      [studentId],
    );
    await updateRows(db, "students", { status: "committee_review" }, { id: studentId });
  });
  res.json({ ok: true });
});

/**
 * One overall 1-5 vote per voter per student. rated_by is filled in by the
 * column default (auth_user_id(), migration 0009), never by the client.
 */
committeeRouter.put("/ratings", async (req, res) => {
  const input = z
    .object({ studentId: z.string().uuid(), cycleId: z.string().uuid(), score: z.number().int() })
    .parse(req.body);
  const ratedBy = await asUser(req, async (db) => {
    await insertRow(
      db,
      "committee_ratings",
      { student_id: input.studentId, cycle_id: input.cycleId, criterion: "overall", score: input.score },
      { onConflict: ["student_id", "rated_by", "criterion"] },
    );
    return db.value<string>("select auth_user_id()");
  });
  await publish(ratingsChannel(input.studentId), { studentId: input.studentId, ratedBy });
  res.json({ ok: true });
});

/**
 * Live vote updates for the dossier page over Server-Sent Events (replaces
 * Supabase Realtime). Events only say "ratings changed"; the page refetches
 * through the RLS-checked dossier endpoint. committee_member callers only
 * see their own vote (migration 0021), so they're only notified about it.
 */
committeeRouter.get("/ratings/:studentId/stream", async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  const ownOnly = req.user?.role === "committee_member";
  const myUserId = ownOnly ? await asUser(req, (db) => db.value<string>("select auth_user_id()")) : null;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 5000\n\n");

  const unsubscribe = subscribe(ratingsChannel(studentId), (message) => {
    try {
      const event = JSON.parse(message) as { ratedBy?: string | null };
      if (ownOnly && event.ratedBy !== myUserId) return;
    } catch {
      return;
    }
    res.write(`event: ratings\ndata: {}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
