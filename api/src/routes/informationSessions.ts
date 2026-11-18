/**
 * Information sessions + online self-registration (migration 0061).
 *
 * Staff routes (mounted under /api/v1, signed in): manage sessions and their
 * registration links, review registrations, and add them to the cycle's exam
 * candidates.
 *
 * Public routes (mounted under /api/public, no login): read the form for a link
 * and submit a registration. They run under an anonymous claim that has no
 * table access; everything goes through the public_registration_form /
 * public_register security-definer functions, which check the link is open.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { asUser } from "../auth";
import { withClaims } from "../db";
import { badRequest, HttpError, notFound } from "../errors";
import { publish, rateLimitHit, subscribe } from "../redis";
import { deleteRows, insertRow, updateRows } from "../sql";
import { qs, uuidParam } from "./util";
import { assertUnlocked, nextNumbers } from "./writtenExams";

export const informationSessionsRouter = Router();
/** Redis channel for "a student just registered" on one session (live display). */
const liveChannel = (sessionId: string) => `is-registrations:${sessionId}`;
export const publicRegistrationRouter = Router();
const uuid = z.string().uuid();

const sessionFields = {
  name: z.string().trim().min(1).max(160),
  venue: z.string().trim().max(200).nullish(),
  provinceId: uuid.nullish(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().trim().max(1000).nullish(),
  defaultExamCenterId: uuid.nullish(),
  regOpen: z.boolean().optional(),
  regExpiresAt: z.string().datetime({ offset: true }).nullish(),
};

function sessionColumns(input: Partial<Record<keyof typeof sessionFields, unknown>>) {
  const map: Record<string, string> = {
    name: "name",
    venue: "venue",
    provinceId: "province_id",
    sessionDate: "session_date",
    notes: "notes",
    defaultExamCenterId: "default_exam_center_id",
    regOpen: "reg_open",
    regExpiresAt: "reg_expires_at",
  };
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) {
    const v = (input as Record<string, unknown>)[k];
    if (v !== undefined) out[col] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

informationSessionsRouter.get("/information-sessions", async (req, res) => {
  const cycleId = qs(req, "cycleId");
  if (!cycleId || !uuid.safeParse(cycleId).success) throw badRequest("cycleId is required");
  res.json(
    await asUser(req, (db) =>
      db.rows(
        `select s.*,
           (select p.name_en from provinces p where p.id = s.province_id) as province_name,
           (select ec.name from exam_centers ec where ec.id = s.default_exam_center_id) as default_exam_center_name,
           (select count(*)::int from is_registrations r where r.session_id = s.id) as registrations,
           (select count(*)::int from is_registrations r where r.session_id = s.id and r.gender = 'female') as girls,
           (select count(*)::int from is_registrations r where r.session_id = s.id and r.gender = 'male') as boys,
           (select count(*)::int from is_registrations r where r.session_id = s.id and r.candidate_id is not null) as added
         from information_sessions s where s.cycle_id = $1
         order by s.session_date desc nulls last, s.created_at desc`,
        [cycleId],
      ),
    ),
  );
});

informationSessionsRouter.post("/information-sessions", async (req, res) => {
  const input = z.object({ cycleId: uuid, ...sessionFields }).parse(req.body);
  const row = await asUser(req, async (db) => {
    if (input.defaultExamCenterId && !(await db.value<boolean>("select exists (select 1 from exam_centers where id = $1 and cycle_id = $2)", [input.defaultExamCenterId, input.cycleId]))) {
      throw badRequest("That exam center belongs to another cycle");
    }
    return insertRow(db, "information_sessions", { cycle_id: input.cycleId, ...sessionColumns(input) }, { returning: true });
  });
  res.status(201).json(row);
});

informationSessionsRouter.patch("/information-sessions/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z.object(sessionFields).partial().parse(req.body);
  await asUser(req, async (db) => {
    const cycleId = await db.value<string>("select cycle_id from information_sessions where id = $1", [id]);
    if (!cycleId) throw notFound("Information session");
    if (input.defaultExamCenterId && !(await db.value<boolean>("select exists (select 1 from exam_centers where id = $1 and cycle_id = $2)", [input.defaultExamCenterId, cycleId]))) {
      throw badRequest("That exam center belongs to another cycle");
    }
    const cols = sessionColumns(input);
    if (Object.keys(cols).length) await updateRows(db, "information_sessions", cols, { id });
  });
  res.json({ ok: true });
});

/** New link: the old link and QR code stop working at once. */
informationSessionsRouter.post("/information-sessions/:id/new-link", async (req, res) => {
  const id = uuidParam(req, "id");
  const token = await asUser(req, async (db) => {
    const t = await db.value<string>(
      "update information_sessions set reg_token = replace(gen_random_uuid()::text, '-', '') where id = $1 returning reg_token",
      [id],
    );
    if (!t) throw notFound("Information session");
    return t;
  });
  res.json({ regToken: token });
});

informationSessionsRouter.delete("/information-sessions/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  await asUser(req, async (db) => {
    const n = await deleteRows(db, "information_sessions", { id });
    if (!n) throw notFound("Information session");
  });
  res.json({ ok: true });
});

informationSessionsRouter.get("/information-sessions/:id/registrations", async (req, res) => {
  const id = uuidParam(req, "id");
  res.json(
    await asUser(req, (db) =>
      db.rows(
        `select r.*,
           (select p.name_en from provinces p where p.id = r.province_id) as province_name,
           (select ec.name from exam_centers ec where ec.id = r.exam_center_id) as exam_center_name,
           (select c.exam_number from exam_candidates c where c.id = r.candidate_id) as exam_number,
           -- Possible duplicates (migration 0063 rules): an existing exam candidate with the
           -- same name + birth date, or an earlier registration in the cycle (same name and
           -- same birth date or phone).
           case when r.candidate_id is null then (
             select c.exam_number from exam_candidates c
              where c.cycle_id = r.cycle_id and c.dob = r.dob
                and (same_person_name(c.first_name, c.last_name, r.first_name, r.last_name)
                     or person_name_key(c.full_name) in (person_name_key(r.first_name) || person_name_key(r.last_name), person_name_key(r.last_name) || person_name_key(r.first_name)))
              limit 1) end as duplicate_candidate,
           (select o.created_at from is_registrations o
             where o.cycle_id = r.cycle_id and o.id <> r.id and o.created_at < r.created_at
               and same_person_name(o.first_name, o.last_name, r.first_name, r.last_name)
               and (o.dob = r.dob or (length(phone_key(r.phone)) >= 8 and phone_key(o.phone) = phone_key(r.phone)))
             order by o.created_at limit 1) as duplicate_of_registration
         from is_registrations r where r.session_id = $1 order by r.created_at desc`,
        [id],
      ),
    ),
  );
});

/**
 * What the full-screen live display shows: names and counts only (no phone,
 * date of birth or school — it goes on a projector).
 */
informationSessionsRouter.get("/information-sessions/:id/live", async (req, res) => {
  const id = uuidParam(req, "id");
  const data = await asUser(req, async (db) => {
    const session = await db.one(
      `select s.id, s.name, s.venue, s.session_date, s.reg_token, s.reg_open, s.reg_expires_at,
         (select p.name_en from provinces p where p.id = s.province_id) as province_name
       from information_sessions s where s.id = $1`,
      [id],
    );
    if (!session) throw notFound("Information session");
    const counts = await db.one<{ total: number; female: number; male: number; other: number }>(
      `select count(*)::int as total,
              count(*) filter (where gender = 'female')::int as female,
              count(*) filter (where gender = 'male')::int as male,
              count(*) filter (where gender = 'lgbtqia+')::int as other
         from is_registrations where session_id = $1`,
      [id],
    );
    const recent = await db.rows(
      `select id, first_name, last_name, gender, created_at from is_registrations
        where session_id = $1 order by created_at desc limit 500`,
      [id],
    );
    return { session, counts, recent };
  });
  res.setHeader("Cache-Control", "no-store");
  res.json(data);
});

/** Server-Sent Events: "registered" each time a student submits the form for this session. */
informationSessionsRouter.get("/information-sessions/:id/stream", async (req, res) => {
  const id = uuidParam(req, "id");
  // RLS check: only staff who can see the session may listen.
  const ok = await asUser(req, (db) => db.value<boolean>("select exists (select 1 from information_sessions where id = $1)", [id]));
  if (!ok) throw notFound("Information session");
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  const unsubscribe = subscribe(liveChannel(id), () => res.write("event: registered\ndata: {}\n\n"));
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

const regFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  gender: z.enum(["male", "female", "lgbtqia+"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  phone: z.string().trim().max(30).nullish(),
  highSchool: z.string().trim().max(200).nullish(),
  grade: z.string().trim().max(20).nullish(),
  provinceId: uuid.nullish(),
  examCenterId: uuid.nullish(),
};

informationSessionsRouter.patch("/is-registrations/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const input = z.object(regFields).partial().parse(req.body);
  const cols: Record<string, unknown> = {};
  const map: Record<string, string> = {
    firstName: "first_name", lastName: "last_name", gender: "gender", dob: "dob", phone: "phone",
    highSchool: "high_school", grade: "grade", provinceId: "province_id", examCenterId: "exam_center_id",
  };
  for (const [k, col] of Object.entries(map)) {
    const v = (input as Record<string, unknown>)[k];
    if (v !== undefined) cols[col] = v === "" ? null : v;
  }
  await asUser(req, async (db) => {
    const cycleId = await db.value<string>("select cycle_id from is_registrations where id = $1", [id]);
    if (!cycleId) throw notFound("Registration");
    if (input.examCenterId && !(await db.value<boolean>("select exists (select 1 from exam_centers where id = $1 and cycle_id = $2)", [input.examCenterId, cycleId]))) {
      throw badRequest("That exam center belongs to another cycle");
    }
    if (Object.keys(cols).length) await updateRows(db, "is_registrations", cols, { id });
  });
  res.json({ ok: true });
});

informationSessionsRouter.post("/is-registrations/remove", async (req, res) => {
  const { ids } = z.object({ ids: z.array(uuid).min(1).max(5000) }).parse(req.body);
  const removed = await asUser(req, async (db) => {
    const r = await db.exec("delete from is_registrations where id = any($1::uuid[])", [ids]);
    return r.rowCount ?? 0;
  });
  res.json({ removed });
});

/**
 * Adds registrations to the cycle's exam candidates: a new exam number each
 * (after the highest existing one), their details and chosen exam center.
 * Registrations already added are skipped.
 */
informationSessionsRouter.post("/is-registrations/to-candidates", async (req, res) => {
  const input = z.object({ ids: z.array(uuid).min(1).max(5000), startNumber: z.number().int().min(1).max(999999999).optional(), digits: z.number().int().min(1).max(9).optional() }).parse(req.body);
  const result = await asUser(req, async (db) => {
    const regs = await db.rows<{
      id: string; cycle_id: string; first_name: string; last_name: string; gender: string; dob: string | null;
      high_school: string | null; province_name: string | null; exam_center_id: string | null;
    }>(
      `select r.id, r.cycle_id, r.first_name, r.last_name, r.gender, r.dob::text as dob, r.high_school,
              (select p.name_en from provinces p where p.id = r.province_id) as province_name, r.exam_center_id
         from is_registrations r where r.id = any($1::uuid[]) and r.candidate_id is null
        order by r.created_at`,
      [input.ids],
    );
    if (regs.length === 0) return { added: 0, skipped: input.ids.length };
    const cycles = new Set(regs.map((r) => r.cycle_id));
    if (cycles.size > 1) throw badRequest("Registrations from different cycles can't be added together");
    const cycleId = regs[0].cycle_id;
    await assertUnlocked(db, cycleId);
    // Already an exam candidate (same name + birth date, e.g. from an imported list)?
    // Link to that candidate instead of creating a second one.
    const toCreate: typeof regs = [];
    let matched = 0;
    const taken = new Set<string>();
    for (const r of regs) {
      const existing = r.dob
        ? await db.value<string>(
            `select c.id from exam_candidates c
              where c.cycle_id = $1 and c.dob = $2::date
                and (same_person_name(c.first_name, c.last_name, $3, $4)
                     or person_name_key(c.full_name) in (person_name_key($3) || person_name_key($4), person_name_key($4) || person_name_key($3)))
              order by c.exam_number limit 1`,
            [cycleId, r.dob, r.first_name, r.last_name],
          )
        : null;
      if (existing && !taken.has(existing)) {
        taken.add(existing);
        await updateRows(db, "is_registrations", { candidate_id: existing }, { id: r.id });
        // Give the candidate the chosen exam center if it has none yet.
        if (r.exam_center_id) await db.exec("update exam_candidates set center_id = $1 where id = $2 and center_id is null", [r.exam_center_id, existing]);
        matched++;
      } else toCreate.push(r);
    }
    if (toCreate.length === 0) return { added: 0, matched, skipped: input.ids.length - regs.length };
    const numbers = await nextNumbers(db, cycleId, toCreate.length, input.startNumber, input.digits);
    for (const [i, r] of toCreate.entries()) {
      const cand = await insertRow(
        db,
        "exam_candidates",
        {
          cycle_id: cycleId,
          exam_number: numbers[i],
          full_name: `${r.first_name} ${r.last_name}`.trim(),
          first_name: r.first_name,
          last_name: r.last_name,
          gender: r.gender,
          dob: r.dob,
          high_school: r.high_school,
          province: r.province_name,
          center_id: r.exam_center_id,
        },
        { returning: true },
      );
      await updateRows(db, "is_registrations", { candidate_id: cand!.id }, { id: r.id });
    }
    return { added: toCreate.length, matched, skipped: input.ids.length - regs.length, first: numbers[0], last: numbers[numbers.length - 1] };
  });
  res.json(result);
});

// ---------------------------------------------------------------------------
// Public (no login)
// ---------------------------------------------------------------------------
const PUBLIC_CLAIMS = { sub: "public-registration", app_role: "public" };
const token = (req: Request) => {
  const t = String(req.params.token ?? "");
  if (!/^[a-f0-9]{32}$/.test(t)) throw new HttpError(404, "This registration link doesn't exist");
  return t;
};

publicRegistrationRouter.get("/register/:token", async (req, res) => {
  const t = token(req);
  const form = await withClaims(PUBLIC_CLAIMS, (db) => db.value("select public_registration_form($1)", [t]));
  res.setHeader("Cache-Control", "no-store");
  res.json(form);
});

publicRegistrationRouter.post("/register/:token", async (req, res) => {
  const t = token(req);
  // At most 20 submissions per device per 10 minutes (a classroom on one phone is fine).
  if (!(await rateLimitHit(`register:${req.ip}`, 20, 600))) {
    res.status(429).json({ ok: false, reason: "too_many" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  // Honeypot: a hidden field people never fill; bots that do get a silent "ok".
  if (typeof body.website === "string" && body.website.trim() !== "") {
    res.json({ ok: true });
    return;
  }
  const pick = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).slice(0, max) : null);
  const data = {
    first_name: pick("firstName", 100),
    last_name: pick("lastName", 100),
    gender: pick("gender", 10),
    dob: pick("dob", 10),
    phone: pick("phone", 30),
    high_school: pick("highSchool", 200),
    grade: pick("grade", 20),
    province_id: pick("provinceId", 36),
    exam_center_id: pick("examCenterId", 36),
  };
  const result = await withClaims(PUBLIC_CLAIMS, (db) =>
    db.value<{ ok: boolean; reason?: string; duplicate?: boolean; session_id?: string }>("select public_register($1, $2::jsonb)", [t, JSON.stringify(data)]),
  );
  const { session_id: sessionId, ...answer } = result ?? { ok: false };
  // Tell any live display for this session (new registrations only).
  if (answer.ok && !answer.duplicate && sessionId) await publish(liveChannel(sessionId), { at: Date.now() });
  res.json(answer);
});
