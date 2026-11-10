"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  buildInterviewFormSchema,
  computeTotal,
  computeMaxScore,
  computeGrade,
  type InterviewFormValues,
} from "@/features/interview/schema";
import type { InterviewCategoryWithQuestions } from "@/services/interviewQuestionService";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/ui/star-rating";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADE_LABELS: Record<string, string> = {
  A1: "A1 (≥ 60%)",
  A2: "A2 (≥ 50%)",
  not_recommended: "Not Recommended (< 50%)",
};

const GRADE_COLORS: Record<string, string> = {
  A1: "text-green-700 bg-green-50 border-green-200",
  A2: "text-green-700 bg-green-50 border-green-200",
  not_recommended: "text-red-700 bg-red-50 border-red-200",
};

function ScoreSummary({
  categories,
  values,
}: {
  categories: InterviewCategoryWithQuestions[];
  values: InterviewFormValues;
}) {
  const answers = values.answers ?? {};
  const allQuestionIds = categories.flatMap((c) => c.questions.map((q) => q.id));
  const allRated = allQuestionIds.length > 0 && allQuestionIds.every((id) => (answers[id] ?? 0) > 0);

  const total = computeTotal(answers);
  const maxScore = computeMaxScore(allQuestionIds.length);
  const grade = allRated ? computeGrade(total, maxScore) : null;

  const categoryTotals = categories.map((cat) => ({
    label: cat.name,
    total: cat.questions.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0),
    max: cat.questions.length * 5,
  }));

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Total Score</span>
        <span className="text-lg font-semibold">
          {allRated ? total : "—"} / {maxScore}
        </span>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground" style={{ gridTemplateColumns: `repeat(${categoryTotals.length || 1}, minmax(0, 1fr))` }}>
        {categoryTotals.map(({ label, total: ct, max }) => (
          <div key={label} className="text-center">
            <div className="font-medium text-foreground">{allRated ? ct : "—"}/{max}</div>
            <div>{label}</div>
          </div>
        ))}
      </div>
      {grade && grade !== "not_recommended" && (
        <div className="rounded border px-3 py-2 text-sm font-semibold text-center text-green-700 bg-green-50 border-green-200">
          Passed Interview
        </div>
      )}
      {grade && (
        <div
          className={cn(
            "rounded border px-3 py-1.5 text-sm font-medium text-center",
            GRADE_COLORS[grade],
          )}
        >
          Grade: {GRADE_LABELS[grade]}
        </div>
      )}
    </div>
  );
}

export function InterviewForm({
  categories,
  defaultValues,
  onSubmit,
}: {
  categories: InterviewCategoryWithQuestions[];
  defaultValues?: Partial<InterviewFormValues>;
  onSubmit: (values: InterviewFormValues) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const questionIds = useMemo(
    () => categories.flatMap((c) => c.questions.map((q) => q.id)),
    [categories],
  );

  const schema = useMemo(() => buildInterviewFormSchema(questionIds), [questionIds]);

  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      answers: Object.fromEntries(questionIds.map((id) => [id, defaultValues?.answers?.[id] ?? 0])),
      comments: defaultValues?.comments ?? "",
    },
  });

  const watched = useWatch({ control: form.control }) as InterviewFormValues;

  async function handleSubmit(values: InterviewFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  let qIndex = 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {categories.map((category) => {
          const isCollapsed = collapsed[category.id] ?? false;
          const startIndex = qIndex;
          qIndex += category.questions.length;

          return (
            <div key={category.id} className="rounded-lg border overflow-hidden">
              {/* Category header — clickable to collapse */}
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [category.id]: !isCollapsed }))
                }
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
              >
                <span className="text-sm font-semibold">{category.name}</span>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    isCollapsed && "-rotate-90",
                  )}
                />
              </button>

              {/* Questions — hidden when collapsed */}
              {!isCollapsed && (
                <div className="divide-y">
                  {category.questions.map((q, idx) => {
                    const number = startIndex + idx + 1;
                    return (
                      <FormField
                        key={q.id}
                        control={form.control}
                        name={`answers.${q.id}`}
                        render={({ field }) => (
                          <FormItem className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="flex gap-2 min-w-0">
                              <span className="text-muted-foreground text-sm shrink-0 pt-0.5">
                                {number}.
                              </span>
                              <div className="space-y-0.5 min-w-0">
                                {q.text_km && (
                                  <p className="text-sm leading-snug" style={{ fontFamily: "var(--font-battambang)" }}>
                                    {q.text_km}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground leading-snug">{q.text_en}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <FormControl>
                                <StarRating
                                  size="sm"
                                  value={field.value as number}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </div>
                          </FormItem>
                        )}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <ScoreSummary categories={categories} values={watched} />

        <FormField
          control={form.control}
          name="comments"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea rows={3} placeholder="Interviewer notes..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Interview"}
        </Button>
      </form>
    </Form>
  );
}
