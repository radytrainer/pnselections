/**
 * Student list export (Students page → Export): fetches every student that
 * matches the page's filters and shapes them into clean, consistently
 * formatted rows, optionally grouped by exam center, interview center or
 * province. The printable page (/report/students-list) and the Word file
 * both render this same model.
 */
import { studentStatusLabel, displayStudentStatus, type StudentStatus } from "@/lib/constants";
import { listStudents, type StudentFilters, type StudentListItem } from "@/services/studentService";

export type GroupBy = "none" | "exam" | "interview" | "province";

export const GROUP_OPTIONS: { value: GroupBy; label: string; hint: string }[] = [
  { value: "none", label: "One list", hint: "All students in a single table" },
  { value: "exam", label: "By exam center", hint: "A section (new page) for each exam center" },
  { value: "interview", label: "By interview center", hint: "A section for each interview center" },
  { value: "province", label: "By province", hint: "A section for each province" },
];

export type ExportRow = {
  no: number;
  code: string;
  name: string;
  gender: string;
  dob: string;
  age: string;
  phone: string;
  province: string;
  school: string;
  ngo: string;
  examCenter: string;
  interviewCenter: string;
  status: string;
};

export type Counts = { total: number; female: number; male: number; other: number };
export type ExportGroup = { name: string; rows: ExportRow[]; counts: Counts };

export type ExportColumn = { key: keyof ExportRow; label: string; width: number; align?: "right" | "center"; mono?: boolean };

export type StudentExport = {
  title: string;
  cycleName: string;
  filtersText: string;
  groupBy: GroupBy;
  generated: string;
  generatedBy: string | null;
  groups: ExportGroup[];
  totals: Counts;
  statusTotals: { label: string; value: number }[];
  columns: ExportColumn[];
  fileName: string;
};

/** Filters as passed in the URL of the print page. */
export type ExportParams = StudentFilters & { groupBy: GroupBy; cycleName: string; filtersText: string };

const GENDER: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };
const DASH = "—";

/** Collapses spaces and capitalizes each word's first letter (Latin names only; Khmer is left as is). */
export function cleanName(s: string | null | undefined) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/** Cambodian phone numbers as "012 345 678" / "097 123 4567"; anything else just trimmed. */
export function cleanPhone(s: string | null | undefined) {
  if (!s) return "";
  let d = s.replace(/[^\d+]/g, "");
  if (d.startsWith("+855")) d = `0${d.slice(4)}`;
  else if (d.startsWith("855") && d.length >= 11) d = `0${d.slice(3)}`;
  if (/^0\d{8}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return s.trim();
}

/**
 * "First Last" with doubled names collapsed: some imports put the full name in
 * both fields ("Rorm Channey" + "Rorm Channey"), or the last name inside the
 * first ("Rorm Channey" + "Channey").
 */
export function fullName(first: string | null | undefined, last: string | null | undefined) {
  const f = cleanName(first);
  const l = cleanName(last);
  if (!l || f.toLowerCase() === l.toLowerCase() || f.toLowerCase().endsWith(` ${l.toLowerCase()}`)) return f || l;
  if (!f || l.toLowerCase().startsWith(`${f.toLowerCase()} `)) return l || f;
  const words = `${f} ${l}`.split(" ");
  const half = words.length / 2;
  if (Number.isInteger(half) && words.slice(0, half).join(" ").toLowerCase() === words.slice(half).join(" ").toLowerCase()) return words.slice(0, half).join(" ");
  return `${f} ${l}`;
}

const fmtDate = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

function ageOf(s: StudentListItem): string {
  if (s.dob) {
    const b = new Date(`${s.dob.slice(0, 10)}T00:00:00`);
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
    return a > 0 && a < 100 ? String(a) : "";
  }
  const visitAge = [...(s.social_assessments ?? [])].sort((x, y) => y.visit_number - x.visit_number)[0]?.age;
  return visitAge ? String(visitAge) : "";
}

const count = (rows: ExportRow[]): Counts => ({
  total: rows.length,
  female: rows.filter((r) => r.gender === "Female").length,
  male: rows.filter((r) => r.gender === "Male").length,
  other: rows.filter((r) => r.gender !== "Female" && r.gender !== "Male").length,
});

/** Every student matching the filters (the API returns at most 500 per page). */
export async function fetchAllStudents(filters: StudentFilters): Promise<StudentListItem[]> {
  const out: StudentListItem[] = [];
  for (let page = 1; page < 100; page++) {
    const r = await listStudents({ ...filters, page, pageSize: 500 });
    out.push(...r.data);
    if (out.length >= r.total || r.data.length === 0) break;
  }
  return out;
}

export function buildStudentExport(students: StudentListItem[], p: { groupBy: GroupBy; cycleName: string; filtersText: string; generatedBy?: string | null }): StudentExport {
  const rows = students.map((s) => {
    const status = displayStudentStatus(s.status as StudentStatus, s.elimination_reason);
    const label = studentStatusLabel(status);
    return {
      raw: s,
      row: {
        no: 0,
        code: s.student_code ?? "",
        name: fullName(s.first_name, s.last_name),
        gender: GENDER[s.gender ?? ""] ?? DASH,
        dob: fmtDate(s.dob),
        age: ageOf(s),
        phone: cleanPhone(s.phone),
        province: s.provinces?.name_en ?? "",
        school: (s.school_partners?.school_name ?? "").replace(/\s+/g, " ").trim(),
        ngo: (s.ngo_partners?.organization_name ?? "").replace(/\s+/g, " ").trim(),
        examCenter: s.exam_center_name ?? "",
        interviewCenter: s.interview_center_name ?? "",
        status: label.charAt(0).toUpperCase() + label.slice(1),
      } satisfies ExportRow,
    };
  });

  const keyOf = (r: ExportRow) =>
    p.groupBy === "exam" ? r.examCenter || "No exam center" : p.groupBy === "interview" ? r.interviewCenter || "No interview center" : p.groupBy === "province" ? r.province || "No province" : "All students";
  const byCode = (a: ExportRow, b: ExportRow) => a.code.localeCompare(b.code, undefined, { numeric: true }) || a.name.localeCompare(b.name);

  const map = new Map<string, ExportRow[]>();
  for (const { row } of rows) map.set(keyOf(row), [...(map.get(keyOf(row)) ?? []), row]);
  const groups = [...map.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort(byCode).map((r, i) => ({ ...r, no: i + 1 }));
      return { name, rows: sorted, counts: count(sorted) };
    })
    // Named centers alphabetically; "No … center" last.
    .sort((a, b) => Number(a.name.startsWith("No ")) - Number(b.name.startsWith("No ")) || a.name.localeCompare(b.name));

  const all = groups.flatMap((g) => g.rows);
  const statusMap = new Map<string, number>();
  for (const r of all) statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);

  // The column the list is grouped by is in the section title, so it's left out of the table.
  const columns: ExportColumn[] = [
    { key: "no", label: "No", width: 4, align: "right" },
    { key: "code", label: "Student ID", width: 9, mono: true },
    { key: "name", label: "Full name", width: 16 },
    { key: "gender", label: "Gender", width: 6 },
    { key: "dob", label: "Date of birth", width: 7.5 },
    { key: "age", label: "Age", width: 4, align: "center" },
    { key: "phone", label: "Phone", width: 8.5 },
    ...(p.groupBy === "province" ? [] : [{ key: "province" as const, label: "Province", width: 11 }]),
    { key: "school", label: "High school", width: 12 },
    { key: "ngo", label: "NGO", width: 9 },
    ...(p.groupBy === "exam" ? [] : [{ key: "examCenter" as const, label: "Exam center", width: 9 }]),
    ...(p.groupBy === "interview" ? [] : [{ key: "interviewCenter" as const, label: "Interview center", width: 9 }]),
    { key: "status", label: "Status", width: 9 },
  ];
  // Hide columns that are empty for every student (e.g. no interview centers yet).
  const used = columns.filter((c) => c.key === "no" || c.key === "code" || c.key === "name" || all.some((r) => String(r[c.key]).trim() !== ""));

  const title = p.groupBy === "exam" ? "Student List by Exam Center" : p.groupBy === "interview" ? "Student List by Interview Center" : p.groupBy === "province" ? "Student List by Province" : "Student List";
  const single = groups.length === 1 && p.groupBy !== "none" ? ` - ${groups[0].name}` : "";
  return {
    title,
    cycleName: p.cycleName,
    filtersText: p.filtersText,
    groupBy: p.groupBy,
    generated: new Date().toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    generatedBy: p.generatedBy ?? null,
    groups,
    totals: count(all),
    statusTotals: [...statusMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    columns: used,
    fileName: `${title}${single} - ${p.cycleName || "All cycles"}`.replace(/[\\/:*?"<>|]/g, "-"),
  };
}

/** Builds the print-page URL for the current filters. */
export function exportUrl(params: ExportParams, print = true) {
  const q = new URLSearchParams();
  const set = (k: string, v: string | undefined | null) => v && q.set(k, v);
  set("cycleId", params.cycleId);
  set("search", params.search);
  set("status", params.status);
  set("homeVisitor", params.homeVisitor);
  set("provinceId", params.provinceId);
  set("ngoIds", params.ngoIds?.join(","));
  set("examCenterId", params.examCenterId);
  set("interviewCenterId", params.interviewCenterId);
  if (params.hideOut) q.set("hideOut", "1");
  q.set("groupBy", params.groupBy);
  set("cycleName", params.cycleName);
  set("filters", params.filtersText);
  if (print) q.set("print", "1");
  return `/report/students-list?${q.toString()}`;
}

/** Reads the print-page URL back into filters. */
export function readExportParams(q: URLSearchParams): ExportParams {
  const g = q.get("groupBy");
  return {
    cycleId: q.get("cycleId") ?? undefined,
    search: q.get("search") ?? undefined,
    status: q.get("status") ?? undefined,
    homeVisitor: q.get("homeVisitor") ?? undefined,
    provinceId: q.get("provinceId") ?? undefined,
    ngoIds: q.get("ngoIds")?.split(",").filter(Boolean),
    examCenterId: q.get("examCenterId") ?? undefined,
    interviewCenterId: q.get("interviewCenterId") ?? undefined,
    hideOut: q.get("hideOut") === "1",
    groupBy: g === "exam" || g === "interview" || g === "province" ? g : "none",
    cycleName: q.get("cycleName") ?? "",
    filtersText: q.get("filters") ?? "",
  };
}
