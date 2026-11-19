/**
 * Turns a cycle's raw data (students, information sessions, written exams)
 * plus the saved written content into everything the Annual Report shows.
 * Pure and synchronous — the page, the print view and the Word export all
 * render the same ReportModel, so the three can't disagree.
 */
import { hasPassedInterview, INTERVIEW_FAIL_REASON } from "@/lib/constants";
import { candidateDetails, candidateGender, evaluate, round, subjectMax, paperMax, type ExamData } from "@/features/written-exam/scoring";
import { CATEGORY_LABELS, type SocialFormCategory } from "@/features/social-form/scoring";
import { INCOME_OPTS, PARENT_OCCUPATION_OPTS } from "@/features/social-form/labels";
import { presenterLabel, type InformationSession } from "@/services/informationSessionService";
import type { ReportSource, ReportStudent } from "@/services/annualReportService";
import {
  CHAPTERS,
  FIGURES,
  STAGES,
  TEXTS,
  type BudgetRow,
  type ChapterKey,
  type FigureKey,
  type ReportContent,
  type StageKey,
  type StageReview,
  type TextKey,
  type TimelineRow,
} from "./content";
import { themeFor, type ReportTheme } from "./templates";

export type Count = { total: number; female: number; male: number; other: number };
export type ProvinceRow = Count & { province: string; extra?: number };
export type Bar = { label: string; value: number };
export type Stat = { n: number; min: number; max: number; avg: number; median: number };
export type SubjectStat = { subject: string; max: number; overall: Stat | null; selected: Stat | null };

export type ReportModel = {
  theme: ReportTheme;
  cycleName: string;
  year: number;
  title: string;
  subtitle: string;
  generation: string;
  tagline: string;
  supportedBy: string[];
  generated: string;
  chapters: { key: ChapterKey; label: string; number: string }[];
  fig: Record<FigureKey, number | null>;
  text: Record<TextKey, string>;
  /** Sentences written from the figures, printed before staff's own text. */
  summary: Partial<Record<ChapterKey, string>>;
  photos: Partial<Record<string, string[]>>;
  is: {
    attendees: Count;
    sessions: { name: string; date: string | null; province: string | null; presenter: string | null; registrations: number }[];
    byProvince: ProvinceRow[];
    byPresenter: Bar[];
    registrations: number;
    ngoRegistrations: number;
  };
  exam: {
    takers: Count;
    passed: Count;
    byProvince: (ProvinceRow & { passed: number })[];
    centers: { name: string; province: string | null; takers: number; passed: number }[];
    subjects: SubjectStat[];
    selectedWithScores: number;
  };
  mi: { interviewed: Count; passed: Count; byProvince: ProvinceRow[] };
  hv: { visited: Count; byProvince: ProvinceRow[]; vulnerabilities: Bar[]; categories: Bar[]; avgScore: number | null };
  fsc: { cases: Count; decisions: Bar[]; byProvince: ProvinceRow[] };
  declined: { total: Count; byProvince: (ProvinceRow & { reasons: string[] })[] };
  klass: {
    total: Count;
    byProvince: (ProvinceRow & { lgbtq: number; disability: number })[];
    provinces: number;
    districts: number;
    schools: number;
    fromNgo: number;
    ages: Bar[];
    childRank: Bar[];
    household: { avg: number | null; max: number | null; withData: number };
    income: Bar[];
    fatherJobs: Bar[];
    motherJobs: Bar[];
    parents: Bar[];
    disability: number;
  };
  funnel: Bar[];
  timeline: (TimelineRow & { auto: boolean })[];
  staff: { name: string; stages: Set<StageKey> }[];
  budget: { rows: (BudgetRow & { total: number })[]; columns: StageKey[]; totals: Record<string, number>; grand: number };
  reviews: Record<StageKey, StageReview>;
};

const GENDER_EMPTY = (): Count => ({ total: 0, female: 0, male: 0, other: 0 });

function add(c: Count, gender: string | null | undefined, n = 1) {
  c.total += n;
  if (gender === "female") c.female += n;
  else if (gender === "male") c.male += n;
  else c.other += n;
}

function count<T>(items: T[], gender: (t: T) => string | null | undefined): Count {
  const c = GENDER_EMPTY();
  for (const it of items) add(c, gender(it));
  return c;
}

function byProvince<T>(items: T[], province: (t: T) => string | null | undefined, gender: (t: T) => string | null | undefined): ProvinceRow[] {
  const map = new Map<string, ProvinceRow>();
  for (const it of items) {
    const key = province(it)?.trim() || "Not recorded";
    const row = map.get(key) ?? { province: key, ...GENDER_EMPTY() };
    add(row, gender(it));
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.province.localeCompare(b.province));
}

function bars(map: Map<string, number>, order?: string[]): Bar[] {
  const out = [...map.entries()].map(([label, value]) => ({ label, value }));
  return order ? out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : out.sort((a, b) => b.value - a.value);
}

function tally<T>(items: T[], key: (t: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function stat(values: number[]): Stat | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return {
    n: s.length,
    min: round(s[0]),
    max: round(s[s.length - 1]),
    avg: round(s.reduce((a, b) => a + b, 0) / s.length),
    median: round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2),
  };
}

const minMax = (dates: (string | null | undefined)[]) => {
  const d = dates.filter((x): x is string => !!x).map((x) => x.slice(0, 10)).sort();
  return d.length ? { start: d[0], end: d[d.length - 1] } : null;
};

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
export const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
export const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

function isOutAfterCommittee(s: ReportStudent) {
  return s.status === "declined" || s.status === "dropped_out";
}

export function buildReportModel(
  source: ReportSource,
  content: ReportContent,
  sessions: InformationSession[],
  exam: ExamData | null,
): ReportModel {
  const year = source.cycle.year;
  const students = source.students;
  const g = (s: ReportStudent) => s.gender;
  const prov = (s: ReportStudent) => s.province;

  // ---- Information sessions ----------------------------------------------
  const isStats = source.informationSessionStats;
  const regGirls = sessions.reduce((a, s) => a + s.girls, 0);
  const regBoys = sessions.reduce((a, s) => a + s.boys, 0);
  const registrations = sessions.reduce((a, s) => a + s.registrations, 0);
  const typedAttendees = isStats && isStats.attendees_actual_boys + isStats.attendees_actual_girls > 0;
  const isProvince = new Map<string, ProvinceRow>();
  for (const s of sessions) {
    const key = s.province_name || "Not recorded";
    const row = isProvince.get(key) ?? { province: key, ...GENDER_EMPTY(), extra: 0 };
    row.extra = (row.extra ?? 0) + 1; // sessions
    row.female += s.girls;
    row.male += s.boys;
    row.other += Math.max(0, s.registrations - s.girls - s.boys);
    row.total += s.registrations;
    isProvince.set(key, row);
  }
  const presenters = tally(sessions, (s) => presenterLabel(s.presenter_type) ?? "Not recorded");

  // ---- Written exams -------------------------------------------------------
  const selectedIds = new Set(students.filter((s) => s.status === "selected").map((s) => s.id));
  let examModel: ReportModel["exam"] = {
    takers: GENDER_EMPTY(),
    passed: GENDER_EMPTY(),
    byProvince: [],
    centers: [],
    subjects: [],
    selectedWithScores: 0,
  };
  let examSessions = 0;
  let examDates: string[] = [];
  if (exam && exam.candidates.length) {
    const sat = new Set([...exam.sheets.map((s) => s.candidate_id), ...(exam.overrides ?? []).map((o) => o.candidate_id)]);
    const results = evaluate(exam, exam.rules).filter((r) => sat.has(r.candidate.id));
    const centerById = new Map(exam.centers.map((c) => [c.id, c]));
    const provinceOf = (r: (typeof results)[number]) =>
      candidateDetails(r.candidate).province || (r.candidate.center_id ? centerById.get(r.candidate.center_id)?.province_name : null) || null;
    const genderOf = (r: (typeof results)[number]) => candidateGender(r.candidate);
    const passed = results.filter((r) => r.passed);
    const provRows = byProvince(results, provinceOf, genderOf).map((row) => ({
      ...row,
      passed: passed.filter((r) => (provinceOf(r)?.trim() || "Not recorded") === row.province).length,
    }));
    const centers = exam.centers
      .map((c) => {
        const inCenter = results.filter((r) => r.candidate.center_id === c.id);
        return { name: c.name, province: c.province_name, takers: inCenter.length, passed: inCenter.filter((r) => r.passed).length };
      })
      .filter((c) => c.takers > 0)
      .sort((a, b) => b.takers - a.takers);
    const isSelected = (r: (typeof results)[number]) => !!r.candidate.student_id && selectedIds.has(r.candidate.student_id);
    const subjects: SubjectStat[] = [];
    for (const paper of exam.papers) {
      const parts = paper.subjects.length
        ? paper.subjects.map((sub) => ({ name: sub.name, max: subjectMax(paper, sub), get: (r: (typeof results)[number]) => r.scores[paper.id]?.subjects[sub.id]?.score }))
        : [{ name: paper.name, max: paperMax(paper), get: (r: (typeof results)[number]) => r.scores[paper.id]?.total }];
      for (const part of parts) {
        const all = results.map(part.get).filter((v): v is number => typeof v === "number");
        const sel = results.filter(isSelected).map(part.get).filter((v): v is number => typeof v === "number");
        subjects.push({ subject: part.name, max: part.max, overall: stat(all), selected: stat(sel) });
      }
    }
    examModel = {
      takers: count(results, genderOf),
      passed: count(passed, genderOf),
      byProvince: provRows,
      centers,
      subjects,
      selectedWithScores: results.filter(isSelected).length,
    };
    const allSessions = exam.centers.flatMap((c) => c.sessions);
    examSessions = allSessions.length || centers.length;
    examDates = allSessions.map((s) => s.session_date);
  }

  // ---- Students through the later stages ----------------------------------
  const interviewed = students.filter(
    (s) => s.interview != null || hasPassedInterview(s.status, s.elimination_reason) || s.elimination_reason === INTERVIEW_FAIL_REASON,
  );
  const miPassed = students.filter((s) => hasPassedInterview(s.status, s.elimination_reason) || s.interview === "A1" || s.interview === "A2");
  const visited = students.filter((s) => s.visited);
  const cases = students.filter(
    (s) => s.decision != null || ["committee_review", "selected", "waitlisted", "rejected", "declined", "dropped_out"].includes(s.status),
  );
  const eligible = cases.filter((s) => s.decision === "selected" || s.decision === "waitlisted" || s.status === "selected" || s.status === "waitlisted");
  const klass = students.filter((s) => s.status === "selected");
  const declined = students.filter(isOutAfterCommittee);

  const vulnerabilities: Bar[] = [
    { label: "Orphan or single parent", value: visited.filter((s) => s.vulnerability_orphan_single_parent).length },
    { label: "Disability in the family", value: visited.filter((s) => s.vulnerability_disability).length },
    { label: "Chronic illness", value: visited.filter((s) => s.vulnerability_chronic_illness).length },
    { label: "Heavy debt", value: visited.filter((s) => s.vulnerability_debt_burden).length },
    { label: "Landless", value: visited.filter((s) => s.vulnerability_landless).length },
  ];
  const categories = bars(
    tally(visited, (s) => (s.category ? (CATEGORY_LABELS[s.category as SocialFormCategory] ?? s.category) : null)),
    Object.values(CATEGORY_LABELS),
  );
  const hvScores = visited.map((s) => s.final_score).filter((v): v is number => v != null);

  const decisionLabel: Record<string, string> = { selected: "Selected", waitlisted: "Waiting list", rejected: "Not selected", eliminated: "Eliminated" };
  const decisions = bars(tally(cases, (s) => (s.decision ? (decisionLabel[s.decision] ?? s.decision) : "Pending")));

  // Declined before enrollment, per province, with their reasons.
  const declinedRows = byProvince(declined, prov, g).map((row) => ({
    ...row,
    reasons: [
      ...new Set(
        declined
          .filter((s) => (s.province?.trim() || "Not recorded") === row.province)
          .map((s) => s.elimination_reason?.split("\n")[0].trim())
          .filter((r): r is string => !!r)
          .map((r) => (r.length > 70 ? `${r.slice(0, 67)}…` : r)),
      ),
    ].slice(0, 3),
  }));

  // ---- Class profile -------------------------------------------------------
  const refYear = year;
  const ageOf = (s: ReportStudent) => {
    if (s.age != null) return s.age;
    if (!s.dob) return null;
    return refYear - Number(s.dob.slice(0, 4));
  };
  const ages = new Map<string, number>();
  for (const s of klass) {
    const a = ageOf(s);
    if (a == null) continue;
    const label = a <= 17 ? "17 or younger" : a >= 22 ? "22 or older" : `${a} years`;
    ages.set(label, (ages.get(label) ?? 0) + 1);
  }
  const ageOrder = ["17 or younger", "18 years", "19 years", "20 years", "21 years", "22 or older"];
  const rank = new Map<string, number>();
  for (const s of klass) {
    if (s.child_rank == null || s.children_count == null) continue;
    const label =
      s.children_count <= 1 ? "Only child" : s.child_rank <= 1 ? "Eldest" : s.child_rank >= s.children_count ? "Youngest" : "Middle";
    rank.set(label, (rank.get(label) ?? 0) + 1);
  }
  const household = klass
    .map((s) => (s.family_male_count ?? 0) + (s.family_female_count ?? 0))
    .filter((n) => n > 0);
  const occ = (v: string | null) => PARENT_OCCUPATION_OPTS.find((o) => o.value === v)?.label ?? null;
  const income = bars(
    tally(klass, (s) => INCOME_OPTS.find((o) => o.value === s.income_band)?.label ?? null),
    INCOME_OPTS.map((o) => o.label),
  );
  const parents = bars(
    tally(klass.filter((s) => s.visited && s.vulnerability_orphan_single_parent != null), (s) =>
      s.vulnerability_orphan_single_parent ? "Orphan or single parent" : "Both parents",
    ),
  );
  const classProvinces = byProvince(klass, prov, g).map((row) => {
    const inRow = klass.filter((s) => (s.province?.trim() || "Not recorded") === row.province);
    return { ...row, lgbtq: row.other, disability: inRow.filter((s) => s.vulnerability_disability).length };
  });

  // ---- Figures (typed-in values win) ---------------------------------------
  const auto: Partial<Record<FigureKey, number>> = {
    // Sessions created in the app, or the hand-typed Selection Process number when that's higher.
    is_sessions: Math.max(sessions.length, isStats?.sessions_done ?? 0),
    is_female: typedAttendees ? isStats!.attendees_actual_girls : regGirls,
    is_male: typedAttendees ? isStats!.attendees_actual_boys : regBoys,
    is_schools: new Set(sessions.map((s) => s.venue?.trim().toLowerCase()).filter(Boolean)).size,
    partner_schools: source.partners.schools,
    partner_ngos: source.partners.ngos,
    exam_takers: examModel.takers.total,
    exam_female: examModel.takers.female,
    exam_male: examModel.takers.male,
    exam_count: examSessions,
    exam_provinces: examModel.byProvince.filter((p) => p.province !== "Not recorded").length,
    exam_passed: examModel.passed.total,
    mi_interviewed: interviewed.length,
    mi_passed: miPassed.length,
    hv_visited: visited.length,
    fsc_cases: cases.length,
    fsc_eligible: eligible.length,
    contracts: klass.length,
  };
  const typed = content.figures ?? {};
  const fig = Object.fromEntries(
    (Object.keys(FIGURES) as FigureKey[]).map((k) => {
      const t = typed[k];
      return [k, t != null && !Number.isNaN(t) ? t : (auto[k] ?? null)];
    }),
  ) as Record<FigureKey, number | null>;
  const attendeesTotal = (fig.is_female ?? 0) + (fig.is_male ?? 0);

  // ---- Funnel --------------------------------------------------------------
  const funnel: Bar[] = [
    { label: "Information session attendees", value: attendeesTotal },
    { label: "Exam takers", value: fig.exam_takers ?? 0 },
    { label: "Motivation interviews", value: fig.mi_interviewed ?? 0 },
    { label: "Home visits", value: fig.hv_visited ?? 0 },
    { label: "Committee cases", value: fig.fsc_cases ?? 0 },
    { label: "Contracts signed", value: fig.contracts ?? 0 },
  ];

  // ---- Timeline ------------------------------------------------------------
  const autoTimeline: (TimelineRow & { auto: boolean })[] = [];
  const pushRange = (stage: string, r: { start: string; end: string } | null) => r && autoTimeline.push({ stage, ...r, auto: true });
  pushRange("Information sessions", minMax(sessions.map((s) => s.session_date)));
  pushRange("Examinations", minMax(examDates));
  pushRange("Motivation interviews", minMax(students.map((s) => s.interview_date)));
  pushRange("Home visits", minMax(students.map((s) => s.visit_date)));
  pushRange("Final selection committee", minMax(students.map((s) => s.decision_date)));
  const timeline = content.timeline?.length ? content.timeline.map((t) => ({ ...t, auto: false })) : autoTimeline;

  // ---- Staff ---------------------------------------------------------------
  const staffMap = new Map<string, Set<StageKey>>();
  const addStaff = (name: string, stage: StageKey) => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    const key = [...staffMap.keys()].find((k) => k.toLowerCase() === clean.toLowerCase()) ?? clean;
    staffMap.set(key, (staffMap.get(key) ?? new Set()).add(stage));
  };
  for (const s of source.staff) addStaff(s.name, s.stage);
  for (const s of sessions) {
    if (s.presenter_type === "pnc_staff" && s.presenter_name) s.presenter_name.split(/[,;/&]| and /).forEach((n) => addStaff(n, "info_sessions"));
  }
  for (const row of content.staff ?? []) for (const st of row.stages) addStaff(row.name, st);
  const staff = [...staffMap.entries()].map(([name, stages]) => ({ name, stages })).sort((a, b) => a.name.localeCompare(b.name));

  // ---- Budget --------------------------------------------------------------
  const budgetRows = (content.budget ?? [])
    .filter((b) => b.item.trim())
    .map((b) => ({ ...b, total: STAGES.reduce((a, s) => a + (Number(b.amounts[s.key]) || 0), 0) }));
  const columns = STAGES.map((s) => s.key).filter((k) => budgetRows.some((b) => Number(b.amounts[k]) > 0));
  const totals = Object.fromEntries(columns.map((k) => [k, budgetRows.reduce((a, b) => a + (Number(b.amounts[k]) || 0), 0)]));
  const grand = budgetRows.reduce((a, b) => a + b.total, 0);

  // ---- Generated sentences -------------------------------------------------
  const summary: Partial<Record<ChapterKey, string>> = {};
  if (attendeesTotal > 0) {
    const target = fig.is_target_female;
    summary.info_sessions =
      `A total of ${fmt(attendeesTotal)} young people attended ${plural(fig.is_sessions ?? 0, "information session")}` +
      `${fig.is_online ? ` (${fmt(fig.is_online)} online)` : ""}: ${fmt(fig.is_female)} girls (${pct(fig.is_female ?? 0, attendeesTotal)}%) and ${fmt(fig.is_male)} boys.` +
      (target ? ` The target was ${target}% girls${pct(fig.is_female ?? 0, attendeesTotal) >= target ? ", which was reached" : ""}.` : "") +
      (fig.is_target_attendees ? ` The attendance target was ${fmt(fig.is_target_attendees)} participants${attendeesTotal >= fig.is_target_attendees ? " — exceeded" : ""}.` : "") +
      (registrations > 0 ? ` ${fmt(registrations)} students registered online for the exam.` : "");
  }
  if ((fig.exam_takers ?? 0) > 0) {
    const top = examModel.byProvince.filter((p) => p.province !== "Not recorded").slice(0, 3);
    summary.exams =
      `${fmt(fig.exam_takers)} youth sat the entrance exam${fig.exam_count ? ` across ${plural(fig.exam_count, "exam session")}` : ""}` +
      `${fig.exam_provinces ? ` in ${plural(fig.exam_provinces, "province")}` : ""} — ${fmt(fig.exam_female)} females and ${fmt(fig.exam_male)} males` +
      `${fig.exam_indigenous ? `, including ${fmt(fig.exam_indigenous)} from indigenous groups` : ""}.` +
      (fig.exam_passed ? ` ${fmt(fig.exam_passed)} (${pct(fig.exam_passed, fig.exam_takers ?? 0)}%) passed and moved on to the motivation interview.` : "") +
      (top.length ? ` The largest turnouts were in ${list(top.map((p) => `${p.province} (${fmt(p.total)})`))}.` : "");
  }
  if ((fig.mi_interviewed ?? 0) > 0 || (fig.mi_passed ?? 0) > 0) {
    const mp = count(miPassed, g);
    const top = byProvince(miPassed, prov, g).filter((p) => p.province !== "Not recorded").slice(0, 2);
    summary.interviews =
      `${fmt(fig.mi_passed)} students passed the motivation interview${fig.mi_interviewed ? ` out of ${fmt(fig.mi_interviewed)} interviewed` : ""}` +
      `${fig.mi_online ? ` (${fmt(fig.mi_online)} online)` : ""}: ${fmt(mp.male)} males and ${fmt(mp.female)} females — ${pct(mp.female, mp.total)}% female.` +
      (top.length ? ` ${list(top.map((p) => p.province))} recorded the most passers.` : "");
  }
  if ((fig.hv_visited ?? 0) > 0) {
    const v = count(visited, g);
    const top = byProvince(visited, prov, g).filter((p) => p.province !== "Not recorded");
    summary.home_visits =
      `${fmt(fig.hv_visited)} families were visited: ${fmt(v.male)} male and ${fmt(v.female)} female students${v.other ? `, and ${fmt(v.other)} LGBTQIA+` : ""}.` +
      (top.length > 1 ? ` ${top[0].province} had the most visits (${fmt(top[0].total)}), followed by ${top[1].province} (${fmt(top[1].total)}).` : "") +
      (fig.hv_indigenous ? ` ${fmt(fig.hv_indigenous)} indigenous students were visited.` : "") +
      (fig.hv_youth_war ? ` ${fmt(fig.hv_youth_war)} came from conflict-affected areas.` : "");
  }
  if ((fig.fsc_cases ?? 0) > 0) {
    const c = count(cases, g);
    summary.committee =
      `${fmt(fig.fsc_cases)} cases were presented to the Final Selection Committee — ${fmt(c.male)} males and ${fmt(c.female)} females${c.other ? `, ${fmt(c.other)} LGBTQIA+` : ""}.` +
      (fig.fsc_eligible ? ` ${fmt(fig.fsc_eligible)} were found eligible for the final list.` : "") +
      (fig.fsc_indigenous || fig.fsc_muslim
        ? ` The cases included ${list([fig.fsc_indigenous ? `${fmt(fig.fsc_indigenous)} indigenous students` : "", fig.fsc_muslim ? `${fmt(fig.fsc_muslim)} Muslim students` : ""].filter(Boolean))}.`
        : "");
  }
  if (klass.length || fig.contracts) {
    const k = count(klass, g);
    summary.announcement =
      `A total of ${fmt(fig.contracts)} students were officially selected and signed the training contract — ${fmt(k.male)} males and ${fmt(k.female)} females` +
      `${k.other ? `, ${fmt(k.other)} LGBTQIA+` : ""}, from ${plural(classProvinces.filter((p) => p.province !== "Not recorded").length, "province")}.` +
      (declined.length ? ` ${plural(declined.length, "student")} declined the offer before enrollment.` : "");
    const ageTop = bars(ages)[0];
    const eldest = rank.get("Eldest") ?? 0;
    summary.class =
      `The new class has ${fmt(k.total)} students: ${pct(k.female, k.total)}% girls and ${pct(k.male, k.total)}% boys.` +
      (ageTop ? ` Most are ${ageTop.label.replace(" years", " years old")} (${pct(ageTop.value, k.total)}%).` : "") +
      (eldest ? ` ${pct(eldest, [...rank.values()].reduce((a, b) => a + b, 0))}% are the eldest child in their family.` : "") +
      (fig.class_rural ? ` ${fmt(fig.class_rural)} of them (${pct(fig.class_rural, k.total)}%) come from rural areas.` : "") +
      (fig.class_indigenous ? ` ${fmt(fig.class_indigenous)} are from indigenous groups.` : "");
  }
  if (attendeesTotal > 0 && fig.contracts) {
    summary.figures =
      `Starting with ${fmt(attendeesTotal)} information session attendees, ${fmt(fig.contracts)} students reached enrollment — ` +
      `${pct(fig.contracts, attendeesTotal)}% of the initial attendees, showing how selective each step was, from the exam and interview to the home visit and the committee.`;
  }
  if (grand > 0) {
    const biggest = columns.map((k) => ({ k, v: totals[k] })).sort((a, b) => b.v - a.v)[0];
    summary.budget =
      `Total expenses for the selection process were USD ${usd(grand)}.` +
      (biggest ? ` ${STAGES.find((s) => s.key === biggest.k)?.label} cost the most: USD ${usd(biggest.v)} (${pct(biggest.v, grand)}%).` : "");
  }
  if (staff.length) summary.staff = `${plural(staff.length, "staff member")} took part in the selection process.`;

  // ---- Chapters shown ------------------------------------------------------
  const hidden = new Set(content.hidden ?? []);
  const chapters = CHAPTERS.filter((c) => !hidden.has(c.key)).map((c, i) => ({ key: c.key, label: c.label, number: String(i + 1).padStart(2, "0") }));

  return {
    theme: themeFor(content.template),
    cycleName: source.cycle.name,
    year,
    title: content.title?.trim() || `Selection Report ${year}`,
    subtitle: content.subtitle?.trim() || `Report process ${year}`,
    generation: content.generation?.trim() || `Generation ${year + 2} (${year + 1}–${year + 2})`,
    tagline:
      content.tagline?.trim() ||
      "Identifying, assessing and admitting disadvantaged young people to the PNC 2-year IT training program",
    supportedBy: (content.supportedBy ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    generated: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    chapters,
    fig,
    text: Object.fromEntries((Object.keys(TEXTS) as TextKey[]).map((k) => [k, content.text?.[k]?.trim() ?? ""])) as Record<TextKey, string>,
    summary,
    photos: content.photos ?? {},
    is: {
      attendees: { total: attendeesTotal, female: fig.is_female ?? 0, male: fig.is_male ?? 0, other: 0 },
      sessions: sessions
        .map((s) => ({
          name: s.name,
          date: s.session_date,
          province: s.province_name,
          presenter: [presenterLabel(s.presenter_type), s.presenter_name].filter(Boolean).join(" · ") || null,
          registrations: s.registrations,
        }))
        .sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9")),
      byProvince: [...isProvince.values()].sort((a, b) => b.total - a.total || (b.extra ?? 0) - (a.extra ?? 0)),
      byPresenter: bars(presenters),
      registrations,
      ngoRegistrations: sessions.reduce((a, s) => a + (s.ngo ?? 0), 0),
    },
    exam: examModel,
    mi: { interviewed: count(interviewed, g), passed: count(miPassed, g), byProvince: byProvince(miPassed, prov, g) },
    hv: {
      visited: count(visited, g),
      byProvince: byProvince(visited, prov, g),
      vulnerabilities,
      categories,
      avgScore: hvScores.length ? round(hvScores.reduce((a, b) => a + b, 0) / hvScores.length) : null,
    },
    fsc: { cases: count(cases, g), decisions, byProvince: byProvince(cases, prov, g) },
    declined: { total: count(declined, g), byProvince: declinedRows },
    klass: {
      total: count(klass, g),
      byProvince: classProvinces,
      provinces: classProvinces.filter((p) => p.province !== "Not recorded").length,
      districts: new Set(klass.map((s) => `${s.province}|${s.district_name?.trim().toLowerCase()}`).filter((d) => !d.endsWith("|undefined") && !d.endsWith("|"))).size,
      schools: new Set(klass.map((s) => s.school_id).filter(Boolean)).size,
      fromNgo: klass.filter((s) => s.from_ngo).length,
      ages: bars(ages, ageOrder),
      childRank: bars(rank, ["Eldest", "Middle", "Youngest", "Only child"]),
      household: {
        avg: household.length ? round(household.reduce((a, b) => a + b, 0) / household.length) : null,
        max: household.length ? Math.max(...household) : null,
        withData: household.length,
      },
      income,
      fatherJobs: bars(tally(klass, (s) => occ(s.father_occupation_band))),
      motherJobs: bars(tally(klass, (s) => occ(s.mother_occupation_band))),
      parents,
      disability: klass.filter((s) => s.vulnerability_disability).length,
    },
    funnel,
    timeline,
    staff,
    budget: { rows: budgetRows, columns, totals, grand },
    reviews: Object.fromEntries(STAGES.map((s) => [s.key, content.reviews?.[s.key] ?? {}])) as Record<StageKey, StageReview>,
  };
}

/** Lines of a multi-line text field, for bullet lists. */
export const lines = (s: string) => s.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
/** Paragraphs of a text field (blank line or single line breaks both split). */
export const paragraphs = (s: string) => s.split(/\n+/).map((l) => l.trim()).filter(Boolean);
