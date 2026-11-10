import { Router } from "express";
import { asUser } from "../auth";
import { Params, qs, toOne } from "./util";

/**
 * Dashboard + map aggregates. These return the same raw rows the services
 * used to fetch from PostgREST; the services keep their existing in-browser
 * aggregation so the numbers stay identical.
 */
export const reportsRouter = Router();

reportsRouter.get("/dashboard", async (req, res) => {
  const result = await asUser(req, async (db) => {
    const students = await db.rows(
      `select s.id, s.first_name, s.last_name, s.gender, s.status, s.elimination_reason,
         ${toOne("provinces", "p", ["name_en"], "p.id = s.province_id", "provinces")},
         ${toOne("ngo_partners", "np", ["organization_name"], "np.id = s.referred_by_ngo_id", "ngo_partners")}
       from students s where s.deleted_at is null`,
    );
    const partnerNgos = await db.value<number>("select count(*) from ngo_partners where deleted_at is null");
    const partnerSchools = await db.value<number>("select count(*) from school_partners where deleted_at is null");
    return { students, partnerNgos: partnerNgos ?? 0, partnerSchools: partnerSchools ?? 0 };
  });
  res.json(result);
});

reportsRouter.get("/dashboard/visitor-stats", async (req, res) => {
  const rows = await asUser(req, (db) =>
    db.rows(
      `select sa.student_id, sa.visitor_name,
         ${toOne("users", "u", ["full_name"], "u.id = sa.visitor_id", "users")},
         ${toOne("students", "s", ["deleted_at"], "s.id = sa.student_id", "students")}
       from social_assessments sa`,
    ),
  );
  res.json(rows);
});

reportsRouter.get("/map/province-stats", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  const result = await asUser(req, async (db) => {
    const provinces = await db.rows("select id, code, name_en from provinces");
    const params = new Params();
    const cycleFilter = cycleId ? ` and s.cycle_id = ${params.add(cycleId)}` : "";
    const students = await db.rows(
      `select s.id, s.gender, s.province_id, s.referred_by_ngo_id,
         ${toOne("exam_results", "er", ["id"], "er.student_id = s.id", "exam_results")},
         ${toOne("interviews", "iv", ["id"], "iv.student_id = s.id", "interviews")},
         coalesce((select json_agg(json_build_object('id', sa.id)) from social_assessments sa where sa.student_id = s.id), '[]'::json) as social_assessments,
         ${toOne("committee_decisions", "cd", ["decision"], "cd.student_id = s.id", "committee_decisions")}
       from students s where s.deleted_at is null${cycleFilter}`,
      params.values,
    );
    return { provinces, students };
  });
  res.json(result);
});

reportsRouter.get("/map/partners", async (req, res) => {
  const result = await asUser(req, async (db) => {
    const ngos = await db.rows(
      `select n.id, n.organization_name, n.lat, n.lng, ${toOne("provinces", "p", ["code"], "p.id = n.province_id", "provinces")}
       from ngo_partners n where n.deleted_at is null`,
    );
    const schools = await db.rows(
      `select sc.id, sc.school_name, sc.lat, sc.lng, ${toOne("provinces", "p", ["code"], "p.id = sc.province_id", "provinces")}
       from school_partners sc where sc.deleted_at is null`,
    );
    return { ngos, schools };
  });
  res.json(result);
});
