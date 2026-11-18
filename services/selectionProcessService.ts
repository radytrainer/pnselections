import { api } from "@/lib/api/client";
import type { Database } from "@/types/database.types";

export type InformationSessionStats = Database["public"]["Tables"]["information_session_stats"]["Row"];
export type ExamCenterStats = Database["public"]["Tables"]["exam_center_stats"]["Row"];
export type ExamResultStats = Database["public"]["Tables"]["exam_result_stats"]["Row"];
export type InterviewCenterStats = Database["public"]["Tables"]["interview_center_stats"]["Row"];
export type InterviewResultStats = Database["public"]["Tables"]["interview_result_stats"]["Row"];

export type SelectionProcessStats = {
  informationSessions: InformationSessionStats | null;
  examCenters: ExamCenterStats | null;
  examResults: ExamResultStats | null;
  interviewCenters: InterviewCenterStats | null;
  interviewResults: InterviewResultStats | null;
  /** Counted live from the interviews recorded in the app (null when there are none yet). */
  interviewLive?: InterviewLive | null;
};

export type InterviewLive = {
  attended: number;
  attended_girls: number;
  attended_boys: number;
  passed: number;
  passed_girls: number;
  passed_boys: number;
  failed: number;
  failed_girls: number;
  failed_boys: number;
  still_to_be_done: number;
};

/** One manually-maintained row per section per cycle (0027) — missing means never edited yet, treat as all-zero. */
export async function getSelectionProcessStats(cycleId: string): Promise<SelectionProcessStats> {
  return api.get<SelectionProcessStats>(`/api/v1/selection-process/${cycleId}`);
}

type StatsValues<T extends keyof Database["public"]["Tables"]> = Omit<Database["public"]["Tables"][T]["Insert"], "cycle_id">;

export async function saveInformationSessionStats(cycleId: string, values: StatsValues<"information_session_stats">) {
  await api.put(`/api/v1/selection-process/${cycleId}/informationSessions`, values);
}

export async function saveExamCenterStats(cycleId: string, values: StatsValues<"exam_center_stats">) {
  await api.put(`/api/v1/selection-process/${cycleId}/examCenters`, values);
}

export async function saveExamResultStats(cycleId: string, values: StatsValues<"exam_result_stats">) {
  await api.put(`/api/v1/selection-process/${cycleId}/examResults`, values);
}

export async function saveInterviewCenterStats(cycleId: string, values: StatsValues<"interview_center_stats">) {
  await api.put(`/api/v1/selection-process/${cycleId}/interviewCenters`, values);
}

export async function saveInterviewResultStats(cycleId: string, values: StatsValues<"interview_result_stats">) {
  await api.put(`/api/v1/selection-process/${cycleId}/interviewResults`, values);
}
