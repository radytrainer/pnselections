import { api, API_BASE_URL } from "@/lib/api/client";
import type { Database } from "@/types/database.types";

type CommitteeDecisionInsert = Database["public"]["Tables"]["committee_decisions"]["Insert"];
type CommitteeRatingRow = Database["public"]["Tables"]["committee_ratings"]["Row"];
export type SocialAssessmentRow = Database["public"]["Tables"]["social_assessments"]["Row"];

export type CommitteeQueueItem = {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  cycle_id: string;
  gpa: number | null;
  family_income_monthly: number | null;
  elimination_reason: string | null;
  province_id: string | null;
  photo_drive_url: string | null;
  provinces: { name_en: string } | null;
  school_partners: { school_name: string } | null;
  // exam_results/interviews have a unique constraint on student_id, so
  // the API embeds them as a single to-one object (or null).
  exam_results: { total_score: number; rank_in_cycle: number | null; pass_status: string | null } | null;
  interviews: { recommendation: string | null } | null;
  social_assessments: {
    final_score: number;
    category: string;
    manual_failed: boolean;
    visitor_comments: string | null;
    visitor_id: string | null;
    visitor_name: string | null;
  }[];
  student_documents: { doc_type: string; file_path: string; uploaded_at: string }[];
  committee_ratings: CommitteeRatingRow[];
};

/** Students who've finished the pipeline but have no committee decision yet. */
export async function listCommitteeQueue(cycleId?: string) {
  return api.get<CommitteeQueueItem[]>("/api/v1/committee/queue", { cycleId });
}

/**
 * Upsert (not insert) so a decision can be freely changed later — student_id
 * is unique on committee_decisions, so re-recording just overwrites it.
 * approval_status resets to "pending" on every call: an approved decision
 * that gets changed must go through approval again rather than silently
 * keeping its old sign-off.
 */
export async function recordCommitteeDecision(input: {
  studentId: string;
  cycleId: string;
  decision: NonNullable<CommitteeDecisionInsert["decision"]>;
  poorLevel?: CommitteeDecisionInsert["poor_level"];
}) {
  await api.post("/api/v1/committee/decisions", input);
}

export type PendingApproval = {
  id: string;
  decision: string | null;
  decision_date: string | null;
  students: {
    id: string;
    student_code: string;
    first_name: string;
    last_name: string;
  } | null;
};

/** Decisions a committee member recorded that still need Program Manager / Super Admin sign-off. */
export async function listPendingApprovals(cycleId?: string) {
  return api.get<PendingApproval[]>("/api/v1/committee/pending-approvals", { cycleId });
}

export async function approveCommitteeDecision(decisionId: string, approve: boolean) {
  await api.post(`/api/v1/committee/decisions/${decisionId}/approval`, { approve });
}

export type CommitteeDossier = {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  dob: string | null;
  status: string;
  cycle_id: string;
  gpa: number | null;
  grade: string | null;
  district_name: string | null;
  commune_name: string | null;
  village_name: string | null;
  family_income_monthly: number | null;
  elimination_reason: string | null;
  photo_drive_url: string | null;
  provinces: { name_en: string } | null;
  school_partners: { school_name: string } | null;
  ngo_partners: { organization_name: string } | null;
  exam_results: {
    math_score: number;
    english_score: number;
    logic_score: number;
    computer_score: number;
    total_score: number;
    rank_in_cycle: number | null;
    rank_in_province: number | null;
    pass_status: string | null;
  } | null;
  interviews: {
    comments: string | null;
    recommendation: string | null;
  } | null;
  social_assessments: SocialAssessmentRow[];
  student_documents: { doc_type: string; file_path: string; uploaded_at: string }[];
  committee_decisions: {
    decision: string | null;
    decision_date: string | null;
    poor_level: string | null;
    approval_status: string;
  } | null;
  committee_ratings: CommitteeRatingRow[];
};

/** Single-student consolidated view backing the Committee Dossier page. */
export async function getCommitteeDossier(studentId: string) {
  return api.get<CommitteeDossier>(`/api/v1/committee/dossier/${studentId}`);
}

/**
 * Manual hand-off after the home visit is done — the case is "presented" to
 * the committee. Also doubles as "send back to committee" for an
 * already-decided student (e.g. from the Finalist page): clears any existing
 * decision and poor_level first, so the old outcome doesn't linger — a
 * stale committee_decisions row would otherwise keep the student matching
 * listFinalists' filter, and the Students page would show a stale poor_level
 * badge next to the now-"committee review" status. Not an error if the
 * student has no committee_decisions row yet (first time to committee).
 */
export async function sendToCommittee(studentId: string) {
  await api.post(`/api/v1/committee/send/${studentId}`);
}

/**
 * rated_by is filled server-side from the caller's own user row (see
 * migration 0009), so it's never sent here. One overall 1-5 rating per
 * voter per student (see migration 0018) — criterion is always "overall".
 */
export async function upsertCommitteeRating(input: {
  studentId: string;
  cycleId: string;
  score: number;
}) {
  await api.put("/api/v1/committee/ratings", input);
}

/**
 * Live "ratings changed" notifications for one student (Server-Sent Events,
 * backed by Redis pub/sub on the API — replaces Supabase Realtime). The
 * session cookie authenticates the stream. Returns an unsubscribe function.
 */
export function subscribeToCommitteeRatings(studentId: string, onChange: () => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource(`${API_BASE_URL}/api/v1/committee/ratings/${studentId}/stream`, {
    withCredentials: true,
  });
  source.addEventListener("ratings", () => onChange());
  return () => source.close();
}
