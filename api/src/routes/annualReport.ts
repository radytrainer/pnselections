import { Router } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import { forbidden, notFound } from "../errors";
import { uuidParam } from "./util";

/**
 * Configuration → Annual Report. GET returns everything the report needs for
 * one cycle in one call: the saved written content (migration 0070) plus raw,
 * per-student rows the browser turns into figures and tables (the same way
 * the dashboard aggregates). Exam sheets come from /written-exams.
 */
export const annualReportRouter = Router();

const EDITORS = ["super_admin", "program_manager", "selection_team"];

annualReportRouter.get("/annual-report/:cycleId", async (req, res) => {
  const cycleId = uuidParam(req, "cycleId");
  if (!EDITORS.includes(req.user?.role ?? "")) throw forbidden();
  const result = await asUser(req, async (db) => {
    const cycle = await db.one(
      "select id, year, name, start_date, end_date, status from selection_cycles where id = $1",
      [cycleId],
    );
    if (!cycle) throw notFound("Cycle");
    const saved = await db.one<{ content: unknown; updated_at: string; updated_by_name: string | null }>(
      `select r.content, r.updated_at, u.full_name as updated_by_name
         from annual_reports r left join users u on u.id = r.updated_by where r.cycle_id = $1`,
      [cycleId],
    );

    // One row per student with the latest interview, home visit and committee decision.
    const students = await db.rows(
      `select s.id, s.gender, s.dob, s.status, s.elimination_reason, s.district_name,
              s.school_id, s.referred_by_ngo_id is not null as from_ngo,
              p.name_en as province, sc.school_name as school, np.organization_name as ngo,
              i.recommendation as interview, i.interview_date,
              sa.visit_date, sa.age, sa.child_rank, sa.children_count,
              sa.family_male_count, sa.family_female_count, sa.household_size_band,
              sa.father_occupation_band, sa.mother_occupation_band, sa.parent_occupation_band,
              sa.income_band, sa.expenses_band, sa.debt_band, sa.category, sa.final_score, sa.vac_total_score,
              sa.vulnerability_orphan_single_parent, sa.vulnerability_disability, sa.vulnerability_chronic_illness,
              sa.vulnerability_debt_burden, sa.vulnerability_landless, sa.manual_failed,
              sa.visit_date is not null or sa.id is not null as visited,
              cd.decision, cd.decision_date
         from students s
         left join provinces p on p.id = s.province_id
         left join school_partners sc on sc.id = s.school_id
         left join ngo_partners np on np.id = s.referred_by_ngo_id
         left join lateral (select recommendation, interview_date from interviews where student_id = s.id
                            order by updated_at desc limit 1) i on true
         left join lateral (select * from social_assessments where student_id = s.id
                            order by visit_number desc limit 1) sa on true
         left join lateral (select decision, decision_date from committee_decisions where student_id = s.id
                            order by updated_at desc limit 1) cd on true
        where s.cycle_id = $1 and s.deleted_at is null`,
      [cycleId],
    );

    // Who worked on each stage, from what the app recorded.
    const staff = await db.rows(
      `select distinct name, stage from (
         select coalesce(u.full_name, u.email) as name, 'interviews' as stage
           from interviews i join users u on u.id = i.interviewer_id where i.cycle_id = $1
         union all
         select coalesce(nullif(trim(sa.visitor_name), ''), u.full_name, u.email), 'home_visits'
           from social_assessments sa left join users u on u.id = sa.visitor_id where sa.cycle_id = $1
         union all
         select coalesce(u.full_name, u.email), 'committee'
           from committee_ratings cr join users u on u.id = cr.rated_by where cr.cycle_id = $1
       ) x where name is not null order by name`,
      [cycleId],
    );

    const partners = await db.one<{ ngos: number; schools: number }>(
      `select (select count(*)::int from ngo_partners where deleted_at is null) as ngos,
              (select count(*)::int from school_partners where deleted_at is null) as schools`,
    );
    const interviewCenters = await db.value<number>(
      "select count(*)::int from interview_centers where cycle_id = $1",
      [cycleId],
    );
    const stats = await db.one(
      "select * from information_session_stats where cycle_id = $1",
      [cycleId],
    );

    return {
      cycle,
      content: saved?.content ?? {},
      updatedAt: saved?.updated_at ?? null,
      updatedBy: saved?.updated_by_name ?? null,
      students,
      staff,
      partners: partners ?? { ngos: 0, schools: 0 },
      interviewCenters: interviewCenters ?? 0,
      informationSessionStats: stats,
    };
  });
  res.json(result);
});

// The written content is free-form JSON shaped by the page; cap its size and depth.
const contentSchema = z.record(z.string().max(60), z.unknown()).refine((v) => JSON.stringify(v).length < 300_000, {
  message: "The report is too long to save",
});

annualReportRouter.put("/annual-report/:cycleId", async (req, res) => {
  const cycleId = uuidParam(req, "cycleId");
  if (!EDITORS.includes(req.user?.role ?? "")) throw forbidden();
  const content = contentSchema.parse(req.body?.content ?? {});
  const updatedAt = await asUser(req, async (db) => {
    const r = await db.exec(
      `insert into annual_reports (cycle_id, content, updated_by)
       values ($1, $2::jsonb, (select id from users where firebase_uid = $3))
       on conflict (cycle_id) do update set content = excluded.content, updated_by = excluded.updated_by
       returning updated_at`,
      [cycleId, JSON.stringify(content), req.user!.uid],
    );
    return r.rows[0]?.updated_at as Date | undefined;
  });
  res.json({ ok: true, updatedAt });
});
