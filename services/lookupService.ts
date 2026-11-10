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
