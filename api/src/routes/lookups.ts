import { Router } from "express";
import { asUser } from "../auth";
import { cached, CACHE_KEYS } from "../redis";

export const lookupsRouter = Router();

// Provinces and cycles are readable by everyone (RLS `using (true)`), so a
// shared Redis cache is safe — no per-role variation in the result.
lookupsRouter.get("/provinces", async (req, res) => {
  const data = await cached(CACHE_KEYS.provinces, 3600, () =>
    asUser(req, (db) => db.rows("select id, name_en, name_kh, code from provinces order by name_en")),
  );
  res.json(data);
});

lookupsRouter.get("/schools", async (req, res) => {
  const data = await asUser(req, (db) =>
    db.rows("select id, school_name from school_partners where deleted_at is null order by school_name"),
  );
  res.json(data);
});

lookupsRouter.get("/cycles", async (req, res) => {
  const data = await cached(CACHE_KEYS.cycles, 60, () =>
    asUser(req, (db) => db.rows("select id, year, name, status from selection_cycles order by year desc")),
  );
  res.json(data);
});

lookupsRouter.get("/cycles/active", async (req, res) => {
  const data = await cached(CACHE_KEYS.activeCycle, 60, () =>
    asUser(req, (db) =>
      db.one("select id, year, name, status from selection_cycles where status = 'active' limit 1"),
    ),
  );
  res.json(data);
});
