import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { asUser, requireAuth } from "../auth";
import { withClaims } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { insertRow } from "../sql";
import { storage } from "../storage";
import { uuidParam } from "./util";

/**
 * Replaces Supabase Storage. Same three logical buckets and the same access
 * rules the storage.objects policies enforced (migrations 0007/0008/0012):
 *   partner-logos      public read; write: super_admin, program_manager, ngo_partner
 *   avatars            public read; write: any signed-in user, own folder only
 *   student-documents  PRIVATE; read mirrors student_documents RLS;
 *                      write: super_admin, program_manager, selection_team
 * Files are written under fresh random UUID names and never overwritten, so
 * they're safe to cache for a long time.
 */
export const filesRouter = Router();
export const uploadsRouter = Router();

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Checks the file's leading bytes actually match its declared image type. */
function looksLike(mime: string, data: Buffer) {
  switch (mime) {
    case "image/png":
      return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/jpeg":
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/webp":
      return data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
    case "image/svg+xml": {
      const head = data.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
      return head.startsWith("<svg") || head.startsWith("<?xml");
    }
    default:
      return false;
  }
}

function imageUpload(maxBytes: number) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } }).single("file");
}

function readImage(req: Request, allowed: string[], label: string) {
  const file = req.file;
  if (!file) throw badRequest("No file uploaded");
  if (!allowed.includes(file.mimetype) || !looksLike(file.mimetype, file.buffer)) {
    throw badRequest(`${label} must be a ${allowed.map((m) => EXTENSIONS[m].toUpperCase()).join(", ")} image.`);
  }
  return { data: file.buffer, mime: file.mimetype, ext: EXTENSIONS[file.mimetype] };
}

const publicUrl = (key: string) => `/api/v1/files/${key}`;

// ---------------------------------------------------------------------------
// Uploads (signed in)
// ---------------------------------------------------------------------------
uploadsRouter.post("/partner-logo", imageUpload(MAX_IMAGE_BYTES), async (req, res) => {
  if (!["super_admin", "program_manager", "ngo_partner"].includes(req.user?.role ?? "")) throw forbidden();
  const kind = req.query.kind === "schools" ? "schools" : req.query.kind === "ngos" ? "ngos" : null;
  if (!kind) throw badRequest("kind must be ngos or schools");
  const image = readImage(req, ["image/png", "image/jpeg", "image/webp", "image/svg+xml"], "Logo");
  const key = `partner-logos/${kind}/${randomUUID()}.${image.ext}`;
  await storage.put(key, image.data, image.mime);
  res.status(201).json({ url: publicUrl(key) });
});

uploadsRouter.post("/avatar", imageUpload(MAX_IMAGE_BYTES), async (req, res) => {
  const image = readImage(req, ["image/png", "image/jpeg", "image/webp"], "Photo");
  const key = `avatars/${req.user!.uid}/${randomUUID()}.${image.ext}`;
  await storage.put(key, image.data, image.mime);
  res.status(201).json({ url: publicUrl(key) });
});

/**
 * Records a `doc_type='photo'` student_documents row (RLS-checked) and
 * stores the file in the same transaction — if either fails, neither sticks.
 * Returns the storage path (relative to the student-documents bucket).
 */
uploadsRouter.post("/student-photo/:studentId", imageUpload(MAX_DOCUMENT_BYTES), async (req, res) => {
  const studentId = uuidParam(req, "studentId");
  if (!["super_admin", "program_manager", "selection_team"].includes(req.user?.role ?? "")) throw forbidden();
  const image = readImage(req, ["image/png", "image/jpeg", "image/webp"], "Photo");
  const path = `${studentId}/${randomUUID()}.${image.ext}`;

  await asUser(req, async (db) => {
    await insertRow(db, "student_documents", { student_id: studentId, doc_type: "photo", file_path: path });
    await storage.put(`student-documents/${path}`, image.data, image.mime);
  });
  res.status(201).json({ path });
});

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------
async function sendObject(res: Response, key: string, cacheControl: string) {
  let object;
  try {
    object = await storage.get(key);
  } catch {
    throw notFound("File");
  }
  if (!object) throw notFound("File");

  res.setHeader("Content-Type", object.contentType);
  if (object.size !== undefined) res.setHeader("Content-Length", String(object.size));
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Uploaded SVGs are served same-origin: never let one run script if opened directly.
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
  object.body.pipe(res);
}

function keyFromParams(req: Request) {
  const segments = (req.params as Record<string, unknown>).path;
  const path = Array.isArray(segments) ? segments.join("/") : String(segments ?? "");
  if (!path) throw notFound("File");
  return path;
}

filesRouter.get("/partner-logos/*path", async (req, res) => {
  await sendObject(res, `partner-logos/${keyFromParams(req)}`, "public, max-age=31536000, immutable");
});

filesRouter.get("/avatars/*path", async (req, res) => {
  await sendObject(res, `avatars/${keyFromParams(req)}`, "public, max-age=31536000, immutable");
});

/** Private: only callers who can see the matching student_documents row (RLS) get the file. */
filesRouter.get("/student-documents/*path", requireAuth, async (req, res) => {
  const path = keyFromParams(req);
  const visible = await withClaims(req.user!.claims, (db) =>
    db.value<boolean>("select exists (select 1 from student_documents where file_path = $1)", [path]),
  );
  if (!visible) throw notFound("File");
  await sendObject(res, `student-documents/${path}`, "private, max-age=86400");
});
