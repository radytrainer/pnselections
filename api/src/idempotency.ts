import type { NextFunction, Request, Response } from "express";
import { redis } from "./redis";

const KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;
const RESULT_TTL_SECONDS = 60 * 60 * 24 * 30; // offline devices may sync weeks later
const IN_FLIGHT_TTL_SECONDS = 120;

/**
 * Makes writes safe to retry. The offline outbox (lib/offline/sync.ts) sends
 * every queued write with an `Idempotency-Key` header; if the device lost the
 * response (connection dropped mid-request) and sends the same write again,
 * the stored first response is replayed instead of saving twice.
 * Keys are scoped per user. Without Redis the request simply runs normally.
 */
export async function idempotency(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["idempotency-key"];
  if (req.method === "GET" || typeof header !== "string" || !req.user) return next();
  if (!KEY_RE.test(header)) {
    res.status(400).json({ error: "Invalid Idempotency-Key" });
    return;
  }

  const key = `idem:${req.user.uid}:${header}`;
  let claimed: string | null;
  try {
    const existing = await redis.get(key);
    if (existing && existing !== "in-flight") {
      const stored = JSON.parse(existing) as { status: number; body: unknown };
      res.setHeader("Idempotent-Replayed", "true");
      res.status(stored.status).json(stored.body);
      return;
    }
    if (existing === "in-flight") {
      res.status(409).json({ error: "This change is already being saved. Try again in a moment." });
      return;
    }
    claimed = await redis.set(key, "in-flight", "EX", IN_FLIGHT_TTL_SECONDS, "NX");
  } catch {
    return next(); // Redis unavailable: no dedupe, but never block the write
  }
  if (claimed !== "OK") {
    res.status(409).json({ error: "This change is already being saved. Try again in a moment." });
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    const status = res.statusCode;
    // Remember successes and permanent client errors; let 5xx be retried.
    const write =
      status < 500
        ? redis.set(key, JSON.stringify({ status, body }), "EX", RESULT_TTL_SECONDS)
        : redis.del(key);
    write.catch(() => {});
    return originalJson(body);
  };
  next();
}
