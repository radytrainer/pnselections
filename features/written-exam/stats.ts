/**
 * Selection Process "Exam Centers" and "Exam Results" numbers, calculated
 * from the Written Exams data instead of typed in by hand (0027 stats tables).
 * Attendance is derived: a candidate with a scanned sheet for a paper sat it.
 */
import { candidateGender, evaluate, type ExamData } from "@/features/written-exam/scoring";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function examCenterStats(data: ExamData) {
  const today = todayIso();
  const sessions = data.centers.flatMap((c) => c.sessions);
  return {
    centers_total: data.centers.length,
    sessions_done: sessions.filter((s) => s.session_date < today).length,
    sessions_not_done: sessions.filter((s) => s.session_date >= today).length,
    applicants_total: data.candidates.length,
    applicants_not_assigned: data.candidates.filter((c) => !c.center_id).length,
    applicants_without_schedule: data.candidates.filter((c) => c.center_id && !c.session_id).length,
  };
}

export function examResultStats(data: ExamData) {
  const today = todayIso();
  const sessionDate = new Map(data.centers.flatMap((c) => c.sessions).map((s) => [s.id, s.session_date]));
  const papersSat = new Map<string, Set<string>>();
  // A manual score counts as having sat the paper (e.g. a sheet that couldn't be scanned).
  for (const sh of [...data.sheets, ...(data.overrides ?? [])]) {
    const set = papersSat.get(sh.candidate_id) ?? new Set<string>();
    set.add(sh.paper_id);
    papersSat.set(sh.candidate_id, set);
  }
  const paperCount = data.papers.length;
  let attended = 0;
  let partially = 0;
  let absent = 0;
  let stillToDo = 0;
  for (const c of data.candidates) {
    const sat = papersSat.get(c.id)?.size ?? 0;
    if (paperCount > 0 && sat >= paperCount) attended++;
    else if (sat > 0) partially++;
    else {
      const date = c.session_id ? sessionDate.get(c.session_id) : undefined;
      if (date && date >= today) stillToDo++;
      else absent++;
    }
  }
  const passed = evaluate(data, data.rules).filter((r) => r.passed);
  return {
    attended,
    partially_attended: partially,
    absent,
    still_to_be_done: stillToDo,
    passed: passed.length,
    passed_girls: passed.filter((r) => candidateGender(r.candidate) === "female").length,
    passed_boys: passed.filter((r) => candidateGender(r.candidate) === "male").length,
  };
}
