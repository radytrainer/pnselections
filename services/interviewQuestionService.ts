import { api } from "@/lib/api/client";
import type { Database } from "@/types/database.types";

export type InterviewCategory = Database["public"]["Tables"]["interview_categories"]["Row"];
export type InterviewQuestion = Database["public"]["Tables"]["interview_questions"]["Row"];

export type InterviewCategoryWithQuestions = InterviewCategory & {
  questions: InterviewQuestion[];
};

async function listCategoriesWithQuestions(includeInactive: boolean): Promise<InterviewCategoryWithQuestions[]> {
  const rows = (await api.get<unknown[]>("/api/v1/interview-categories")) as (InterviewCategory & {
    interview_questions: InterviewQuestion[];
  })[];

  return rows.map((c) => ({
    ...c,
    questions: c.interview_questions
      .filter((q) => q.deleted_at === null && (includeInactive || q.is_active))
      .sort((a, b) => a.display_order - b.display_order),
  }));
}

/** Active questions only, grouped by category — what the interview form renders. */
export function listInterviewCategories() {
  return listCategoriesWithQuestions(false);
}

/** Includes deactivated questions too — for the admin management page. */
export function listAllInterviewCategoriesForAdmin() {
  return listCategoriesWithQuestions(true);
}

export async function createCategory(name: string) {
  return api.post<InterviewCategory>("/api/v1/interview-categories", { name });
}

export async function updateCategory(id: string, name: string) {
  await api.patch(`/api/v1/interview-categories/${id}`, { name });
}

export async function reorderCategories(orderedIds: string[]) {
  await api.put("/api/v1/interview-categories/order", { ids: orderedIds });
}

export async function createQuestion(input: { categoryId: string; textEn: string; textKm?: string }) {
  return api.post<InterviewQuestion>("/api/v1/interview-questions", input);
}

export async function updateQuestion(id: string, input: { textEn: string; textKm?: string }) {
  await api.patch(`/api/v1/interview-questions/${id}`, { text_en: input.textEn, text_km: input.textKm || null });
}

export async function toggleQuestionActive(id: string, isActive: boolean) {
  await api.patch(`/api/v1/interview-questions/${id}`, { is_active: isActive });
}

export async function softDeleteQuestion(id: string) {
  await api.delete(`/api/v1/interview-questions/${id}`);
}

export async function reorderQuestions(orderedIds: string[]) {
  await api.put("/api/v1/interview-questions/order", { ids: orderedIds });
}
