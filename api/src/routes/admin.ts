import { Router } from "express";
import { z } from "zod";
import { asUser, firebaseAuth, ID_TOKEN_COOKIE, setUserClaims, verifyIdToken } from "../auth";
import type { Db } from "../db";
import { badRequest, HttpError, notFound } from "../errors";
import { deleteRows, insertRow, updateRows } from "../sql";
import { uuidParam } from "./util";

const APP_ROLES = [
  "super_admin",
  "program_manager",
  "selection_team",
  "interview_team",
  "home_visit_team",
  "committee_member",
  "ngo_partner",
  "donor",
] as const;

// ---------------------------------------------------------------------------
// Session cookie (POST/DELETE /api/auth/session)
// ---------------------------------------------------------------------------
export const sessionRouter = Router();

/**
 * Mirrors the client's Firebase ID token into an HTTP-only cookie, used by
 * the Next.js middleware (route gating) and by plain <img>/EventSource
 * requests that can't send an Authorization header.
 */
sessionRouter.post("/session", async (req, res) => {
  const idToken = (req.body as { idToken?: unknown } | undefined)?.idToken;
  if (typeof idToken !== "string" || !idToken) throw badRequest("idToken is required");

  const claims = await verifyIdToken(idToken);
  if (!claims) throw new HttpError(401, "invalid or expired token");

  res.cookie(ID_TOKEN_COOKIE, idToken, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "lax",
    path: "/",
    // Firebase ID tokens expire after 1h; the client refreshes the cookie before that.
    maxAge: 55 * 60 * 1000,
  });
  res.json({ uid: claims.sub });
});

sessionRouter.delete("/session", (req, res) => {
  res.clearCookie(ID_TOKEN_COOKIE, { path: "/" });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// User administration (/api/admin/users, super_admin only — see app.ts)
// DB writes run under the caller's own super_admin claims, which RLS
// (users_admin_write) already permits; no RLS-bypassing role is needed.
// ---------------------------------------------------------------------------
export const adminRouter = Router();

const ngoIdSchema = z.union([z.string().uuid(), z.literal(""), z.null()]).optional();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  role: z.enum(APP_ROLES),
  ngoId: ngoIdSchema,
});

const updateUserSchema = z.object({
  email: z.string().email(),
  password: z.union([z.string().min(6), z.literal("")]),
  fullName: z.string().min(1),
  role: z.enum(APP_ROLES),
  ngoId: ngoIdSchema,
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  return parsed.data;
}

async function assignRole(db: Db, userId: string, role: string, ngoId: string | null | undefined) {
  const roleId = await db.value<string>("select id from roles where name = $1", [role]);
  if (!roleId) throw new HttpError(500, `Role ${role} is not seeded`);

  await deleteRows(db, "user_roles", { user_id: userId });
  await insertRow(db, "user_roles", { user_id: userId, role_id: roleId });

  await deleteRows(db, "user_ngo_link", { user_id: userId });
  if (role === "ngo_partner" && ngoId) {
    await insertRow(db, "user_ngo_link", { user_id: userId, ngo_id: ngoId });
  }
}

adminRouter.get("/users", async (req, res) => {
  const rows = await asUser(req, (db) =>
    db.rows<{
      id: string;
      email: string;
      full_name: string;
      status: string;
      created_at: string;
      role: string | null;
      ngo_id: string | null;
    }>(
      `select u.id, u.email, u.full_name, u.status, u.created_at,
         (select r.name from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id limit 1) as role,
         (select l.ngo_id from user_ngo_link l where l.user_id = u.id limit 1) as ngo_id
       from users u order by u.created_at desc`,
    ),
  );
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      status: u.status,
      created_at: u.created_at,
      role: u.role,
      ngoId: u.ngo_id,
    })),
  });
});

/**
 * Creates (or updates, if the email already exists) the Firebase user with
 * the password the super admin sets, the users/user_roles rows, and the
 * role/ngo_id custom claims.
 */
adminRouter.post("/users/create", async (req, res) => {
  const { email, password, fullName, role, ngoId } = parse(createUserSchema, req.body);
  if (role === "ngo_partner" && !ngoId) throw badRequest("ngoId is required for the ngo_partner role");

  const auth = firebaseAuth();
  let firebaseUser;
  try {
    const existing = await auth.getUserByEmail(email).catch(() => null);
    firebaseUser = existing
      ? await auth.updateUser(existing.uid, { password, displayName: fullName })
      : await auth.createUser({ email, password, displayName: fullName });
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Failed to create Firebase user");
  }

  const userId = await asUser(req, async (db) => {
    const row = await insertRow(
      db,
      "users",
      { firebase_uid: firebaseUser.uid, email, full_name: fullName, status: "active" },
      { onConflict: ["firebase_uid"], returning: true },
    );
    await assignRole(db, row!.id as string, role, ngoId);
    return row!.id as string;
  });

  await setUserClaims(firebaseUser.uid, { role, ngo_id: role === "ngo_partner" ? ngoId : null });
  res.json({ ok: true, userId });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const { email, password, fullName, role, ngoId } = parse(updateUserSchema, req.body);
  if (role === "ngo_partner" && !ngoId) throw badRequest("ngoId is required for the ngo_partner role");

  const firebaseUid = await asUser(req, (db) => db.value<string>("select firebase_uid from users where id = $1", [id]));
  if (!firebaseUid) throw notFound("User");

  try {
    await firebaseAuth().updateUser(firebaseUid, { email, displayName: fullName, ...(password ? { password } : {}) });
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Failed to update Firebase user");
  }

  await asUser(req, async (db) => {
    await updateRows(db, "users", { email, full_name: fullName }, { id });
    await assignRole(db, id, role, ngoId);
  });

  await setUserClaims(firebaseUid, { role, ngo_id: role === "ngo_partner" ? ngoId : null });
  res.json({ ok: true });
});

adminRouter.delete("/users/:id", async (req, res) => {
  const id = uuidParam(req, "id");
  const firebaseUid = await asUser(req, (db) => db.value<string>("select firebase_uid from users where id = $1", [id]));
  if (!firebaseUid) throw notFound("User");

  try {
    await firebaseAuth().deleteUser(firebaseUid);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Failed to delete Firebase user");
  }

  await asUser(req, (db) => deleteRows(db, "users", { id }));
  res.json({ ok: true });
});
