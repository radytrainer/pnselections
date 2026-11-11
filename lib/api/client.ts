import { getFirebaseAuth } from "@/lib/firebase/client";
import { offlineListFallback } from "@/lib/offline/fallback";
import { enqueueWrite, isQueueable } from "@/lib/offline/queue";
import { cacheResponse, getCachedResponse } from "@/lib/offline/store";

/**
 * Base URL of the Node.js REST API. Empty (the default) means same origin:
 * the reverse proxy (Caddy in docker-compose, an ALB on AWS) or Next.js'
 * dev rewrite sends /api/* to the API service.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** No connection, and nothing usable stored on this device. */
export class OfflineError extends Error {
  constructor(message = "You're offline, and this hasn't been downloaded for offline use yet.") {
    super(message);
    this.name = "OfflineError";
  }
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export function buildUrl(path: string, query?: Query) {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

const apiUrl = (path: string) => buildUrl(path);

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** fetch() rejections and Firebase token refresh failures both mean "no network". */
function isNetworkFailure(error: unknown) {
  if (error instanceof OfflineError || error instanceof TypeError) return true;
  const code = (error as { code?: unknown } | null)?.code;
  return code === "auth/network-request-failed";
}

async function authHeader(): Promise<Record<string, string>> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return {};
  // getIdToken() transparently refreshes an expired token (needs network).
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

/** One HTTP round-trip, no offline handling. Exported for the outbox sync. */
export async function sendRequest<T>(
  method: string,
  url: string,
  options: { body?: unknown; formData?: FormData; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeader()), ...options.headers };
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { method, headers, body, credentials: "include" });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const errorBody = (data && typeof data === "object" ? data : null) as Record<string, unknown> | null;
    const message = typeof errorBody?.error === "string" ? errorBody.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, errorBody);
  }
  return data as T;
}

/** GET responses worth keeping for offline use (JSON data, not files or live streams). */
/** Admin-only data (audit trail, backups) is never kept on the device for offline use. */
const NEVER_CACHE = ["/api/v1/files/", "/api/v1/audit-logs", "/api/v1/backup"];

function isCacheable(path: string) {
  return path.startsWith("/api/v1/") && !NEVER_CACHE.some((p) => path.startsWith(p)) && !path.endsWith("/stream");
}

async function offlineRead<T>(url: string, path: string, query?: Query): Promise<T> {
  const cached = await getCachedResponse(url);
  if (cached !== undefined) return cached as T;
  const computed = await offlineListFallback(path, query);
  if (computed !== undefined) return computed as T;
  throw new OfflineError();
}

/**
 * Calls the REST API with the signed-in user's Firebase ID token. The API
 * enforces the same Postgres RLS rules as before (db/migrations), so errors come back
 * with the same messages (e.g. RLS violations as 403).
 *
 * Offline support (see lib/offline/):
 *  - GET: every successful response is stored on the device; without a
 *    connection the stored copy is returned instead.
 *  - Field-work writes (lib/offline/queue.ts): sent with an Idempotency-Key;
 *    without a connection they're saved to the outbox and synced later.
 */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; query?: Query; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const url = buildUrl(path, options.query);

  if (method === "GET" && isCacheable(path)) {
    if (isOffline()) return offlineRead<T>(url, path, options.query);
    try {
      const data = await sendRequest<T>(method, url);
      void cacheResponse(url, data);
      return data;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return offlineRead<T>(url, path, options.query);
    }
  }

  if (!options.formData && isQueueable(method, path, options.body)) {
    const id = crypto.randomUUID();
    if (isOffline()) return (await enqueueWrite(id, method, path, options.body, apiUrl)) as T;
    try {
      return await sendRequest<T>(method, url, { body: options.body, headers: { "Idempotency-Key": id } });
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      // Same id: if the server did receive it, the retry is recognized and not saved twice.
      return (await enqueueWrite(id, method, path, options.body, apiUrl)) as T;
    }
  }

  if (isOffline()) throw new OfflineError("You're offline. This action needs an internet connection.");
  try {
    return await sendRequest<T>(method, url, { body: options.body, formData: options.formData });
  } catch (error) {
    if (isNetworkFailure(error)) throw new OfflineError("No connection. This action needs internet — please try again.");
    throw error;
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => apiFetch<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File, query?: Query) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<T>(path, { method: "POST", formData, query });
  },
};

/**
 * Downloads a file the API sends as an attachment (e.g. the SQL backup) and
 * saves it in the browser. Uses the same fresh sign-in token as api calls.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<{ bytes: number; name: string }> {
  const res = await fetch(buildUrl(path), { headers: await authHeader(), credentials: "include" });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // not JSON
    }
    throw new ApiError(message, res.status, null);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return { bytes: blob.size, name };
}
