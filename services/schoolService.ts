import { api } from "@/lib/api/client";
import type { Database } from "@/types/database.types";

export type School = Database["public"]["Tables"]["school_partners"]["Row"];
export type SchoolInsert = Database["public"]["Tables"]["school_partners"]["Insert"];
export type SchoolUpdate = Database["public"]["Tables"]["school_partners"]["Update"];

export type SchoolListItem = School & {
  provinces: { name_en: string } | null;
};

export type SchoolStats = {
  referred: number;
  selected: number;
  referredThisCycle: number;
};

export type SchoolListItemWithStats = SchoolListItem & SchoolStats;

export type SchoolDetail = School & {
  provinces: { name_en: string } | null;
};

export async function listSchoolPartners() {
  return api.get<SchoolListItem[]>("/api/v1/schools");
}

/** School list with referred/selected/this-cycle counts, aggregated client-side
 * from one students query (avoids N+1 per-row calls to getSchoolPerformance). */
export async function listSchoolPartnersWithStats(): Promise<SchoolListItemWithStats[]> {
  const res = await api.get<{ schools: SchoolListItem[]; activeCycleId: string | null; students: unknown[] }>(
    "/api/v1/schools/with-stats",
  );

  const activeCycleId = res.activeCycleId;
  const rows = res.students as {
    school_id: string;
    cycle_id: string;
    committee_decisions: { decision: string | null } | null;
  }[];

  const statsBySchool = new Map<string, SchoolStats>();
  for (const row of rows) {
    const stats = statsBySchool.get(row.school_id) ?? {
      referred: 0,
      selected: 0,
      referredThisCycle: 0,
    };
    stats.referred += 1;
    if (row.committee_decisions?.decision === "selected") stats.selected += 1;
    if (activeCycleId && row.cycle_id === activeCycleId) stats.referredThisCycle += 1;
    statsBySchool.set(row.school_id, stats);
  }

  return res.schools.map((school) => ({
    ...school,
    ...(statsBySchool.get(school.id) ?? { referred: 0, selected: 0, referredThisCycle: 0 }),
  }));
}

export async function updateSchoolOutreachStatus(id: string, outreachStatus: School["outreach_status"]) {
  await api.patch(`/api/v1/schools/${id}/outreach`, { outreachStatus });
}

export async function getSchoolPartner(id: string) {
  return api.get<SchoolDetail>(`/api/v1/schools/${id}`);
}

export async function createSchoolPartner(input: SchoolInsert) {
  return api.post<School>("/api/v1/schools", input);
}

export async function updateSchoolPartner(id: string, input: SchoolUpdate) {
  return api.patch<School>(`/api/v1/schools/${id}`, input);
}

export async function softDeleteSchoolPartner(id: string) {
  await api.delete(`/api/v1/schools/${id}`);
}

/** Referred vs. selected counts for one school (see docs/05-api-design.md §7). */
export async function getSchoolPerformance(schoolId: string) {
  return api.get<{ referred: number; selected: number }>(`/api/v1/schools/${schoolId}/performance`);
}
