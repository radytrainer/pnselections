"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setFlash } from "@/lib/offline/store";
import { getStudent, type StudentDetail } from "@/services/studentService";
import { saveInterview, getInterviewAnswers, getInterviewPassRule } from "@/services/interviewService";
import { listInterviewCategories, type InterviewCategoryWithQuestions } from "@/services/interviewQuestionService";
import { InterviewForm } from "@/components/forms/InterviewForm";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_INTERVIEW_PASS_RULE, type InterviewFormValues, type InterviewPassRule } from "@/features/interview/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listInterviewCenters, type InterviewCenter } from "@/services/interviewCenterService";

const NONE = "__none__";

/** Shared by /students/[studentId]/interview (online) and /field/interview (Field Mode, works offline). */
export function InterviewEntry({ studentId, doneHref }: { studentId: string; doneHref: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [categories, setCategories] = useState<InterviewCategoryWithQuestions[]>([]);
  const [existingAnswers, setExistingAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<InterviewCenter[]>([]);
  const [centerId, setCenterId] = useState("");
  const [passRule, setPassRule] = useState<InterviewPassRule>(DEFAULT_INTERVIEW_PASS_RULE);

  useEffect(() => {
    Promise.all([getStudent(studentId), listInterviewCategories()])
      .then(async ([s, cats]) => {
        setStudent(s);
        setCategories(cats);
        setCenterId(s.interview_center_id ?? "");
        // Works offline too: Field Mode downloads the cycle's interview centers.
        listInterviewCenters(s.cycle_id)
          .then(setCenters)
          .catch(() => setCenters([]));
        // The cycle's pass mark (cached offline too); the original 50% rule if it can't load.
        await getInterviewPassRule(s.cycle_id)
          .then((r) => setPassRule({ mode: r.mode, value: Number(r.value) }))
          .catch(() => undefined);
        if (s.interviews) {
          setExistingAnswers(await getInterviewAnswers(s.interviews.id));
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load student"))
      .finally(() => setLoading(false));
  }, [studentId]);

  async function handleSubmit(values: InterviewFormValues) {
    if (!student) return;
    try {
      const { queued } = await saveInterview({
        studentId: student.id,
        cycleId: student.cycle_id,
        currentStatus: student.status,
        formValues: values,
        questionIds: categories.flatMap((c) => c.questions.map((q) => q.id)),
        interviewCenterId: centerId || undefined,
        passRule,
      });
      if (queued) setFlash("Saved on this device — it will sync automatically when you're back online");
      toast.success(queued ? "Saved on this device — it will sync automatically when you're back online" : "Interview saved");
      router.push(doneHref);
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
      {centers.length > 0 && (
        <div className="space-y-1.5 rounded-lg border p-3">
          <label className="text-sm font-medium" htmlFor="interview-center">
            Interview center
          </label>
          <Select value={centerId || NONE} onValueChange={(v) => setCenterId(!v || v === NONE ? "" : v)}>
            <SelectTrigger id="interview-center" className="w-full sm:w-80">
              <SelectValue>{(v: string) => (v === NONE ? "Not set" : (centers.find((c) => c.id === v)?.name ?? "Not set"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {centers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Where this interview takes place. Used to filter students and on the Selection Process page.</p>
        </div>
      )}
      <InterviewForm categories={categories} passRule={passRule} defaultValues={defaultValues} onSubmit={handleSubmit} />
    </div>
  );
}
