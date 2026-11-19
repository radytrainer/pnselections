import { api, API_BASE_URL } from "@/lib/api/client";
import type { ReportContent } from "@/features/annual-report/content";

/** One student of the cycle with their latest interview, home visit and committee decision. */
export type ReportStudent = {
  id: string;
  gender: "male" | "female" | "lgbtqia+" | null;
  dob: string | null;
  status: string;
  elimination_reason: string | null;
  district_name: string | null;
  school_id: string | null;
  from_ngo: boolean;
  province: string | null;
  school: string | null;
  ngo: string | null;
  interview: string | null;
  interview_date: string | null;
  visited: boolean;
  visit_date: string | null;
  age: number | null;
  child_rank: number | null;
  children_count: number | null;
  family_male_count: number | null;
  family_female_count: number | null;
  household_size_band: string | null;
  father_occupation_band: string | null;
  mother_occupation_band: string | null;
  parent_occupation_band: string | null;
  income_band: string | null;
  expenses_band: string | null;
  debt_band: string | null;
  category: string | null;
  final_score: number | null;
  vac_total_score: number | null;
  vulnerability_orphan_single_parent: boolean | null;
  vulnerability_disability: boolean | null;
  vulnerability_chronic_illness: boolean | null;
  vulnerability_debt_burden: boolean | null;
  vulnerability_landless: boolean | null;
  manual_failed: boolean | null;
  decision: string | null;
  decision_date: string | null;
};

export type ReportSource = {
  cycle: { id: string; year: number; name: string; start_date: string | null; end_date: string | null; status: string };
  content: ReportContent;
  updatedAt: string | null;
  updatedBy: string | null;
  students: ReportStudent[];
  staff: { name: string; stage: "interviews" | "home_visits" | "committee" }[];
  partners: { ngos: number; schools: number };
  interviewCenters: number;
  informationSessionStats: {
    sessions_done: number;
    attendees_actual_boys: number;
    attendees_actual_girls: number;
  } | null;
};

export function getAnnualReport(cycleId: string) {
  return api.get<ReportSource>(`/api/v1/annual-report/${cycleId}`);
}

export function saveAnnualReport(cycleId: string, content: ReportContent) {
  return api.put<{ ok: boolean; updatedAt: string }>(`/api/v1/annual-report/${cycleId}`, { content });
}

/** Uploads a photo for the report; returns its path (stored in the report content). */
export async function uploadReportPhoto(file: File): Promise<string> {
  const { url } = await api.upload<{ url: string }>("/api/v1/uploads/report-photo", file);
  return url;
}

/** Full URL of a stored report photo, optionally a resized copy (w = 256…768). */
export function reportPhotoUrl(path: string, w?: number) {
  return `${API_BASE_URL}${path}${w ? `?w=${w}` : ""}`;
}
