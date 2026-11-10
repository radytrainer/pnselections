import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "./config";
import { withClaims, type Claims, type Db } from "./db";
import { forbidden, HttpError } from "./errors";
import { redis } from "./redis";

export const ID_TOKEN_COOKIE = "fb_id_token";

export type AuthUser = {
  uid: string;
  role: string | null;
  ngoId: string | null;
  claims: Claims;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function firebaseApp() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    }),
  });
}

export function firebaseAuth() {
  return getAuth(firebaseApp());
}

type TokenVerifier = (idToken: string) => Promise<Claims>;

let verifier: TokenVerifier = async (idToken) =>
  (await firebaseAuth().verifyIdToken(idToken)) as unknown as Claims;

/** Swaps the token verifier (used by the local smoke-test script only). */
export function setTokenVerifier(fn: TokenVerifier) {
  verifier = fn;
}

/**
 * Verifies a Firebase ID token, memoizing the decoded claims in Redis until
 * shortly before the token expires so repeat requests skip the signature check.
 */
export async function verifyIdToken(idToken: string): Promise<Claims | null> {
  const cacheKey = `auth:token:${createHash("sha256").update(idToken).digest("hex")}`;
  try {
    const hit = await redis.get(cacheKey);
    if (hit) {
      const claims = JSON.parse(hit) as Claims;
      if (typeof claims.exp === "number" && claims.exp * 1000 > Date.now()) return claims;
    }
  } catch {
    // fall through to a real verification
  }

  let claims: Claims;
  try {
    claims = await verifier(idToken);
  } catch {
    return null;
  }

  const ttl = typeof claims.exp === "number" ? Math.min(300, Math.floor(claims.exp - Date.now() / 1000) - 30) : 0;
  if (ttl > 0) redis.set(cacheKey, JSON.stringify(claims), "EX", ttl).catch(() => {});
  return claims;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim() || null;
  const cookie = (req.cookies as Record<string, string> | undefined)?.[ID_TOKEN_COOKIE];
  return cookie || null;
}

function toAuthUser(claims: Claims): AuthUser {
  return {
    uid: String(claims.sub ?? claims.uid ?? ""),
    role: typeof claims.app_role === "string" ? claims.app_role : null,
    ngoId: typeof claims.ngo_id === "string" ? claims.ngo_id : null,
    claims,
  };
}

/**
 * Accepts either `Authorization: Bearer <Firebase ID token>` (fetch calls
 * from the app) or the HTTP-only `fb_id_token` cookie (plain <img> requests
 * for private student photos).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const claims = await verifyIdToken(token);
  if (!claims) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  req.user = toAuthUser(claims);
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Runs `fn` under the caller's RLS context (see db.ts#withClaims). */
export function asUser<T>(req: Request, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!req.user) throw new HttpError(401, "Not signed in");
  return withClaims(req.user.claims, fn);
}

/**
 * Sets the role/ngo_id custom claims on a Firebase user. Stored under
 * `app_role` (not `role`) — see migration 0003.
 */
export async function setUserClaims(firebaseUid: string, claims: { role: string; ngo_id?: string | null }) {
  await firebaseAuth().setCustomUserClaims(firebaseUid, {
    app_role: claims.role,
    ngo_id: claims.ngo_id,
  });
}
