import { api } from "@/lib/api/client";
import { advanceStatus, type StudentStatus } from "@/lib/constants";
import {
  computeTotal,
  computeMaxScore,
  computeGrade,
  type InterviewFormValues,
  type InterviewPassRule,
} from "@/features/interview/schema";
import type { Database } from "@/types/database.types";

export type Interview = Database["public"]["Tables"]["interviews"]["Row"];

export async function getInterview(studentId: string) {
  return api.get<Interview | null>(`/api/v1/interviews/student/${studentId}`);
}

/** Existing per-question scores for a saved interview, keyed by question_id — used to prefill the form. */
export async function getInterviewAnswers(interviewId: string): Promise<Record<string, number>> {
  const data = await api.get<{ question_id: string; score: number }[]>(`/api/v1/interviews/${interviewId}/answers`);
  return Object.fromEntries(data.map((r) => [r.question_id, r.score]));
}

export type InterviewPassRuleInfo = InterviewPassRule & { questionCount: number };

/** The cycle's interview pass mark (cached for Field Mode by the offline bundle). */
export function getInterviewPassRule(cycleId: string) {
  return api.get<InterviewPassRuleInfo>("/api/v1/interview-pass-rule", { cycleId });
}

export type InterviewPassPreview = { interviewed: number; passed: number; failed: number; toPass: number; toFail: number };

/** How a candidate rule would grade the interviews already saved in the cycle. Changes nothing. */
export function previewInterviewPassRule(cycleId: string, rule: InterviewPassRule) {
  return api.get<InterviewPassPreview>("/api/v1/interview-pass-rule/preview", { cycleId, mode: rule.mode, value: String(rule.value) });
}

/** Saves the rule; reapply re-grades saved interviews (students who now fail leave the process, and back). */
export function saveInterviewPassRule(cycleId: string, rule: InterviewPassRule, reapply: boolean) {
  return api.put<{ ok: true; changed: number }>("/api/v1/interview-pass-rule", { cycleId, ...rule, reapply });
}

export async function saveInterview(input: {
  studentId: string;
  cycleId: string;
  currentStatus: StudentStatus;
  formValues: InterviewFormValues;
  questionIds: string[];
  /** Where the interview took place (migration 0058); undefined = leave as is. */
  interviewCenterId?: string | null;
  /** The cycle's pass mark; the original 50% rule when not given. */
  passRule?: InterviewPassRule;
}) {
  const { formValues, questionIds } = input;

  const total = computeTotal(formValues.answers);
  const maxScore = computeMaxScore(questionIds.length);
  const recommendation = computeGrade(total, maxScore, input.passRule);
  const nextStatus = advanceStatus(input.currentStatus, "interview_completed");

  const res = await api.put<{ queued?: boolean } | null>(`/api/v1/interviews/student/${input.studentId}`, {
    cycleId: input.cycleId,
    comments: formValues.comments || null,
    recommendation,
    answers: questionIds.map((questionId) => ({ questionId, score: formValues.answers[questionId] })),
    nextStatus: nextStatus !== input.currentStatus ? nextStatus : undefined,
    interviewCenterId: input.interviewCenterId || undefined,
  });
  /** queued = saved on this device only, synced when back online. */
  return { queued: !!res?.queued };
}

export type InterviewCategoryTotal = { label: string; total: number; max: number };
export type InterviewSummary = {
  total: number;
  maxScore: number;
  categoryTotals: InterviewCategoryTotal[];
  recommendation: Interview["recommendation"];
  comments: string | null;
};

/** Aggregated view for the student profile Interview tab — groups a student's answers by category, dynamically (not tied to a fixed 3-category shape). */
export async function getInterviewSummary(studentId: string): Promise<InterviewSummary | null> {
  const { interview, answers } = await api.get<{
    interview: { id: string; recommendation: Interview["recommendation"]; comments: string | null } | null;
    answers: unknown[];
  }>(`/api/v1/interviews/student/${studentId}/summary`);
  if (!interview) return null;

  const rows = answers as {
    score: number;
    interview_questions: {
      category_id: string;
      interview_categories: { name: string; display_order: number } | null;
    } | null;
  }[];

  const byCategory = new Map<string, { label: string; order: number; total: number; count: number }>();
  for (const row of rows) {
    const question = row.interview_questions;
    const category = question?.interview_categories;
    if (!question || !category) continue;
    const entry = byCategory.get(question.category_id) ?? {
      label: category.name,
      order: category.display_order,
      total: 0,
      count: 0,
    };
    entry.total += row.score;
    entry.count += 1;
    byCategory.set(question.category_id, entry);
  }

  const categoryTotals = Array.from(byCategory.values())
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ label: c.label, total: c.total, max: c.count * 5 }));

  return {
    total: categoryTotals.reduce((sum, c) => sum + c.total, 0),
    maxScore: categoryTotals.reduce((sum, c) => sum + c.max, 0),
    categoryTotals,
    recommendation: interview.recommendation,
    comments: interview.comments,
  };
}
