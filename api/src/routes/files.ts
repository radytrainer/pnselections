import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { asUser, requireAuth } from "../auth";
import { withClaims } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { insertRow } from "../sql";
import { storage, type StoredObject } from "../storage";
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
async function getObject(key: string): Promise<StoredObject> {
  let object;
  try {
    object = await storage.get(key);
  } catch {
    throw notFound("File");
  }
  if (!object) throw notFound("File");
  return object;
}

async function sendObject(res: Response, key: string, cacheControl: string) {
  sendStored(res, await getObject(key), cacheControl);
}

/** Streams an already-opened object (the caller hands over its open stream). */
function sendStored(res: Response, object: StoredObject, cacheControl: string) {
  res.setHeader("Content-Type", object.contentType);
  if (object.size !== undefined) res.setHeader("Content-Length", String(object.size));
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Uploaded SVGs are served same-origin: never let one run script if opened directly.
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
  object.body.on("error", () => res.destroy());
  res.on("close", () => object.body.destroy());
  object.body.pipe(res);
}

// ---------------------------------------------------------------------------
// Thumbnails (?w=96): photos are shown in lists at ~28-48px. Letting the
// browser shrink a 1000px+ photo ~30x in one step looks soft and blurry, so
// the server downsizes with a high-quality filter instead. Each size is made
// once and stored next to the originals (originals are never overwritten, so
// a stored thumbnail never goes stale).
// ---------------------------------------------------------------------------
sharp.concurrency(1); // small server: keep memory use low
sharp.cache(false);

const THUMB_WIDTHS = new Set([48, 64, 96, 128, 192, 256, 384, 512, 768]);
const THUMBNAILABLE = new Set(["image/png", "image/jpeg", "image/webp"]);

function thumbWidth(req: Request): number | null {
  const w = Number(req.query.w);
  return THUMB_WIDTHS.has(w) ? w : null;
}

async function readAll(object: StoredObject) {
  const chunks: Buffer[] = [];
  for await (const chunk of object.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Sends a square thumbnail, or the original when it isn't a resizable image. */
async function sendThumbnail(res: Response, key: string, width: number, cacheControl: string) {
  const thumbKey = `_thumbs/${width}/${key}.webp`;
  // Already made: stream the stored thumbnail (opened once, handed straight on).
  const stored = await storage.get(thumbKey).catch(() => null);
  if (stored) return sendStored(res, stored, cacheControl);

  const original = await getObject(key);
  if (!THUMBNAILABLE.has(original.contentType)) return sendStored(res, original, cacheControl);

  const source = await readAll(original);
  let data: Buffer;
  try {
    data = await sharp(source)
      .rotate() // respect camera orientation
      .resize(width, width, { fit: "cover", kernel: "lanczos3", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    // Unreadable image: serve the original rather than failing.
    return sendObject(res, key, cacheControl);
  }
  // Two requests can race to create it; the loser's write fails harmlessly.
  await storage.put(thumbKey, data, "image/webp").catch(() => {});

  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Content-Length", String(data.length));
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(data);
}

function sendFile(req: Request, res: Response, key: string, cacheControl: string) {
  const width = thumbWidth(req);
  return width ? sendThumbnail(res, key, width, cacheControl) : sendObject(res, key, cacheControl);
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
  await sendFile(req, res, `avatars/${keyFromParams(req)}`, "public, max-age=31536000, immutable");
});

/** Private: only callers who can see the matching student_documents row (RLS) get the file. */
filesRouter.get("/student-documents/*path", requireAuth, async (req, res) => {
  const path = keyFromParams(req);
  const visible = await withClaims(req.user!.claims, (db) =>
    db.value<boolean>("select exists (select 1 from student_documents where file_path = $1)", [path]),
  );
  if (!visible) throw notFound("File");
  await sendFile(req, res, `student-documents/${path}`, "private, max-age=86400");
});
