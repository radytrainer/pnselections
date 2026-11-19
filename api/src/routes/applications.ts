/**
 * Scholarship application form (migration 0068).
 *
 * Staff routes (under /api/v1, signed in): create a student's application link,
 * open/close it, set an expiry, issue a new link, and read the answers + files.
 *
 * Public routes (under /api/public, no login): read the form for a link, save
 * answers, upload the profile photo / up to 5 attachments, remove one, and view
 * an uploaded file. They run under an anonymous claim with no table access;
 * everything goes through the public_application_* security-definer functions,
 * which check the link is open.
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { asUser } from "../auth";
import { withClaims } from "../db";
import { badRequest, HttpError, notFound } from "../errors";
import { rateLimitHit } from "../redis";
import { storage } from "../storage";
import { uuidParam } from "./util";

export const applicationsRouter = Router();
export const publicApplicationRouter = Router();

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  "application/pdf": { ext: "pdf", magic: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
};

/** Statuses before the interview result; an exam/interview fail is out of the process. */
const PASSED_INTERVIEW_SQL = `s.status not in ('registered','exam_completed')
  and not (s.status = 'eliminated' and (s.elimination_reason like 'Did not pass the written exam%' or s.elimination_reason = 'Did not pass the Motivation Interview'))`;

const APPLICATION_COLUMNS = `a.id, a.student_id, a.token, a.link_open, a.expires_at, a.data, a.submitted_at, a.created_at, a.updated_at`;

async function readApplication(req: Request, studentId: string) {
  return asUser(req, async (db) => {
    const app = await db.one<{ id: string }>(`select ${APPLICATION_COLUMNS} from scholarship_applications a where a.student_id = $1`, [studentId]);
    if (!app) return null;
    const files = await db.rows(
      `select id, doc_type, file_path, original_name, uploaded_at from student_documents
        where application_id = $1 order by uploaded_at`,
      [app.id],
    );
    return { ...app, files };
  });
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
applicationsRouter.get("/students/:id/application", async (req, res) => {
  res.json(await readApplication(req, uuidParam(req, "id")));
});

/** Creates the student's link (once they've passed the interview). Returns the existing one if already made. */
applicationsRouter.post("/students/:id/application", async (req, res) => {
  const studentId = uuidParam(req, "id");
  await asUser(req, async (db) => {
    const passed = await db.value<boolean>(`select ${PASSED_INTERVIEW_SQL} from students s where s.id = $1 and s.deleted_at is null`, [studentId]);
    if (passed === null) throw notFound("Student");
    if (!passed) throw badRequest("The application form is only for students who passed the interview");
    await db.exec("insert into scholarship_applications (student_id) values ($1) on conflict (student_id) do nothing", [studentId]);
  });
  res.status(201).json(await readApplication(req, studentId));
});

applicationsRouter.patch("/students/:id/application", async (req, res) => {
  const studentId = uuidParam(req, "id");
  const input = z
    .object({ linkOpen: z.boolean().optional(), expiresAt: z.string().datetime({ offset: true }).nullable().optional() })
    .parse(req.body);
  await asUser(req, async (db) => {
    const r = await db.exec(
      `update scholarship_applications set
         link_open = coalesce($2, link_open),
         expires_at = case when $3 then $4::timestamptz else expires_at end
       where student_id = $1`,
      [studentId, input.linkOpen ?? null, input.expiresAt !== undefined, input.expiresAt ?? null],
    );
    if (!r.rowCount) throw notFound("Application");
  });
  res.json({ ok: true });
});

/** New link: the old link and QR code stop working at once. Answers and files are kept. */
applicationsRouter.post("/students/:id/application/new-link", async (req, res) => {
  const studentId = uuidParam(req, "id");
  const token = await asUser(req, (db) =>
    db.value<string>("update scholarship_applications set token = replace(gen_random_uuid()::text, '-', '') where student_id = $1 returning token", [studentId]),
  );
  if (!token) throw notFound("Application");
  res.json({ token });
});

// ---------------------------------------------------------------------------
// Public (no login)
// ---------------------------------------------------------------------------
const PUBLIC_CLAIMS = { sub: "public-application", app_role: "public" };
const token = (req: Request) => {
  const t = String(req.params.token ?? "");
  if (!/^[a-f0-9]{32}$/.test(t)) throw new HttpError(404, "This application link doesn't exist");
  return t;
};
const asPublic = <T>(fn: Parameters<typeof withClaims<T>>[1]) => withClaims<T>(PUBLIC_CLAIMS, fn);

publicApplicationRouter.get("/apply/:token", async (req, res) => {
  const t = token(req);
  res.setHeader("Cache-Control", "no-store");
  res.json(await asPublic((db) => db.value("select public_application_form($1)", [t])));
});

/**
 * Answers: a flat object of short texts, lists of choices and yes/no flags.
 * The form's exact questions live in the web app; here only the shape and
 * sizes are enforced.
 */
const answerValue = z.union([z.string().max(2000), z.boolean(), z.array(z.string().max(100)).max(20), z.null()]);
const answers = z.record(z.string().regex(/^[a-z][a-z0-9_]{0,40}$/), answerValue).refine((o) => Object.keys(o).length <= 100, "Too many fields");

publicApplicationRouter.post("/apply/:token", async (req, res) => {
  const t = token(req);
  if (!(await rateLimitHit(`apply:${req.ip}`, 60, 600))) {
    res.status(429).json({ ok: false, reason: "too_many" });
    return;
  }
  const parsed = answers.safeParse(req.body?.data);
  if (!parsed.success) {
    res.json({ ok: false, reason: "bad_data" });
    return;
  }
  res.json(await asPublic((db) => db.value("select public_application_submit($1, $2::jsonb)", [t, JSON.stringify(parsed.data)])));
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } }).single("file");

function runUpload(req: Request, res: Response) {
  return new Promise<void>((resolve, reject) =>
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") reject(new HttpError(413, "file_too_large"));
      else if (err) reject(err);
      else resolve();
    }),
  );
}

/** ?kind=photo (PNG/JPEG/WebP, replaces the previous photo) or ?kind=file (also PDF; max 5). */
publicApplicationRouter.post("/apply/:token/files", async (req, res) => {
  const t = token(req);
  if (!(await rateLimitHit(`apply-upload:${req.ip}`, 40, 600))) {
    res.status(429).json({ ok: false, reason: "too_many" });
    return;
  }
  const kind = req.query.kind === "photo" ? "photo" : req.query.kind === "file" ? "file" : null;
  if (!kind) throw badRequest("kind must be photo or file");
  try {
    await runUpload(req, res);
  } catch (e) {
    if (e instanceof HttpError && e.message === "file_too_large") {
      res.json({ ok: false, reason: "file_too_large" });
      return;
    }
    throw e;
  }
  const file = req.file;
  const type = file ? FILE_TYPES[file.mimetype] : undefined;
  if (!file || !type || (kind === "photo" && file.mimetype === "application/pdf") || !type.magic(file.buffer)) {
    res.json({ ok: false, reason: "bad_file" });
    return;
  }
  // Multer decodes the multipart filename as latin1; Khmer names need utf8.
  const name = Buffer.from(file.originalname, "latin1").toString("utf8").slice(0, 200);
  // Row + file in one transaction: if storing fails, the row is rolled back.
  const result = await asPublic(async (db) => {
    const r = await db.value<{ ok: boolean; reason?: string; id?: string; path?: string }>(
      "select public_application_add_file($1, $2, $3, $4)",
      [t, kind, type.ext, name],
    );
    if (!r?.ok || !r.path) return r ?? { ok: false };
    await storage.put(`student-documents/${r.path}`, file.buffer, file.mimetype);
    return { ok: true, id: r.id, kind, name };
  });
  res.json(result);
});

/** Removes one of the application's uploaded files. */
publicApplicationRouter.delete("/apply/:token/files/:docId", async (req, res) => {
  const t = token(req);
  const docId = uuidParam(req, "docId");
  res.json(await asPublic((db) => db.value("select public_application_remove_file($1, $2)", [t, docId])));
});

/** Shows the student one of their own uploads (while the link is open). */
publicApplicationRouter.get("/apply/:token/files/:docId", async (req, res) => {
  const t = token(req);
  const docId = uuidParam(req, "docId");
  const path = await asPublic((db) => db.value<string>("select public_application_file_path($1, $2)", [t, docId]));
  if (!path) throw notFound("File");
  const object = await storage.get(`student-documents/${path}`).catch(() => null);
  if (!object) throw notFound("File");
  res.setHeader("Content-Type", object.contentType);
  if (object.size !== undefined) res.setHeader("Content-Length", String(object.size));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  object.body.on("error", () => res.destroy());
  res.on("close", () => object.body.destroy());
  object.body.pipe(res);
});
