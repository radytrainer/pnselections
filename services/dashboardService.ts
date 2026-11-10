import { api } from "@/lib/api/client";

export type DashboardStudent = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  province_name: string | null;
  ngo_name: string | null;
  status: string;
  elimination_reason: string | null;
};

export type DashboardData = {
  students: DashboardStudent[];
  partnerNgos: number;
  partnerSchools: number;
};

export type ProvinceStat = { provinceName: string; studentCount: number };
export type NgoTotalStat = { ngoName: string; studentCount: number };

export async function getDashboardData(): Promise<DashboardData> {
  const res = await api.get<{ students: unknown[]; partnerNgos: number; partnerSchools: number }>(
    "/api/v1/dashboard",
  );

  const students = (res.students as {
    id: string;
    first_name: string;
    last_name: string;
    gender: string;
    status: string;
    elimination_reason: string | null;
    provinces: { name_en: string } | null;
    ngo_partners: { organization_name: string } | null;
  }[]).map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    gender: r.gender,
    status: r.status,
    elimination_reason: r.elimination_reason,
    province_name: r.provinces?.name_en ?? null,
    ngo_name: r.ngo_partners?.organization_name ?? null,
  }));

  return {
    students,
    partnerNgos: res.partnerNgos,
    partnerSchools: res.partnerSchools,
  };
}

// Keep for backward compatibility if needed elsewhere
export type DashboardKpis = {
  totalStudents: number;
  femaleStudents: number;
  maleStudents: number;
  lgbtqiaStudents: number;
  selectedStudents: number;
  partnerNgos: number;
  partnerSchools: number;
  provincesCovered: number;
};

export type VisitorStat = { visitorName: string; studentCount: number };

/**
 * How many distinct students each staff member has visited and recorded a
 * social form for. Prefers the visitor's current full_name (via visitor_id,
 * 0026) over the free-text visitor_name still sitting on pre-0026 rows that
 * never got a visitor_id — those fall back to whatever name was typed in,
 * or "Unknown" if neither is set.
 */
export async function getVisitorStats(): Promise<VisitorStat[]> {
  const rows = (await api.get<unknown[]>("/api/v1/dashboard/visitor-stats")) as {
    student_id: string;
    visitor_name: string | null;
    users: { full_name: string } | null;
    students: { deleted_at: string | null } | null;
  }[];

  const studentsByVisitor = new Map<string, Set<string>>();
  for (const row of rows) {
    // Skip assessments whose student has been deleted
    if (!row.students || row.students.deleted_at !== null) continue;
    const name = row.users?.full_name || row.visitor_name || "Unknown";
    const students = studentsByVisitor.get(name) ?? new Set<string>();
    students.add(row.student_id);
    studentsByVisitor.set(name, students);
  }

  return Array.from(studentsByVisitor.entries())
    .map(([visitorName, students]) => ({ visitorName, studentCount: students.size }))
    .sort((a, b) => b.studentCount - a.studentCount);
}
