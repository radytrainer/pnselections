import { api } from "@/lib/api/client";

/** A Motivation Interview venue for one cycle (migration 0058). */
export type InterviewCenter = {
  id: string;
  cycle_id: string;
  name: string;
  province_id: string | null;
  province_name?: string | null;
  address: string | null;
  /** Students assigned to it (list endpoint only). */
  students?: number;
};

export function listInterviewCenters(cycleId: string) {
  return api.get<InterviewCenter[]>("/api/v1/interview-centers", { cycleId });
}

export function createInterviewCenter(cycleId: string, values: { name: string; provinceId?: string | null; address?: string | null }) {
  return api.post<InterviewCenter>("/api/v1/interview-centers", { cycleId, ...values });
}

export function updateInterviewCenter(id: string, values: { name?: string; provinceId?: string | null; address?: string | null }) {
  return api.patch(`/api/v1/interview-centers/${id}`, values);
}

export function deleteInterviewCenter(id: string) {
  return api.delete(`/api/v1/interview-centers/${id}`);
}

/** Assigns students to an interview center (null = remove their center). */
export function assignInterviewCenter(studentIds: string[], centerId: string | null) {
  return api.post<{ assigned: number }>("/api/v1/interview-centers/assign", { studentIds, centerId });
}
