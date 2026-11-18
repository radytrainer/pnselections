import { api } from "@/lib/api/client";
import type { ExamCandidate, ExamData, Gender, RuleUnit } from "@/features/written-exam/scoring";
import type { KeyRow } from "@/features/written-exam/zipgrade";

/** Written exams (api/src/routes/writtenExams.ts). Online only — not part of offline Field Mode. */

export function getExamData(cycleId: string) {
  return api.get<ExamData>("/api/v1/written-exams", { cycleId });
}

export function createPaper(cycleId: string, name: string) {
  return api.post<{ id: string }>("/api/v1/written-exams/papers", { cycleId, name });
}

export function renamePaper(id: string, name: string) {
  return api.patch(`/api/v1/written-exams/papers/${id}`, { name });
}

export function deletePaper(id: string) {
  return api.delete(`/api/v1/written-exams/papers/${id}`);
}

export function saveKey(paperId: string, questions: KeyRow[]) {
  return api.put(`/api/v1/written-exams/papers/${paperId}/key`, { questions });
}

export function updateQuestion(id: string, patch: { answer?: string; cancelled?: boolean; topic?: string | null; points?: number }) {
  return api.patch(`/api/v1/written-exams/questions/${id}`, patch);
}

export function saveSubjects(paperId: string, subjects: { id?: string; name: string; fromQuestion: number; toQuestion: number }[]) {
  return api.put(`/api/v1/written-exams/papers/${paperId}/subjects`, { subjects });
}

export type ImportSheet = {
  examNumber: string;
  name?: string;
  answers: string[];
  zipEarned?: number | null;
  zipPossible?: number | null;
  keyVersion?: string | null;
};

export function importSheets(
  paperId: string,
  body: {
    fileName?: string;
    rowsInFile: number;
    summary: Record<string, unknown>;
    keyFromFile?: { number: number; answer: string }[];
    sheets: ImportSheet[];
    /** merge (default): replace only the same exam numbers; replace: delete all the paper's sheets first. */
    mode?: "merge" | "replace";
  },
) {
  return api.post<{ saved: number; replaced: number; total: number; keyCreated: boolean }>(`/api/v1/written-exams/papers/${paperId}/import`, body);
}

export function saveRules(
  cycleId: string,
  rules: { paperId: string; subjectId: string | null; minValue: number; unit: RuleUnit; orPrevious?: boolean }[],
) {
  return api.put("/api/v1/written-exams/rules", { cycleId, rules });
}

export function setExamLock(cycleId: string, locked: boolean) {
  return api.post("/api/v1/written-exams/lock", { cycleId, locked });
}

export function updateCandidate(id: string, patch: { excluded?: boolean; excludeReason?: string | null; fullName?: string }) {
  return api.patch(`/api/v1/written-exams/candidates/${id}`, patch);
}

// ---- Phase 2: candidates and planning ------------------------------------------------

export type Numbering = { startNumber?: number; digits?: number };

/** Optional attendance-sheet details for a candidate not linked to a student. */
export type CandidateDetailInput = {
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
  highSchool?: string | null;
  province?: string | null;
  ngo?: string | null;
};

export function addCandidates(
  cycleId: string,
  candidates: ({ examNumber?: string; fullName: string; gender?: Gender | null } & CandidateDetailInput)[],
  numbering: Numbering = {},
) {
  return api.post<{ created: number }>("/api/v1/written-exams/candidates", { cycleId, candidates, ...numbering });
}

export function addCandidatesFromStudents(cycleId: string, numbering: Numbering = {}, statuses?: string[]) {
  return api.post<{ created: number }>("/api/v1/written-exams/candidates/from-students", { cycleId, statuses, ...numbering });
}

export function editCandidate(id: string, patch: { gender?: Gender | null; fullName?: string; studentId?: string | null } & CandidateDetailInput) {
  return api.patch(`/api/v1/written-exams/candidates/${id}`, patch);
}

export function deleteCandidate(id: string) {
  return api.delete(`/api/v1/written-exams/candidates/${id}`);
}

export function assignCandidates(cycleId: string, candidateIds: string[], centerId: string | null, sessionId?: string | null, roomId?: string | null) {
  return api.post("/api/v1/written-exams/candidates/assign", { cycleId, candidateIds, centerId, sessionId, roomId });
}

export function createCenter(cycleId: string, values: { name: string; provinceId?: string | null; address?: string | null }) {
  return api.post<{ id: string }>("/api/v1/written-exams/centers", { cycleId, ...values });
}

export function updateCenter(id: string, values: { name?: string; provinceId?: string | null; address?: string | null }) {
  return api.patch(`/api/v1/written-exams/centers/${id}`, values);
}

export function deleteCenter(id: string) {
  return api.delete(`/api/v1/written-exams/centers/${id}`);
}

export function saveRooms(centerId: string, rooms: { id?: string; name: string; capacity?: number | null }[]) {
  return api.put(`/api/v1/written-exams/centers/${centerId}/rooms`, { rooms });
}

export function saveSessions(centerId: string, sessions: { id?: string; date: string; start?: string | null; end?: string | null; label?: string | null }[]) {
  return api.put(`/api/v1/written-exams/centers/${centerId}/sessions`, { sessions });
}

// ---- Phase 3: students -----------------------------------------------------------------
export type CycleStudent = { id: string; first_name: string; last_name: string; code: string; gender: string; status: string; exam_number: string | null };

export function listCycleStudents(cycleId: string) {
  return api.get<CycleStudent[]>("/api/v1/written-exams/students", { cycleId });
}

export function autoLinkCandidates(cycleId: string) {
  return api.post<{ linked: number; ambiguous: number; unlinkedLeft: number }>("/api/v1/written-exams/candidates/auto-link", { cycleId });
}

export function applyToStudents(cycleId: string, passed: string[], failed: { candidateId: string; reason: string }[]) {
  return api.post<{ advanced: number; eliminated: number; unchanged: number }>("/api/v1/written-exams/apply-to-students", { cycleId, passed, failed });
}

export function createStudentsFromCandidates(cycleId: string, candidateIds: string[]) {
  return api.post<{ created: number; skipped: number }>("/api/v1/written-exams/create-students", { cycleId, candidateIds });
}

export function getStudentExam(studentId: string) {
  return api.get<(Pick<ExamData, "papers" | "sheets" | "rules" | "overrides"> & { candidate: ExamCandidate }) | null>(
    `/api/v1/written-exams/student/${studentId}`,
  );
}

/** Sets a manual paper score for a candidate (score null = back to the calculated score). */
export function setScoreOverride(candidateId: string, paperId: string, score: number | null, reason?: string | null) {
  return api.put("/api/v1/written-exams/overrides", { candidateId, paperId, score, reason });
}

/** Saves one answer-key version (e.g. "B"): key letters and main question number per position on that sheet. */
export function saveKeyVersion(paperId: string, version: string, answers: string[], questionMap: number[]) {
  return api.put(`/api/v1/written-exams/papers/${paperId}/versions/${encodeURIComponent(version)}`, { answers, questionMap });
}

export function deleteKeyVersion(paperId: string, version: string) {
  return api.delete(`/api/v1/written-exams/papers/${paperId}/versions/${encodeURIComponent(version)}`);
}
