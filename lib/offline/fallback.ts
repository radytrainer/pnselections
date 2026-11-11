import { getMeta } from "@/lib/offline/store";

/**
 * Answers the Students list endpoints from the downloaded offline bundle
 * when there's no connection and that exact query was never loaded before.
 * Mirrors the filters in api/src/routes/students.ts.
 */

type Query = Record<string, string | number | boolean | string[] | null | undefined>;
export type OfflineStudent = Record<string, unknown> & {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  gender: string;
  status: string;
  cycle_id: string;
  province_id: string | null;
  referred_by_ngo_id: string | null;
  created_at: string;
  social_assessments?: { visitor_name?: string | null }[];
};

export const BUNDLE_STUDENTS_KEY = "bundle-students";

const str = (q: Query | undefined, key: string) => {
  const v = q?.[key];
  return typeof v === "string" && v !== "" ? v : typeof v === "number" ? String(v) : undefined;
};

function filterStudents(students: OfflineStudent[], q: Query | undefined, includeGender = true) {
  const cycleId = str(q, "cycleId");
  const provinceId = str(q, "provinceId");
  const status = str(q, "status");
  const gender = str(q, "gender");
  const homeVisitor = str(q, "homeVisitor");
  const search = str(q, "search")?.toLowerCase();
  const rawNgo = q?.ngoIds;
  const ngoIds = Array.isArray(rawNgo) ? rawNgo : typeof rawNgo === "string" && rawNgo ? rawNgo.split(",") : [];

  return students.filter((s) => {
    if (cycleId && s.cycle_id !== cycleId) return false;
    if (provinceId === "__none__" ? s.province_id !== null : provinceId && s.province_id !== provinceId) return false;
    if (status && s.status !== status) return false;
    if (includeGender && gender && s.gender !== gender) return false;
    if (homeVisitor && !(s.social_assessments ?? []).some((a) => a.visitor_name === homeVisitor)) return false;
    if (ngoIds.length > 0 && !ngoIds.includes(String(s.referred_by_ngo_id))) return false;
    if (search) {
      const hay = `${s.first_name}\n${s.last_name}\n${s.student_code}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export async function offlineListFallback(path: string, query?: Query): Promise<unknown | undefined> {
  if (!path.startsWith("/api/v1/students")) return undefined;
  const students = await getMeta<OfflineStudent[]>(BUNDLE_STUDENTS_KEY);
  if (!students) return undefined;

  if (path === "/api/v1/students") {
    const page = Math.max(1, Number(str(query, "page") ?? 1) || 1);
    const pageSize = Math.max(1, Number(str(query, "pageSize") ?? 25) || 25);
    const matches = filterStudents(students, query).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { data: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pageSize };
  }
  if (path === "/api/v1/students/gender-counts") {
    const matches = filterStudents(students, query, false);
    const male = matches.filter((s) => s.gender === "male").length;
    const female = matches.filter((s) => s.gender === "female").length;
    return { male, female, other: matches.length - male - female, total: matches.length };
  }
  if (path === "/api/v1/students/home-visitors") {
    const names = new Set<string>();
    for (const s of filterStudents(students, { cycleId: str(query, "cycleId") })) {
      for (const a of s.social_assessments ?? []) if (a.visitor_name) names.add(a.visitor_name);
    }
    return Array.from(names).sort();
  }
  return undefined;
}
