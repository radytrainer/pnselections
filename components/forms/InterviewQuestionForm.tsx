"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  interviewQuestionFormSchema,
  type InterviewQuestionFormValues,
} from "@/features/interview/schema";
import type { InterviewCategory } from "@/services/interviewQuestionService";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InterviewQuestionForm({
  categories,
  defaultValues,
  onSubmit,
}: {
  categories: InterviewCategory[];
  defaultValues?: Partial<InterviewQuestionFormValues>;
  onSubmit: (values: InterviewQuestionFormValues) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InterviewQuestionFormValues>({
    resolver: zodResolver(interviewQuestionFormSchema),
    defaultValues: {
      categoryId: "",
      textEn: "",
      textKm: "",
      ...defaultValues,
    },
  });

  async function handleSubmit(values: InterviewQuestionFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save question");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category">
                      {(value: string) => categories.find((c) => c.id === value)?.name}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="textEn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question (English)</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="textKm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question (Khmer, optional)</FormLabel>
              <FormControl>
                <Textarea rows={2} style={{ fontFamily: "var(--font-battambang)" }} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Question"}
        </Button>
      </form>
    </Form>
  );
}
