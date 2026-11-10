import { getFirebaseAuth } from "@/lib/firebase/client";

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

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

function buildUrl(path: string, query?: Query) {
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

async function authHeader(): Promise<Record<string, string>> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return {};
  // getIdToken() transparently refreshes an expired token.
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

/**
 * Calls the REST API with the signed-in user's Firebase ID token. The API
 * enforces the same Postgres RLS rules as before (db/migrations), so errors come back
 * with the same messages (e.g. RLS violations as 403).
 */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; query?: Query; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = await authHeader();
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "include",
  });

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
