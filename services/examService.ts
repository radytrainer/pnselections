import { api } from "@/lib/api/client";
import { advanceStatus, type StudentStatus } from "@/lib/constants";
import type { Database } from "@/types/database.types";

export type ExamResult = Database["public"]["Tables"]["exam_results"]["Row"];

export async function getExamResult(studentId: string) {
  return api.get<ExamResult | null>(`/api/v1/exams/${studentId}`);
}

export async function saveExamResult(input: {
  studentId: string;
  cycleId: string;
  currentStatus: StudentStatus;
  mathScore: number;
  englishScore: number;
  logicScore: number;
  computerScore: number;
}) {
  const nextStatus = advanceStatus(input.currentStatus, "exam_completed");
  await api.put(`/api/v1/exams/${input.studentId}`, {
    cycleId: input.cycleId,
    mathScore: input.mathScore,
    englishScore: input.englishScore,
    logicScore: input.logicScore,
    computerScore: input.computerScore,
    nextStatus: nextStatus !== input.currentStatus ? nextStatus : undefined,
  });
}
