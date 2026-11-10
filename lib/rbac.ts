import type { AppRole } from "@/lib/constants";

/**
 * UI-layer permission matrix mirroring docs/09-security.md §2.3. This is
 * NOT the security boundary — Postgres RLS (db/migrations, applied by the API) is the
 * authoritative enforcement. This only drives what the UI shows/hides.
 */
export const CAPABILITIES = {
  manageUsers: ["super_admin"],
  manageInterviewQuestions: ["super_admin"],
  manageCycles: ["super_admin", "program_manager"],
  managePartners: ["super_admin", "program_manager"],
  createEditStudents: ["super_admin", "program_manager", "selection_team"],
  // Viewing Trash and restoring a soft-deleted student — same roles as
  // createEditStudents since deleting/restoring are two sides of one action.
  viewTrash: ["super_admin", "program_manager", "selection_team"],
  // Permanently erasing a soft-deleted student (vs. the reversible soft
  // delete above) — kept to super_admin alone since it's irreversible and
  // the students_delete RLS policy (0042) enforces the same restriction
  // server-side, so this is UI-only narrowing on top of a real DB boundary.
  permanentlyDeleteStudents: ["super_admin"],
  // Separate from createEditStudents so home_visit_team gets the button
  // without also gaining general create/edit/delete rights. They're further
  // restricted server-side (0026) to only students whose social form they
  // themselves recorded — this list alone doesn't capture that row-level rule.
  sendToCommittee: ["super_admin", "program_manager", "selection_team", "home_visit_team"],
  enterExamScores: ["super_admin", "program_manager", "selection_team"],
  enterInterviewScores: ["super_admin", "program_manager", "interview_team"],
  enterHomeVisitData: ["super_admin", "program_manager", "home_visit_team", "selection_team"],
  recordCommitteeDecision: ["super_admin", "program_manager", "selection_team"],
  rateCommitteeCandidate: ["committee_member"],
  // Read-only oversight of how the committee voted (distribution, not who
  // voted what) — not the same as recordCommitteeDecision, which is the
  // actual Select/Waitlist/Reject/Eliminate power. home_visit_team gets this
  // instead of rateCommitteeCandidate — they observe the committee's vote
  // and mark their own case as done, but selection_team makes the call.
  viewCommitteeRatings: ["super_admin", "program_manager", "selection_team", "home_visit_team"],
  approveCommitteeDecision: ["super_admin", "program_manager"],
  viewAllStudentPii: [
    "super_admin",
    "program_manager",
    "selection_team",
    "interview_team",
    "home_visit_team",
    "committee_member",
  ],
  generateReports: ["super_admin", "program_manager", "selection_team", "committee_member"],
  // Editing the manually-entered Selection Process funnel numbers (0027) —
  // everyone in viewAllStudentPii-ish staff can see the page, but only
  // these roles get the Edit button on each card.
  manageSelectionProcessStats: ["super_admin", "program_manager", "selection_team"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: AppRole | null, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly AppRole[]).includes(role);
}
