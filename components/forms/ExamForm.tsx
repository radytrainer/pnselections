"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { examFormSchema, type ExamFormValues } from "@/features/exam/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const SCORE_FIELDS: { name: keyof ExamFormValues; label: string }[] = [
  { name: "math_score", label: "Math" },
  { name: "english_score", label: "English" },
  { name: "logic_score", label: "Logic" },
  { name: "computer_score", label: "Computer" },
];

export function ExamForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: Partial<ExamFormValues>;
  onSubmit: (values: ExamFormValues) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      math_score: "",
      english_score: "",
      logic_score: "",
      computer_score: "",
      ...defaultValues,
    },
  });

  const scores = form.watch(SCORE_FIELDS.map((f) => f.name) as (keyof ExamFormValues)[]);
  const total = scores.reduce((sum, value) => sum + (Number(value) || 0), 0);

  async function handleSubmit(values: ExamFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SCORE_FIELDS.map(({ name, label }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label} (0–100)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" max="100" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{total}</span> / 400
        </p>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Exam Scores"}
        </Button>
      </form>
    </Form>
  );
}
