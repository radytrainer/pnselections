/**
 * Keeps the Selection Process exam numbers (Exam Centers + Exam Results
 * cards) in step with the Written Exams module. Called after the exam data
 * reloads (an import, new pass marks, a score edit, an exclusion…); only
 * writes when a number actually changed, so just viewing the page doesn't
 * touch anything. Cycles that don't use the module (no candidates) are left
 * alone so hand-typed numbers survive.
 */
import type { ExamData } from "@/features/written-exam/scoring";
import { examCenterStats, examResultStats } from "@/features/written-exam/stats";
import { getSelectionProcessStats, saveExamCenterStats, saveExamResultStats } from "@/services/selectionProcessService";

const differs = (next: Record<string, number>, saved: Record<string, unknown> | null) =>
  !saved || Object.entries(next).some(([k, v]) => Number(saved[k] ?? 0) !== v);

export async function syncSelectionProcess(data: ExamData): Promise<boolean> {
  if (!data.candidates.length) return false;
  const centers = examCenterStats(data);
  const results = examResultStats(data);
  const saved = await getSelectionProcessStats(data.cycle.id);
  let changed = false;
  if (differs(centers, saved.examCenters as Record<string, unknown> | null)) {
    await saveExamCenterStats(data.cycle.id, centers);
    changed = true;
  }
  if (differs(results, saved.examResults as Record<string, unknown> | null)) {
    await saveExamResultStats(data.cycle.id, results);
    changed = true;
  }
  return changed;
}
