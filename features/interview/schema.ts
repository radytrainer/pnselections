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

/** Percentage-based so grading scales with however many questions are active — 60%/50% preserve the original 48/80 and 40/80 cutoffs. */
export function computeGrade(total: number, maxScore: number): "A1" | "A2" | "not_recommended" {
  if (maxScore <= 0) return "not_recommended";
  const pct = total / maxScore;
  if (pct >= 0.6) return "A1";
  if (pct >= 0.5) return "A2";
  return "not_recommended";
}

/** Single source of truth for the "passed interview" banner — kept in lockstep with computeGrade's A2 cutoff so the two can't disagree. */
export function hasPassed(total: number, maxScore: number): boolean {
  return maxScore > 0 && total / maxScore >= 0.5;
}

export const interviewQuestionFormSchema = z.object({
  categoryId: z.string().min(1, "Select a category"),
  textEn: z.string().min(1, "English text is required"),
  textKm: z.string().optional().or(z.literal("")),
});

export type InterviewQuestionFormValues = z.infer<typeof interviewQuestionFormSchema>;
