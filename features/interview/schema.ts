import { z } from "zod";

export type InterviewFormValues = {
  answers: Record<string, number>;
  comments?: string;
};

/**
 * Question count/IDs aren't known at compile time (Super Admin manages them),
 * so validation is a schema factory keyed off whichever questions are active
 * when the form loads, rather than a fixed set of fields.
 */
export function buildInterviewFormSchema(questionIds: string[]) {
  return z
    .object({
      answers: z.record(z.string(), z.number()),
      comments: z.string().optional().or(z.literal("")),
    })
    .superRefine((values, ctx) => {
      for (const id of questionIds) {
        const score = values.answers[id];
        if (!score || score < 1 || score > 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Rate every question before saving",
            path: ["answers", id],
          });
        }
      }
    });
}

export function computeTotal(answers: Record<string, number>): number {
  return Object.values(answers).reduce((sum, v) => sum + (v || 0), 0);
}

export function computeMaxScore(questionCount: number): number {
  return questionCount * 5;
}

/**
 * The cycle's pass mark (migration 0059, set on Configuration → Interview Questions).
 * percent: total / max * 100 >= value · points: total >= value.
 */
export type InterviewPassRule = { mode: "percent" | "points"; value: number };

/** The original fixed rule (40/80 with 16 questions) — used when no cycle rule is loaded. */
export const DEFAULT_INTERVIEW_PASS_RULE: InterviewPassRule = { mode: "percent", value: 50 };

/** The pass mark in points for a given maximum score. */
export function passMarkPoints(rule: InterviewPassRule, maxScore: number): number {
  return rule.mode === "points" ? rule.value : Math.ceil((rule.value / 100) * maxScore - 1e-9);
}

/**
 * Passed = A1 (60%+) or A2 (below 60%); failed = not_recommended. Same rule as the
 * API (api/src/routes/assessments.ts#gradeFor) so re-grading on the server matches.
 */
export function computeGrade(
  total: number,
  maxScore: number,
  rule: InterviewPassRule = DEFAULT_INTERVIEW_PASS_RULE,
): "A1" | "A2" | "not_recommended" {
  if (maxScore <= 0) return "not_recommended";
  const pass = rule.mode === "points" ? total >= rule.value : (total / maxScore) * 100 >= rule.value;
  if (!pass) return "not_recommended";
  return total / maxScore >= 0.6 ? "A1" : "A2";
}

/**
 * What staff see after an interview: just Passed or Failed. The stored
 * `recommendation` keeps its A1/A2/not_recommended value (A1 and A2 = passed),
 * so older records and reports keep working.
 */
export function interviewResultLabel(recommendation: string | null | undefined): "Passed" | "Failed" | null {
  if (!recommendation) return null;
  return recommendation === "not_recommended" ? "Failed" : "Passed";
}

export const interviewQuestionFormSchema = z.object({
  categoryId: z.string().min(1, "Select a category"),
  textEn: z.string().min(1, "English text is required"),
  textKm: z.string().optional().or(z.literal("")),
});

export type InterviewQuestionFormValues = z.infer<typeof interviewQuestionFormSchema>;
