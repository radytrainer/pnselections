"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getStudent, type StudentDetail } from "@/services/studentService";
import { saveInterview, getInterviewAnswers } from "@/services/interviewService";
import { listInterviewCategories, type InterviewCategoryWithQuestions } from "@/services/interviewQuestionService";
import { InterviewForm } from "@/components/forms/InterviewForm";
import { Skeleton } from "@/components/ui/skeleton";
import type { InterviewFormValues } from "@/features/interview/schema";

export default function InterviewEntryPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [categories, setCategories] = useState<InterviewCategoryWithQuestions[]>([]);
  const [existingAnswers, setExistingAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStudent(params.studentId), listInterviewCategories()])
      .then(async ([s, cats]) => {
        setStudent(s);
        setCategories(cats);
        if (s.interviews) {
          setExistingAnswers(await getInterviewAnswers(s.interviews.id));
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load student"))
      .finally(() => setLoading(false));
  }, [params.studentId]);

  async function handleSubmit(values: InterviewFormValues) {
    if (!student) return;
    try {
      await saveInterview({
        studentId: student.id,
        cycleId: student.cycle_id,
        currentStatus: student.status,
        formValues: values,
        questionIds: categories.flatMap((c) => c.questions.map((q) => q.id)),
      });
      toast.success("Interview saved");
      router.push(`/students/${student.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save interview");
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!student) {
    return <p className="text-sm text-muted-foreground">Student not found.</p>;
  }

  const defaultValues: Partial<InterviewFormValues> = {
    answers: existingAnswers,
    comments: student.interviews?.comments ?? "",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Self-Assessment — {student.first_name} {student.last_name}
        </h1>
        <p className="text-sm text-muted-foreground">{student.student_code}</p>
      </div>
      <InterviewForm categories={categories} defaultValues={defaultValues} onSubmit={handleSubmit} />
    </div>
  );
}
