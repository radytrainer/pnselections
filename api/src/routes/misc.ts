import { Router } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import { badRequest, forbidden } from "../errors";
import { invalidate, CACHE_KEYS } from "../redis";
import { insertRow, updateRows } from "../sql";
import { uuidParam } from "./util";

/** Selection Process funnel stats + the signed-in user's own profile. */
export const miscRouter = Router();

const STATS_TABLES = {
  informationSessions: "information_session_stats",
  examCenters: "exam_center_stats",
  examResults: "exam_result_stats",
  interviewCenters: "interview_center_stats",
  interviewResults: "interview_result_stats",
} as const;

miscRouter.get("/selection-process/:cycleId", async (req, res) => {
  const cycleId = uuidParam(req, "cycleId");
  const result = await asUser(req, async (db) => {
    const out: Record<string, unknown> = {};
    for (const [key, table] of Object.entries(STATS_TABLES)) {
      out[key] = await db.one(`select * from ${table} where cycle_id = $1`, [cycleId]);
    }
    return out;
  });
  res.json(result);
});

miscRouter.put("/selection-process/:cycleId/:section", async (req, res) => {
  const cycleId = uuidParam(req, "cycleId");
  const table = STATS_TABLES[req.params.section as keyof typeof STATS_TABLES];
  if (!table) throw badRequest("Unknown section");
  const values = z.record(z.string(), z.unknown()).parse(req.body);
  await asUser(req, (db) => insertRow(db, table, { ...values, cycle_id: cycleId }, { onConflict: ["cycle_id"] }));
  res.json({ ok: true });
});

// RLS (0008) lets every user read/update only their own row (admins: any row).
miscRouter.get("/users/by-firebase-uid/:uid", async (req, res) => {
  res.json(await asUser(req, (db) => db.one("select * from users where firebase_uid = $1", [req.params.uid])));
});

miscRouter.patch("/users/by-firebase-uid/:uid", async (req, res) => {
  const values = z
    .object({ full_name: z.string().min(1), phone: z.string().nullable(), avatar_url: z.string().nullable() })
    .parse(req.body);
  await asUser(req, (db) => updateRows(db, "users", values, { firebase_uid: req.params.uid }));
  res.json({ ok: true });
});

/** Cycles are cached in Redis; this lets an admin tool force a refresh after editing them in SQL. */
miscRouter.post("/cache/lookups/invalidate", async (req, res) => {
  if (req.user?.role !== "super_admin" && req.user?.role !== "program_manager") throw forbidden();
  await invalidate(CACHE_KEYS.provinces, CACHE_KEYS.cycles, CACHE_KEYS.activeCycle);
  res.json({ ok: true });
});
