import Redis from "ioredis";
import { config } from "./config";

/**
 * Redis is used for three things, none of which is a source of truth:
 *  1. Pub/sub fan-out of live committee-vote events (replaces Supabase Realtime).
 *  2. A short-lived cache for public lookup data and verified ID tokens.
 *  3. Per-IP rate limiting.
 * Every caller degrades gracefully if Redis is unavailable.
 */
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: false,
});
redis.on("error", (error) => console.warn("[redis]", error.message));

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // cache miss on Redis failure
  }
  const value = await load();
  redis.set(key, JSON.stringify(value), "EX", ttlSeconds).catch(() => {});
  return value;
}

export async function invalidate(...keys: string[]) {
  if (keys.length === 0) return;
  await redis.del(...keys).catch(() => {});
}

export const CACHE_KEYS = {
  provinces: "cache:lookups:provinces",
  cycles: "cache:lookups:cycles",
  activeCycle: "cache:lookups:active-cycle",
};

// ---------------------------------------------------------------------------
// Pub/sub: one shared subscriber connection, fanned out in-process.
// ---------------------------------------------------------------------------
type Listener = (message: string) => void;
const listeners = new Map<string, Set<Listener>>();
let subscriber: Redis | null = null;

function getSubscriber() {
  if (subscriber) return subscriber;
  subscriber = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  subscriber.on("error", (error) => console.warn("[redis:sub]", error.message));
  subscriber.on("message", (channel: string, message: string) => {
    listeners.get(channel)?.forEach((listener) => listener(message));
  });
  return subscriber;
}

export function subscribe(channel: string, listener: Listener): () => void {
  const set = listeners.get(channel) ?? new Set<Listener>();
  if (set.size === 0) getSubscriber().subscribe(channel).catch(() => {});
  set.add(listener);
  listeners.set(channel, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(channel);
      subscriber?.unsubscribe(channel).catch(() => {});
    }
  };
}

export function publish(channel: string, payload: unknown) {
  return redis.publish(channel, JSON.stringify(payload)).catch(() => 0);
}

/** Fixed-window per-key counter. Returns true when the request is allowed. */
export async function rateLimitHit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const count = await redis.incr(bucket);
    if (count === 1) await redis.expire(bucket, windowSeconds);
    return count <= limit;
  } catch {
    return true;
  }
}
