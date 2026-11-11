import { cacheResponse, getCachedResponse, listOutbox, putOutboxItem, removeOutboxItem, type OutboxItem } from "@/lib/offline/store";

/**
 * Which writes may be saved offline and synced later. Only field-work forms
 * that belong to one student are queueable; everything else (committee
 * votes/decisions, user admin, partners, ...) needs a live connection.
 *
 * Each rule also patches the cached GET responses so the app shows the
 * offline change right away (reopening the form shows what was entered).
 */

type Json = Record<string, unknown>;
type StudentDetailLike = Json & {
  id: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  social_assessments?: Json[];
  exam_results?: Json | null;
  interviews?: Json | null;
};

type Rule = {
  method: string;
  pattern: RegExp;
  /** Extra check on the body; return false to refuse queueing. */
  accepts?: (body: Json) => boolean;
  studentId: (match: RegExpMatchArray, body: Json) => string;
  kind: string;
  /** Updates cached GET responses and returns what the API call would have returned. */
  apply: (studentId: string, body: Json, url: (path: string) => string) => Promise<unknown>;
};

const studentPath = (id: string) => `/api/v1/students/${id}`;

async function patchStudent(url: (p: string) => string, id: string, patch: (s: StudentDetailLike) => StudentDetailLike) {
  const key = url(studentPath(id));
  const cached = (await getCachedResponse(key)) as StudentDetailLike | undefined;
  if (!cached) return undefined;
  const next = patch({ ...cached });
  await cacheResponse(key, next);
  return next;
}

const RULES: Rule[] = [
  {
    kind: "Home visit social form",
    method: "POST",
    pattern: /^\/api\/v1\/social-assessments\/save$/,
    studentId: (_m, body) => String(body.studentId),
    apply: async (studentId, body, url) => {
      const row = (body.row ?? {}) as Json;
      const latestKey = url(`/api/v1/social-assessments/student/${studentId}/latest`);
      const existing = ((await getCachedResponse(latestKey)) as Json | null | undefined) ?? {};
      const merged: Json = { ...existing, ...row, student_id: studentId, id: body.id ?? existing.id };
      await cacheResponse(latestKey, merged);
      const studentUpdate = (body.studentUpdate ?? {}) as Json;
      await patchStudent(url, studentId, (s) => {
        const list = [...(s.social_assessments ?? [])];
        const index = list.findIndex((a) => a.visit_number === merged.visit_number);
        if (index >= 0) list[index] = { ...list[index], ...merged };
        else list.push(merged);
        return { ...s, ...studentUpdate, social_assessments: list };
      });
      return { ok: true, queued: true };
    },
  },
  {
    kind: "Exam scores",
    method: "PUT",
    pattern: /^\/api\/v1\/exams\/([0-9a-f-]{36})$/,
    studentId: (m) => m[1],
    apply: async (studentId, body, url) => {
      const examKey = url(`/api/v1/exams/${studentId}`);
      const existing = ((await getCachedResponse(examKey)) as Json | null | undefined) ?? {};
      const scores = {
        math_score: body.mathScore,
        english_score: body.englishScore,
        logic_score: body.logicScore,
        computer_score: body.computerScore,
      };
      const total = Object.values(scores).reduce<number>((sum, v) => sum + Number(v ?? 0), 0);
      const exam = { ...existing, ...scores, total_score: total, student_id: studentId, cycle_id: body.cycleId };
      await cacheResponse(examKey, exam);
      await patchStudent(url, studentId, (s) => ({
        ...s,
        ...(body.nextStatus ? { status: String(body.nextStatus) } : {}),
        exam_results: exam,
      }));
      return { ok: true, queued: true };
    },
  },
  {
    kind: "Interview",
    method: "PUT",
    pattern: /^\/api\/v1\/interviews\/student\/([0-9a-f-]{36})$/,
    studentId: (m) => m[1],
    apply: async (studentId, body, url) => {
      const interviewKey = url(`/api/v1/interviews/student/${studentId}`);
      const existing = ((await getCachedResponse(interviewKey)) as Json | null | undefined) ?? {};
      // Before the first sync there's no server id yet; a local one lets the
      // form find its own answers again while offline.
      const id = (existing.id as string | undefined) ?? `local-${studentId}`;
      const interview = {
        ...existing,
        id,
        student_id: studentId,
        cycle_id: body.cycleId,
        comments: body.comments,
        recommendation: body.recommendation,
      };
      await cacheResponse(interviewKey, interview);
      const answers = ((body.answers ?? []) as { questionId: string; score: number }[]).map((a) => ({
        question_id: a.questionId,
        score: a.score,
      }));
      await cacheResponse(url(`/api/v1/interviews/${id}/answers`), answers);
      await patchStudent(url, studentId, (s) => ({
        ...s,
        ...(body.nextStatus ? { status: String(body.nextStatus) } : {}),
        interviews: interview,
      }));
      return { ok: true, queued: true };
    },
  },
  {
    kind: "Elimination",
    method: "PATCH",
    pattern: /^\/api\/v1\/students\/([0-9a-f-]{36})$/,
    // Only the eliminate / undo-elimination action from the social form page.
    accepts: (body) => Object.keys(body).every((k) => k === "status" || k === "elimination_reason"),
    studentId: (m) => m[1],
    apply: async (studentId, body, url) => {
      const updated = await patchStudent(url, studentId, (s) => ({ ...s, ...body }));
      return updated ?? { id: studentId, ...body };
    },
  },
];

function findRule(method: string, path: string, body: unknown) {
  for (const rule of RULES) {
    if (rule.method !== method) continue;
    const match = path.match(rule.pattern);
    if (!match) continue;
    const json = (body ?? {}) as Json;
    if (rule.accepts && !rule.accepts(json)) continue;
    return { rule, studentId: rule.studentId(match, json), body: json };
  }
  return null;
}

export function isQueueable(method: string, path: string, body: unknown) {
  return findRule(method, path, body) !== null;
}

/**
 * Saves a write to the outbox (replacing an older pending write to the same
 * target) and applies it to the cached data. Returns the synthetic response.
 */
export async function enqueueWrite(
  id: string,
  method: string,
  path: string,
  body: unknown,
  url: (path: string) => string,
): Promise<unknown> {
  const found = findRule(method, path, body);
  if (!found) throw new Error("This change can't be saved offline");
  const { rule, studentId } = found;

  const student = (await getCachedResponse(url(studentPath(studentId)))) as StudentDetailLike | undefined;
  const name = student ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() : "";
  // Per student: e.g. every social form posts to the same path.
  const target = `${method} ${path} ${studentId}`;

  for (const item of await listOutbox()) {
    if (item.target === target && item.status === "pending") await removeOutboxItem(item.id);
  }

  const item: OutboxItem = {
    id,
    method,
    path,
    body,
    target,
    label: name ? `${rule.kind} — ${name}` : rule.kind,
    studentId,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
  };
  await putOutboxItem(item);
  return rule.apply(studentId, found.body, url);
}
