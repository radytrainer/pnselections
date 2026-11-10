import { api, ApiError } from "@/lib/api/client";
import type { Database } from "@/types/database.types";
import { POOR_LEVELS } from "@/lib/constants";

export type Student = Database["public"]["Tables"]["students"]["Row"];
export type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];
export type StudentUpdate = Database["public"]["Tables"]["students"]["Update"];

export type StudentListItem = Student & {
  provinces: { name_en: string } | null;
  school_partners: { school_name: string } | null;
  ngo_partners: { organization_name: string } | null;
  committee_decisions: { decision: string | null; poor_level: string | null } | null;
  // Just enough to answer "did the current user record this student's
  // social form" (lib/rbac.ts#sendToCommittee) and to show the latest
  // home visitor's name in the students list. `age`/`major` are only
  // populated for callers that ask for them (see FINALIST_SELECT) — the
  // home visitor's reported age (fallback when dob is unknown) and academic
  // major/track.
  social_assessments: {
    visitor_id: string | null;
    visitor_name: string | null;
    visit_number: number;
    age?: number | null;
    major?: "science" | "social_science" | null;
  }[];
  student_documents: { doc_type: string; file_path: string; uploaded_at: string }[];
};

type ExamResult = Database["public"]["Tables"]["exam_results"]["Row"];
type Interview = Database["public"]["Tables"]["interviews"]["Row"];
type SocialAssessment = Database["public"]["Tables"]["social_assessments"]["Row"];
type CommitteeDecision = Database["public"]["Tables"]["committee_decisions"]["Row"];
type StudentDocument = Pick<
  Database["public"]["Tables"]["student_documents"]["Row"],
  "doc_type" | "file_path" | "uploaded_at"
>;

export type StudentDetail = Student & {
  provinces: { name_en: string } | null;
  school_partners: { school_name: string } | null;
  // exam_results/interviews/committee_decisions all have a `unique`
  // constraint on student_id, so the API embeds them as a single to-one
  // object (or null) rather than an array. social_assessments/
  // student_documents have no such constraint, so they stay arrays.
  exam_results: ExamResult | null;
  interviews: Interview | null;
  social_assessments: SocialAssessment[];
  student_documents: StudentDocument[];
  committee_decisions: CommitteeDecision | null;
};

export type StudentFilters = {
  cycleId?: string;
  provinceId?: string;
  status?: string;
  gender?: string;
  homeVisitor?: string;
  // Multiple ids because some NGOs have more than one ngo_partners record
  // under the identical name (duplicate data entry) — filtering by name
  // means matching all of them, see listNgoFilterOptions.
  ngoIds?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
};

function filterQuery(filters: Omit<StudentFilters, "page" | "pageSize">) {
  return {
    cycleId: filters.cycleId,
    provinceId: filters.provinceId,
    status: filters.status,
    gender: filters.gender,
    homeVisitor: filters.homeVisitor,
    ngoIds: filters.ngoIds,
    search: filters.search,
  };
}

export async function listStudents(filters: StudentFilters) {
  return api.get<{ data: StudentListItem[]; total: number; page: number; pageSize: number }>("/api/v1/students", {
    ...filterQuery(filters),
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 25,
  });
}

export type StudentGenderCounts = { male: number; female: number; other: number; total: number };

/**
 * Male/female/other counts across every student matching the current
 * filters (not just the current page) — same filter set as listStudents,
 * minus pagination and gender, so the counts stay in sync with the filtered list.
 */
export async function getStudentGenderCounts(
  filters: Omit<StudentFilters, "page" | "pageSize">,
): Promise<StudentGenderCounts> {
  return api.get<StudentGenderCounts>("/api/v1/students/gender-counts", filterQuery(filters));
}

/**
 * Distinct home visitor names that appear in social assessments, for the filter dropdown.
 * Scoped to non-deleted students only.
 */
export async function listHomeVisitors(cycleId?: string): Promise<string[]> {
  return api.get<string[]>("/api/v1/students/home-visitors", { cycleId });
}

/**
 * Students the committee has decided on, for the Finalist page's two tabs.
 * "selected" is ordered A+ → B- (worst-off first); "waitlisted" has no
 * committee-defined order so it's left alphabetical by name.
 */
export async function listFinalists(decision: "selected" | "waitlisted", cycleId?: string) {
  const list = await api.get<StudentListItem[]>("/api/v1/students/finalists", { decision, cycleId });

  if (decision === "selected") {
    list.sort((a, b) => {
      const aIndex = POOR_LEVELS.indexOf(a.committee_decisions?.poor_level as never);
      const bIndex = POOR_LEVELS.indexOf(b.committee_decisions?.poor_level as never);
      return (aIndex === -1 ? POOR_LEVELS.length : aIndex) - (bIndex === -1 ? POOR_LEVELS.length : bIndex);
    });
  }

  return list;
}

export async function getStudent(id: string) {
  return api.get<StudentDetail>(`/api/v1/students/${id}`);
}

export class DuplicateStudentError extends Error {
  constructor(public existing: { id: string; student_code: string; first_name: string; last_name: string }) {
    super(
      `This looks like a duplicate of ${existing.first_name} ${existing.last_name} (${existing.student_code}) — every field matches an existing student.`,
    );
    this.name = "DuplicateStudentError";
  }
}

/** The API runs the "every field matches" duplicate check and answers 409 with the existing record. */
function rethrowDuplicate(error: unknown): never {
  if (error instanceof ApiError && error.status === 409 && error.body?.duplicate) {
    throw new DuplicateStudentError(error.body.duplicate as DuplicateStudentError["existing"]);
  }
  throw error;
}

export async function createStudent(input: StudentInsert) {
  return api.post<Student>("/api/v1/students", input).catch(rethrowDuplicate);
}

export async function updateStudent(id: string, input: StudentUpdate) {
  return api.patch<Student>(`/api/v1/students/${id}`, input).catch(rethrowDuplicate);
}

export async function softDeleteStudent(id: string) {
  await api.delete(`/api/v1/students/${id}`);
}

export async function bulkSoftDeleteStudents(ids: string[]) {
  if (ids.length === 0) return;
  await api.post("/api/v1/students/bulk-delete", { ids });
}

/** Trash view — students soft-deleted via softDeleteStudent/bulkSoftDeleteStudents. */
export async function listDeletedStudents() {
  return api.get<StudentListItem[]>("/api/v1/students/trash");
}

export async function restoreStudent(id: string) {
  await api.post(`/api/v1/students/${id}/restore`);
}

/** Irreversible — erases the row (and cascades to exam/interview/social-form/committee records). RLS (0042) restricts this to super_admin regardless of what the UI shows. */
export async function permanentlyDeleteStudent(id: string) {
  await api.delete(`/api/v1/students/${id}/permanent`);
}

/**
 * Generates the next sequential student code for a cycle, e.g. ST-26-0123,
 * based on the highest existing sequence number (computed by the API).
 */
export async function generateStudentCode(cycleYear: number) {
  const { code } = await api.get<{ code: string }>("/api/v1/students/next-code", { year: cycleYear });
  return code;
}
