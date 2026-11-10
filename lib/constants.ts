/** Cookie holding the current Firebase ID token (httpOnly, set by /api/auth/session). */
export const ID_TOKEN_COOKIE = "fb_id_token";

export const APP_ROLES = [
  "super_admin",
  "program_manager",
  "selection_team",
  "interview_team",
  "home_visit_team",
  "committee_member",
  "ngo_partner",
  "donor",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const STUDENT_STATUSES = [
  "registered",
  "exam_completed",
  "interview_completed",
  "home_visit_completed",
  "committee_review",
  "selected",
  "waitlisted",
  "rejected",
  "eliminated",
  "declined",
  "dropped_out",
] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

/** Moves a student's status forward only — never regresses progress already made (e.g. re-saving exam scores after the interview is done shouldn't reset status back to exam_completed). */
export function advanceStatus(current: StudentStatus, target: StudentStatus): StudentStatus {
  return STUDENT_STATUSES.indexOf(target) > STUDENT_STATUSES.indexOf(current) ? target : current;
}

/** One color per pipeline stage/outcome so a status is recognizable at a glance, without reading the label. Shared by the Students table and the student profile page. */
export const STUDENT_STATUS_BADGE_CLASSES: Record<StudentStatus, string> = {
  registered: "bg-slate-100 text-slate-700",
  exam_completed: "bg-sky-100 text-sky-700",
  interview_completed: "bg-blue-100 text-blue-700",
  home_visit_completed: "bg-indigo-100 text-indigo-700",
  committee_review: "bg-violet-100 text-violet-700",
  selected: "bg-green-100 text-green-700",
  waitlisted: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  eliminated: "bg-rose-100 text-rose-700",
  declined: "bg-orange-100 text-orange-700",
  dropped_out: "bg-gray-200 text-gray-600",
};

/** Final committee outcomes — once one of these is reached, it takes priority
 * over a lingering elimination_reason (the committee overrode the home-visit
 * elimination and decided the case anyway). */
const DECIDED_STATUSES = new Set<StudentStatus>(["selected", "waitlisted", "rejected", "declined"]);

/** sendToCommittee sends a home-visit-eliminated case to the committee
 * without clearing elimination_reason (so the queue can still flag it), which
 * leaves status as "committee_review" rather than "eliminated" while the
 * elimination itself still stands. Use this instead of raw `status` wherever
 * a student's status is displayed, so the case reads as still-eliminated
 * until the committee actually decides it — not as a plain "committee
 * review" indistinguishable from every other pending case. */
export function displayStudentStatus(status: StudentStatus, eliminationReason: string | null): StudentStatus {
  return eliminationReason && !DECIDED_STATUSES.has(status) ? "eliminated" : status;
}

/** Scholarship eligibility age window — committee decisions are flagged outside this range. */
export const MIN_ELIGIBLE_AGE = 17;
export const MAX_ELIGIBLE_AGE = 24;

export const POOR_LEVELS = ["A+", "A", "A-", "B+", "B", "B-"] as const;

/** A+ down to B- — green family darkens toward A+, orange family darkens toward B+, so the Poor Level column reads at a glance. */
export const POOR_LEVEL_BADGE_CLASSES: Record<string, string> = {
  "A+": "bg-green-200 text-green-800",
  A: "bg-green-100 text-green-700",
  "A-": "bg-green-50 text-green-600",
  "B+": "bg-orange-200 text-orange-800",
  B: "bg-orange-100 text-orange-700",
  "B-": "bg-orange-50 text-orange-600",
};

export const OUTREACH_STATUSES = [
  "not_contacted",
  "contacted",
  "in_discussion",
  "active_partner",
  "inactive",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  not_contacted: "Not Contacted",
  contacted: "Contacted",
  in_discussion: "In Discussion",
  active_partner: "Active Partner",
  inactive: "Inactive",
};

/** Role landing page after login — keeps the dashboard route gating simple. */
export const ROLE_HOME: Record<AppRole, string> = {
  super_admin: "/dashboard",
  program_manager: "/dashboard",
  selection_team: "/students",
  interview_team: "/students",
  home_visit_team: "/students",
  committee_member: "/committee/queue",
  ngo_partner: "/ngos",
  donor: "/dashboard",
};
