import { api } from "@/lib/api/client";

export type Cycle = { id: string; year: number; name: string; status: string };
export type Province = { id: string; name_en: string; name_kh: string | null; code: string };

export async function listProvinces() {
  return api.get<Province[]>("/api/v1/lookups/provinces");
}

export async function listSchools() {
  return api.get<{ id: string; school_name: string }[]>("/api/v1/lookups/schools");
}

export async function listCycles() {
  return api.get<Cycle[]>("/api/v1/lookups/cycles");
}

export async function getActiveCycle() {
  return api.get<Cycle | null>("/api/v1/lookups/cycles/active");
}

// ---------------------------------------------------------------------------
// Admin → Selection Cycles (one cycle = one generation of students)
// ---------------------------------------------------------------------------
export type CycleStatus = "planning" | "active" | "closed" | "archived";

export type CycleDetail = Cycle & {
  status: CycleStatus;
  start_date: string;
  end_date: string | null;
  exam_pass_threshold: number | string | null;
  student_count: number;
};

export type CycleInput = {
  name: string;
  start_date: string;
  end_date: string | null;
  exam_pass_threshold: number;
};

export async function listCyclesForAdmin() {
  return api.get<CycleDetail[]>("/api/v1/lookups/cycles/manage");
}

export async function createCycle(input: CycleInput & { year: number }) {
  return api.post<CycleDetail>("/api/v1/lookups/cycles", input);
}

export async function updateCycle(id: string, input: CycleInput) {
  return api.patch<{ ok: true }>(`/api/v1/lookups/cycles/${id}`, input);
}

/** Makes this the cycle every page shows by default; the previous active cycle is closed. */
export async function activateCycle(id: string) {
  return api.post<{ ok: true }>(`/api/v1/lookups/cycles/${id}/activate`, {});
}
