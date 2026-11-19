import { api } from "@/lib/api/client";
import type { Answers } from "@/features/scholarship-application/form";

/** A student's scholarship application link + answers (migration 0068). */
export type StudentApplication = {
  id: string;
  student_id: string;
  token: string;
  link_open: boolean;
  expires_at: string | null;
  data: Answers;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  files: { id: string; doc_type: string; file_path: string; original_name: string | null; uploaded_at: string }[];
};

export type ApplicationLinkState = "open" | "closed" | "expired";

export function applicationLinkState(a: Pick<StudentApplication, "link_open" | "expires_at">, now = Date.now()): ApplicationLinkState {
  if (!a.link_open) return "closed";
  if (a.expires_at && new Date(a.expires_at).getTime() <= now) return "expired";
  return "open";
}

export function applicationUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/apply/${token}`;
}

export function getStudentApplication(studentId: string) {
  return api.get<StudentApplication | null>(`/api/v1/students/${studentId}/application`);
}

export function createStudentApplication(studentId: string) {
  return api.post<StudentApplication>(`/api/v1/students/${studentId}/application`);
}

export function updateStudentApplication(studentId: string, input: { linkOpen?: boolean; expiresAt?: string | null }) {
  return api.patch(`/api/v1/students/${studentId}/application`, input);
}

export function newApplicationLink(studentId: string) {
  return api.post<{ token: string }>(`/api/v1/students/${studentId}/application/new-link`);
}

// ---------------------------------------------------------------------------
// Public form (no login): plain fetch so no session/redirect logic runs.
// ---------------------------------------------------------------------------
export type PublicApplicationFile = { id: string; kind: "photo" | "file"; name: string | null; uploaded_at: string };

export type PublicApplication =
  | { status: "not_found" }
  | { status: "closed" }
  | { status: "expired" }
  | {
      status: "open";
      student: { first_name: string; last_name: string; gender: string; dob: string | null; phone: string | null; student_code: string };
      academic_year: string;
      expires_at: string | null;
      submitted_at: string | null;
      data: Answers;
      files: PublicApplicationFile[];
    };

export type PublicResult = { ok: boolean; reason?: string };

const base = (token: string) => `/api/public/apply/${encodeURIComponent(token)}`;
const NETWORK = "Couldn't reach the server. Check your internet connection and try again.";

export async function getPublicApplication(token: string): Promise<PublicApplication> {
  const r = await fetch(base(token), { cache: "no-store" });
  if (r.status === 404) return { status: "not_found" };
  if (!r.ok) throw new Error(NETWORK);
  return r.json();
}

export async function submitPublicApplication(token: string, data: Answers): Promise<PublicResult> {
  const r = await fetch(base(token), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) });
  if (r.status === 429) return { ok: false, reason: "too_many" };
  if (!r.ok) throw new Error(NETWORK);
  return r.json();
}

export async function uploadPublicApplicationFile(token: string, kind: "photo" | "file", file: File): Promise<PublicResult & { id?: string }> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${base(token)}/files?kind=${kind}`, { method: "POST", body: form });
  if (r.status === 429) return { ok: false, reason: "too_many" };
  if (r.status === 413) return { ok: false, reason: "file_too_large" };
  if (!r.ok) throw new Error(NETWORK);
  return r.json();
}

export async function removePublicApplicationFile(token: string, id: string): Promise<PublicResult> {
  const r = await fetch(`${base(token)}/files/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(NETWORK);
  return r.json();
}

export function publicApplicationFileUrl(token: string, id: string) {
  return `${base(token)}/files/${id}`;
}
