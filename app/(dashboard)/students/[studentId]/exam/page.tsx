"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getStudent, type StudentDetail } from "@/services/studentService";
import { saveExamResult } from "@/services/examService";
import { ExamForm } from "@/components/forms/ExamForm";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExamFormValues } from "@/features/exam/schema";

export default function ExamEntryPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudent(params.studentId)
      .then(setStudent)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load student"))
      .finally(() => setLoading(false));
  }, [params.studentId]);

  async function handleSubmit(values: ExamFormValues) {
    if (!student) return;
    try {
      await saveExamResult({
        studentId: student.id,
        cycleId: student.cycle_id,
        currentStatus: student.status,
        mathScore: Number(values.math_score),
        englishScore: Number(values.english_score),
        logicScore: Number(values.logic_score),
        computerScore: Number(values.computer_score),
      });
      toast.success("Exam scores saved");
      router.push(`/students/${student.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save exam scores");
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!student) {
    return <p className="text-sm text-muted-foreground">Student not found.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Exam Scores — {student.first_name} {student.last_name}
        </h1>
        <p className="text-sm text-muted-foreground">{student.student_code}</p>
      </div>
      <ExamForm
        defaultValues={
          student.exam_results
            ? {
                math_score: String(student.exam_results.math_score),
                english_score: String(student.exam_results.english_score),
                logic_score: String(student.exam_results.logic_score),
                computer_score: String(student.exam_results.computer_score),
              }
            : undefined
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}
