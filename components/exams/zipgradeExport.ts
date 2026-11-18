import { candidateDetails, type ExamCandidate, type ExamCenter, type ExamSession } from "@/features/written-exam/scoring";

/**
 * Student list for ZipGrade's "Import students" (CSV): ID, Student ID, First Name,
 * Last Name, Class. ID and Student ID are both the exam number, so the answer
 * sheets scanned in ZipGrade come back with the number our results import reads.
 * Class = the exam center name (ZipGrade groups students by class).
 */
const HEADER = ["ID", "Student ID", "First Name", "Last Name", "Class"];

function cell(v: string) {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function byNumber(a: ExamCandidate, b: ExamCandidate) {
  const na = Number(a.exam_number);
  const nb = Number(b.exam_number);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.exam_number.localeCompare(b.exam_number, undefined, { numeric: true });
}

/** "Angkor_Session_20260401_0800am" — the file name pattern ZipGrade class lists use. */
export function sessionFileName(center: ExamCenter, session: ExamSession | null) {
  const name = center.name.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_") || "Center";
  if (!session) return `${name}_All_sessions`;
  const date = session.session_date.slice(0, 10).replace(/-/g, "");
  let time = "";
  if (session.start_time) {
    const [h, m] = session.start_time.split(":").map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    time = `_${String(h12).padStart(2, "0")}${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
  }
  return `${name}_Session_${date}${time}`;
}

export function zipgradeCsv(candidates: ExamCandidate[], centerById: Map<string, ExamCenter>) {
  const lines = [HEADER.join(",")];
  for (const c of [...candidates].sort(byNumber)) {
    const d = candidateDetails(c);
    const cls = (c.center_id && centerById.get(c.center_id)?.name) || "Unassigned";
    lines.push([c.exam_number, c.exam_number, d.firstName, d.lastName, cls].map((v) => cell(String(v ?? ""))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function downloadZipgradeCsv(fileBase: string, candidates: ExamCandidate[], centerById: Map<string, ExamCenter>) {
  // No BOM: ZipGrade reads the first header as "ID" exactly.
  const blob = new Blob([zipgradeCsv(candidates, centerById)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
