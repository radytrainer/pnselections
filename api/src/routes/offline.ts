import { Router } from "express";
import { asUser } from "../auth";
import { qs, toMany, toOne } from "./util";

/**
 * Everything Field Mode needs to work without internet, in one request:
 * every (RLS-visible) student of the cycle with their full detail, plus the
 * lookups and interview question bank. The browser stores it in IndexedDB
 * (lib/offline/bundle.ts) under the same URLs the normal endpoints use.
 */
export const offlineRouter = Router();

offlineRouter.get("/bundle", async (req, res) => {
  const bundle = await asUser(req, async (db) => {
    const activeCycle = await db.one<{ id: string }>(
      "select id, year, name, status from selection_cycles where status = 'active' limit 1",
    );
    const cycleId = qs(req, "cycleId") ?? activeCycle?.id ?? null;

    const students = cycleId
      ? await db.rows(
          `select s.*,
             ${toOne("provinces", "p", ["name_en"], "p.id = s.province_id", "provinces")},
             ${toOne("school_partners", "sp", ["school_name"], "sp.id = s.school_id", "school_partners")},
             ${toOne("ngo_partners", "np", ["organization_name"], "np.id = s.referred_by_ngo_id", "ngo_partners")},
             (select row_to_json(er) from exam_results er where er.student_id = s.id) as exam_results,
             (select row_to_json(iv) from interviews iv where iv.student_id = s.id) as interviews,
             ${toMany("social_assessments", "sa", "*", "sa.student_id = s.id", "social_assessments")},
             ${toMany("student_documents", "d", ["doc_type", "file_path", "uploaded_at"], "d.student_id = s.id", "student_documents")},
             (select row_to_json(cd) from committee_decisions cd where cd.student_id = s.id) as committee_decisions
           from students s
           where s.deleted_at is null and s.cycle_id = $1
           order by s.first_name, s.last_name`,
          [cycleId],
        )
      : [];

    const answers = cycleId
      ? await db.rows<{ interview_id: string; answers: { question_id: string; score: number }[] }>(
          `select ia.interview_id, json_agg(json_build_object('question_id', ia.question_id, 'score', ia.score)) as answers
           from interview_answers ia join interviews iv on iv.id = ia.interview_id
           where iv.cycle_id = $1 group by ia.interview_id`,
          [cycleId],
        )
      : [];

    return {
      generatedAt: new Date().toISOString(),
      cycleId,
      activeCycle,
      cycles: await db.rows("select id, year, name, status from selection_cycles order by year desc"),
      provinces: await db.rows("select id, name_en, name_kh, code from provinces order by name_en"),
      schools: await db.rows("select id, school_name from school_partners where deleted_at is null order by school_name"),
      interviewCategories: await db.rows(
        `select c.*, coalesce((select json_agg(row_to_json(q)) from interview_questions q where q.category_id = c.id), '[]'::json) as interview_questions
         from interview_categories c where c.deleted_at is null order by c.display_order`,
      ),
      students,
      interviewAnswers: Object.fromEntries(answers.map((a) => [a.interview_id, a.answers])),
    };
  });
  res.json(bundle);
});
