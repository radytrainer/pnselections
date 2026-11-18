import { api, API_BASE_URL } from "@/lib/api/client";

/** An information session and its registration link (migration 0061). */
export type InformationSession = {
  id: string;
  cycle_id: string;
  name: string;
  venue: string | null;
  province_id: string | null;
  province_name: string | null;
  session_date: string | null;
  notes: string | null;
  default_exam_center_id: string | null;
  default_exam_center_name: string | null;
  reg_token: string;
  reg_open: boolean;
  reg_expires_at: string | null;
  created_at: string;
  registrations: number;
  girls: number;
  boys: number;
  /** Registrations already added to the exam candidates. */
  added: number;
};

export type IsRegistration = {
  id: string;
  session_id: string;
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "lgbtqia+";
  dob: string | null;
  phone: string | null;
  high_school: string | null;
  grade: string | null;
  province_id: string | null;
  province_name: string | null;
  exam_center_id: string | null;
  exam_center_name: string | null;
  candidate_id: string | null;
  exam_number: string | null;
  /** Exam no. of an existing candidate with the same name + birth date (not yet added). */
  duplicate_candidate?: string | null;
  /** When an earlier registration of the same person was made (same name + birth date or phone). */
  duplicate_of_registration?: string | null;
  created_at: string;
};

export type SessionInput = {
  name?: string;
  venue?: string | null;
  provinceId?: string | null;
  sessionDate?: string | null;
  notes?: string | null;
  defaultExamCenterId?: string | null;
  regOpen?: boolean;
  regExpiresAt?: string | null;
};

export type LinkState = "open" | "closed" | "expired";

export function linkState(s: Pick<InformationSession, "reg_open" | "reg_expires_at">, now = Date.now()): LinkState {
  if (!s.reg_open) return "closed";
  if (s.reg_expires_at && new Date(s.reg_expires_at).getTime() <= now) return "expired";
  return "open";
}

/** The public registration URL for a session's link. */
export function registrationUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/register/${token}`;
}

export function listInformationSessions(cycleId: string) {
  return api.get<InformationSession[]>("/api/v1/information-sessions", { cycleId });
}

export function createInformationSession(cycleId: string, input: SessionInput & { name: string }) {
  return api.post<InformationSession>("/api/v1/information-sessions", { cycleId, ...input });
}

export function updateInformationSession(id: string, input: SessionInput) {
  return api.patch(`/api/v1/information-sessions/${id}`, input);
}

export function newRegistrationLink(id: string) {
  return api.post<{ regToken: string }>(`/api/v1/information-sessions/${id}/new-link`);
}

export function deleteInformationSession(id: string) {
  return api.delete(`/api/v1/information-sessions/${id}`);
}

export function listRegistrations(sessionId: string) {
  return api.get<IsRegistration[]>(`/api/v1/information-sessions/${sessionId}/registrations`);
}

export function updateRegistration(
  id: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    gender: IsRegistration["gender"];
    dob: string | null;
    phone: string | null;
    highSchool: string | null;
    grade: string | null;
    provinceId: string | null;
    examCenterId: string | null;
  }>,
) {
  return api.patch(`/api/v1/is-registrations/${id}`, input);
}

export function removeRegistrations(ids: string[]) {
  return api.post<{ removed: number }>("/api/v1/is-registrations/remove", { ids });
}

export function addRegistrationsToCandidates(ids: string[]) {
  return api.post<{ added: number; matched?: number; skipped: number; first?: string; last?: string }>("/api/v1/is-registrations/to-candidates", { ids });
}

export type LiveRegistrations = {
  session: Pick<InformationSession, "id" | "name" | "venue" | "session_date" | "reg_token" | "reg_open" | "reg_expires_at" | "province_name">;
  counts: { total: number; female: number; male: number; other: number };
  recent: { id: string; first_name: string; last_name: string; gender: IsRegistration["gender"]; created_at: string }[];
};

/** Names + counts for the full-screen live display (no contact details). */
export function getLiveRegistrations(sessionId: string) {
  return api.get<LiveRegistrations>(`/api/v1/information-sessions/${sessionId}/live`);
}

/**
 * Live "a student registered" events for one session (Server-Sent Events over
 * Redis pub/sub, like the committee votes). Returns an unsubscribe function;
 * `onStatus` reports whether the live connection is up.
 */
export function subscribeToRegistrations(sessionId: string, onRegistered: () => void, onStatus?: (live: boolean) => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource(`${API_BASE_URL}/api/v1/information-sessions/${sessionId}/stream`, { withCredentials: true });
  source.addEventListener("registered", () => onRegistered());
  source.onopen = () => onStatus?.(true);
  source.onerror = () => onStatus?.(false);
  return () => source.close();
}

// ---------------------------------------------------------------------------
// Public form (no login): plain fetch so no session/redirect logic runs.
// ---------------------------------------------------------------------------
export type PublicForm =
  | { status: "not_found" }
  | { status: "closed"; session: { name: string } }
  | { status: "expired"; session: { name: string } }
  | {
      status: "open";
      session: { name: string; venue: string | null; date: string | null; province: string | null; expires_at: string | null; default_exam_center_id: string | null };
      centers: { id: string; name: string; province: string | null }[];
      provinces: { id: string; name_en: string; name_kh: string | null }[];
    };

export type PublicRegistration = {
  firstName: string;
  lastName: string;
  gender: string;
  dob: string;
  phone: string;
  highSchool: string;
  grade: string;
  provinceId: string;
  examCenterId: string;
  website: string;
};

export async function getPublicForm(token: string): Promise<PublicForm> {
  const r = await fetch(`/api/public/register/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (r.status === 404) return { status: "not_found" };
  if (!r.ok) throw new Error("Couldn't load the form. Check your internet connection and try again.");
  return r.json();
}

export async function submitPublicRegistration(token: string, values: PublicRegistration): Promise<{ ok: boolean; reason?: string; duplicate?: boolean }> {
  const r = await fetch(`/api/public/register/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
  if (r.status === 429) return { ok: false, reason: "too_many" };
  if (!r.ok && r.status !== 200) throw new Error("Couldn't send the form. Check your internet connection and try again.");
  return r.json();
}
