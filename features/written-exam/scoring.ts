/**
 * Written-exam scoring (migration 0052). Scores are always calculated from
 * the raw answers on each scanned sheet and the paper's *current* key, so
 * correcting or cancelling a question, or changing a pass mark, updates
 * every result at once. Nothing here talks to the network.
 */

export type ExamQuestion = {
  id: string;
  number: number;
  /** One or more accepted letters: "B" or "A,B". */
  answer: string;
  points: number | string;
  options: number;
  topic: string | null;
  cancelled: boolean;
};

export type ExamSubject = {
  id: string;
  paper_id: string;
  name: string;
  from_question: number;
  to_question: number;
  sort_order: number;
};

export type ExamImport = {
  id: string;
  file_name: string | null;
  rows_in_file: number;
  sheets_saved: number;
  summary: Record<string, unknown>;
  created_at: string;
};

/**
 * Another version of the paper (ZipGrade "Key Version", e.g. shuffled "B").
 * answers[i] / question_map[i] describe question i+1 on *that version's* sheet:
 * its accepted letter(s) and the main question it corresponds to.
 */
export type ExamKeyVersion = {
  id: string;
  paper_id: string;
  version: string;
  answers: string[];
  question_map: number[];
};

export type ExamPaper = {
  id: string;
  cycle_id: string;
  name: string;
  sort_order: number;
  questions: ExamQuestion[];
  subjects: ExamSubject[];
  key_versions?: ExamKeyVersion[];
  last_import: ExamImport | null;
};

export type Gender = "male" | "female" | "lgbtqia+";

export type ExamCandidate = {
  id: string;
  exam_number: string;
  full_name: string | null;
  student_id: string | null;
  excluded: boolean;
  exclude_reason: string | null;
  gender: Gender | null;
  center_id: string | null;
  session_id: string | null;
  room_id: string | null;
  /** Own details, for candidates not linked to a student (migration 0055). */
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  high_school?: string | null;
  province?: string | null;
  ngo?: string | null;
  student: {
    id: string;
    name: string;
    code: string;
    status: string;
    gender: string;
    first_name?: string;
    last_name?: string;
    dob?: string | null;
    school?: string | null;
    province?: string | null;
    ngo?: string | null;
  } | null;
};

export type CandidateDetails = {
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: string | null;
  highSchool: string | null;
  province: string | null;
  ngo: string | null;
};

/**
 * What to print for a candidate: the linked student's record first, then the
 * candidate's own imported details, then the full name split at the first
 * space (first word = first name, the convention used when creating students).
 */
export function candidateDetails(c: ExamCandidate): CandidateDetails {
  const s = c.student;
  const [first, ...rest] = (c.full_name ?? "").trim().split(/\s+/);
  return {
    firstName: s?.first_name || c.first_name || first || "",
    lastName: s?.last_name || c.last_name || (c.first_name ? "" : rest.join(" ")),
    gender: candidateGender(c),
    dob: (s?.dob || c.dob || null)?.slice(0, 10) ?? null,
    highSchool: s?.school || c.high_school || null,
    province: s?.province || c.province || null,
    ngo: s?.ngo || c.ngo || null,
  };
}

export type ExamRoom = { id: string; center_id: string; name: string; capacity: number | null; sort_order: number };
export type ExamSession = {
  id: string;
  center_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  label: string | null;
};
export type ExamCenter = {
  id: string;
  cycle_id: string;
  name: string;
  province_id: string | null;
  province_name: string | null;
  address: string | null;
  rooms: ExamRoom[];
  sessions: ExamSession[];
};

/** "Sat 14 May 2026, 07:00–10:00 (Morning)" */
export function sessionLabel(s: ExamSession) {
  const d = new Date(s.session_date + "T00:00:00");
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const t = s.start_time ? `, ${s.start_time.slice(0, 5)}${s.end_time ? "–" + s.end_time.slice(0, 5) : ""}` : "";
  return `${day}${t}${s.label ? ` (${s.label})` : ""}`;
}

/** Candidate gender, falling back to the linked student. */
export function candidateGender(c: ExamCandidate): string | null {
  return c.gender ?? c.student?.gender ?? null;
}

export type ExamSheet = {
  id: string;
  paper_id: string;
  candidate_id: string;
  answers: string[];
  name_on_sheet: string | null;
  zip_earned: number | string | null;
  zip_possible: number | string | null;
  key_version: string | null;
};

export type RuleUnit = "points" | "percent";

export type ExamRule = {
  id?: string;
  paper_id: string;
  /** null = the paper's total. */
  subject_id: string | null;
  min_value: number | string;
  unit: RuleUnit;
  /** An alternative to the rule before it ("… or …"). */
  or_previous?: boolean;
};

export type ExamData = {
  cycle: { id: string; name: string; year: number; exam_rules_locked: boolean };
  papers: ExamPaper[];
  candidates: ExamCandidate[];
  sheets: ExamSheet[];
  rules: ExamRule[];
  centers: ExamCenter[];
  overrides?: ExamScoreOverride[];
};

const num = (v: number | string | null | undefined) => (v == null || v === "" ? 0 : Number(v));

export function acceptedAnswers(answer: string): string[] {
  return answer
    .toUpperCase()
    .split(/[,/ ]+/)
    .map((a) => a.trim())
    .filter(Boolean);
}

/** A double-bubbled answer ("BD") or a blank is never correct. */
export function isCorrect(q: ExamQuestion, given: string | undefined) {
  if (q.cancelled || !given || given.length !== 1) return false;
  return acceptedAnswers(q.answer).includes(given.toUpperCase());
}

const inRange = (q: ExamQuestion, s: ExamSubject) => q.number >= s.from_question && q.number <= s.to_question;

export function paperMax(paper: ExamPaper) {
  return paper.questions.reduce((sum, q) => sum + (q.cancelled ? 0 : num(q.points)), 0);
}

export function subjectMax(paper: ExamPaper, subject: ExamSubject) {
  return paper.questions.reduce((sum, q) => sum + (!q.cancelled && inRange(q, subject) ? num(q.points) : 0), 0);
}

export type SheetScore = {
  total: number;
  max: number;
  subjects: Record<string, { score: number; max: number }>;
  /** Set when the total is a manual score (Results → edit) instead of the calculated one. */
  manual?: { reason: string; calculated: number | null };
};

/** A manual paper score for one candidate (migration 0056). */
export type ExamScoreOverride = { candidate_id: string; paper_id: string; score: number | string; reason: string; updated_at?: string };

/** The key version a sheet was answered on, or null for the main key. */
export function sheetVersion(paper: ExamPaper, sheet: Pick<ExamSheet, "key_version">): ExamKeyVersion | null {
  const v = sheet.key_version?.trim().toUpperCase();
  if (!v) return null;
  return paper.key_versions?.find((k) => k.version.toUpperCase() === v) ?? null;
}

/**
 * The paper as seen from one version: same questions (points, topics,
 * cancellations, subjects) but each accepted answer comes from the version
 * key. Pair with alignSheet so the answers are in main-question order.
 */
export function paperForVersion(paper: ExamPaper, kv: ExamKeyVersion): ExamPaper {
  const answerByMain = new Map<number, string>();
  kv.question_map.forEach((main, i) => answerByMain.set(main, kv.answers[i]));
  return {
    ...paper,
    // A main question missing from the version can't be answered correctly on that sheet.
    questions: paper.questions.map((q) => ({ ...q, answer: answerByMain.get(q.number) ?? "" })),
  };
}

/** Reorders a version sheet's answers into main-question order. */
export function alignSheet<T extends Pick<ExamSheet, "answers">>(sheet: T, kv: ExamKeyVersion): T {
  const answers: string[] = [];
  kv.question_map.forEach((main, i) => (answers[main - 1] = sheet.answers[i] ?? ""));
  return { ...sheet, answers: Array.from(answers, (a) => a ?? "") };
}

export function scoreSheet(paper: ExamPaper, sheet: ExamSheet): SheetScore {
  const kv = sheetVersion(paper, sheet);
  return kv ? scoreMain(paperForVersion(paper, kv), alignSheet(sheet, kv)) : scoreMain(paper, sheet);
}

function scoreMain(paper: ExamPaper, sheet: Pick<ExamSheet, "answers">): SheetScore {
  const subjects: SheetScore["subjects"] = {};
  for (const s of paper.subjects) subjects[s.id] = { score: 0, max: subjectMax(paper, s) };
  let total = 0;
  for (const q of paper.questions) {
    if (!isCorrect(q, sheet.answers[q.number - 1])) continue;
    const pts = num(q.points);
    total += pts;
    for (const s of paper.subjects) if (inRange(q, s)) subjects[s.id].score += pts;
  }
  return { total, max: paperMax(paper), subjects };
}

export type RuleOutcome = "pass" | "fail" | "missing";

/** The rule's target value, in points, for a given maximum. */
export function ruleThreshold(rule: ExamRule, max: number) {
  const v = num(rule.min_value);
  return rule.unit === "percent" ? (v / 100) * max : v;
}

export function ruleMax(rule: ExamRule, papers: ExamPaper[]) {
  const paper = papers.find((p) => p.id === rule.paper_id);
  if (!paper) return 0;
  const subject = rule.subject_id ? paper.subjects.find((s) => s.id === rule.subject_id) : null;
  return subject ? subjectMax(paper, subject) : paperMax(paper);
}

export function ruleLabel(rule: ExamRule, papers: ExamPaper[]) {
  const paper = papers.find((p) => p.id === rule.paper_id);
  const subject = rule.subject_id ? paper?.subjects.find((s) => s.id === rule.subject_id) : null;
  const target = subject ? `${paper?.name ?? "?"} · ${subject.name}` : (paper?.name ?? "Deleted paper");
  const max = ruleMax(rule, papers);
  const v = num(rule.min_value);
  return rule.unit === "percent"
    ? `${target} ≥ ${v}% (${round(ruleThreshold(rule, max))} / ${round(max)})`
    : `${target} ≥ ${round(v)} / ${round(max)}`;
}

export const round = (n: number) => Math.round(n * 100) / 100;

/** Rule indexes grouped by "or": [[0], [1, 2], [3]]. Every group must pass; any one rule within a group is enough. */
export function ruleGroups(rules: Pick<ExamRule, "or_previous">[]): number[][] {
  const groups: number[][] = [];
  rules.forEach((r, i) => {
    if (i > 0 && r.or_previous && groups.length) groups[groups.length - 1].push(i);
    else groups.push([i]);
  });
  return groups;
}

/** "English ≥ 20 / 50 or Math & Logic ≥ 30 / 60" */
export function groupLabel(rules: ExamRule[], group: number[], papers: ExamPaper[]) {
  return group.map((i) => ruleLabel(rules[i], papers)).join(" or ");
}

export type CandidateResult = {
  candidate: ExamCandidate;
  scores: Record<string, SheetScore | undefined>;
  outcomes: RuleOutcome[];
  /** Passed every rule (ignores exclusion). */
  meetsRules: boolean;
  /** Index of the first rule of the first group not passed, or null. */
  stoppedAt: number | null;
  /** Index (in ruleGroups) of the first group not passed, or null. */
  stoppedGroup: number | null;
  /** meetsRules and not excluded. */
  passed: boolean;
};

export function evaluate(
  data: Pick<ExamData, "papers" | "candidates" | "sheets" | "overrides">,
  rules: ExamRule[],
): CandidateResult[] {
  const sheetsByCandidate = new Map<string, ExamSheet[]>();
  for (const sh of data.sheets) {
    const list = sheetsByCandidate.get(sh.candidate_id) ?? [];
    list.push(sh);
    sheetsByCandidate.set(sh.candidate_id, list);
  }
  const overridesByCandidate = new Map<string, ExamScoreOverride[]>();
  for (const o of data.overrides ?? []) overridesByCandidate.set(o.candidate_id, [...(overridesByCandidate.get(o.candidate_id) ?? []), o]);
  const paperById = new Map(data.papers.map((p) => [p.id, p]));
  const groups = ruleGroups(rules);

  return data.candidates.map((candidate) => {
    const scores: CandidateResult["scores"] = {};
    for (const sh of sheetsByCandidate.get(candidate.id) ?? []) {
      const paper = paperById.get(sh.paper_id);
      if (paper) scores[paper.id] = scoreSheet(paper, sh);
    }
    // A manual score replaces the paper total (subject scores stay as calculated, if there's a sheet).
    for (const o of overridesByCandidate.get(candidate.id) ?? []) {
      const paper = paperById.get(o.paper_id);
      if (!paper) continue;
      const calc = scores[paper.id];
      scores[paper.id] = {
        total: num(o.score),
        max: calc?.max ?? paperMax(paper),
        subjects: calc?.subjects ?? {},
        manual: { reason: o.reason, calculated: calc ? calc.total : null },
      };
    }
    const outcomes: RuleOutcome[] = rules.map((rule) => {
      const sc = scores[rule.paper_id];
      if (!sc) return "missing";
      const value = rule.subject_id ? sc.subjects[rule.subject_id]?.score : sc.total;
      const max = rule.subject_id ? sc.subjects[rule.subject_id]?.max : sc.max;
      if (value == null || max == null) return "fail";
      return value + 1e-9 >= ruleThreshold(rule, max) ? "pass" : "fail";
    });
    const failedGroup = groups.findIndex((g) => !g.some((i) => outcomes[i] === "pass"));
    const meetsRules = rules.length > 0 && failedGroup === -1;
    return {
      candidate,
      scores,
      outcomes,
      meetsRules,
      stoppedAt: failedGroup === -1 ? null : groups[failedGroup][0],
      stoppedGroup: failedGroup === -1 ? null : failedGroup,
      passed: meetsRules && !candidate.excluded,
    };
  });
}

export type FunnelStep = { rule: ExamRule; label: string; passAlone: number; remaining: number };

/**
 * Rules applied in order: how many pass each rule alone, and how many are
 * still in after it (every earlier group passed, plus this rule or an earlier
 * alternative in its own "or" group).
 */
export function funnel(results: CandidateResult[], rules: ExamRule[], papers: ExamPaper[]): FunnelStep[] {
  const groups = ruleGroups(rules);
  const groupOf = new Map<number, number>();
  groups.forEach((g, gi) => g.forEach((i) => groupOf.set(i, gi)));
  return rules.map((rule, i) => {
    const gi = groupOf.get(i)!;
    const soFar = groups[gi].filter((j) => j <= i);
    return {
      rule,
      label: ruleLabel(rule, papers),
      passAlone: results.filter((r) => r.outcomes[i] === "pass").length,
      remaining: results.filter(
        (r) => groups.slice(0, gi).every((g) => g.some((j) => r.outcomes[j] === "pass")) && soFar.some((j) => r.outcomes[j] === "pass"),
      ).length,
    };
  });
}

export const LETTERS = "ABCDEFGHIJ".split("");

export type QuestionStats = {
  question: ExamQuestion;
  subject: ExamSubject | null;
  total: number;
  correct: number;
  correctPct: number;
  counts: Record<string, number>;
  blank: number;
  multi: number;
  /** Most-chosen single letter. */
  topChoice: string | null;
  /**
   * Set when one wrong letter was chosen by ≥40% of candidates and at least
   * twice as often as the accepted answer — usually a key error or a very
   * common misconception; either way someone should look. Calibrated on the
   * 2026 papers: flags 8/60 Math & Logic questions (incl. the two real key
   * errors) and 0/50 English.
   */
  keyAlert: string | null;
  /** Under 10% answered correctly. */
  hard: boolean;
};

/**
 * Per-question analysis for spotting key errors and bad questions.
 * version = null analyses the sheets answered on the main key; a version
 * letter analyses that version's sheets against its own key (in main-question
 * order), because letters only mean something relative to one key.
 */
export function questionAnalysis(paper: ExamPaper, sheets: ExamSheet[], version: string | null = null): QuestionStats[] {
  const kv = version ? (paper.key_versions?.find((k) => k.version === version) ?? null) : null;
  const ofPaper = sheets.filter((s) => s.paper_id === paper.id);
  const mine = kv
    ? ofPaper.filter((s) => sheetVersion(paper, s)?.version === kv.version).map((s) => alignSheet(s, kv))
    : ofPaper.filter((s) => !sheetVersion(paper, s));
  if (kv) paper = paperForVersion(paper, kv);
  return paper.questions.map((q) => {
    const counts: Record<string, number> = {};
    for (const l of LETTERS.slice(0, Math.max(q.options, 4))) counts[l] = 0;
    let blank = 0;
    let multi = 0;
    let correct = 0;
    for (const sh of mine) {
      const a = (sh.answers[q.number - 1] ?? "").toUpperCase();
      if (!a) blank++;
      else if (a.length > 1) multi++;
      else counts[a] = (counts[a] ?? 0) + 1;
      if (isCorrect(q, a)) correct++;
    }
    const total = mine.length;
    const accepted = acceptedAnswers(q.answer);
    const [topChoice] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const [topWrong, topWrongCount] =
      Object.entries(counts)
        .filter(([l]) => !accepted.includes(l))
        .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const keyAlert =
      !q.cancelled && total > 0 && topWrong && topWrongCount / total >= 0.4 && topWrongCount >= 2 * Math.max(correct, 1)
        ? `${Math.round((100 * topWrongCount) / total)}% chose ${topWrong}, only ${Math.round((100 * correct) / total)}% chose ${accepted.join(" or ")}`
        : null;
    return {
      question: q,
      subject: paper.subjects.find((s) => inRange(q, s)) ?? null,
      total,
      correct,
      correctPct: total ? correct / total : 0,
      counts,
      blank,
      multi,
      topChoice,
      keyAlert,
      hard: !q.cancelled && total > 0 && correct / total < 0.1,
    };
  });
}

export type TopicStats = {
  topic: string;
  questions: number;
  /** Points available on the topic (cancelled questions left out). */
  max: number;
  /** Average share of the topic's points earned, 0–1. */
  avgPct: number;
};

/**
 * Average result per topic (the key file's Topic column) over every sheet of
 * the paper, any version. Questions without a topic are grouped as "No topic".
 * Sorted weakest first.
 */
export function topicAnalysis(paper: ExamPaper, sheets: ExamSheet[]): TopicStats[] {
  const mine = sheets.filter((s) => s.paper_id === paper.id);
  const topics = new Map<string, ExamQuestion[]>();
  for (const q of paper.questions) {
    if (q.cancelled || num(q.points) <= 0) continue;
    const t = q.topic?.trim() || "No topic";
    topics.set(t, [...(topics.get(t) ?? []), q]);
  }
  const views = new Map<string, { byNumber: Map<number, ExamQuestion>; kv: ExamKeyVersion | null }>();
  const earned = new Map<string, number>();
  for (const sh of mine) {
    const kv = sheetVersion(paper, sh);
    const k = kv?.version ?? "";
    if (!views.has(k)) views.set(k, { byNumber: new Map((kv ? paperForVersion(paper, kv) : paper).questions.map((q) => [q.number, q])), kv });
    const view = views.get(k)!;
    const answers = view.kv ? alignSheet(sh, view.kv).answers : sh.answers;
    for (const [t, qs] of topics)
      for (const q of qs) if (isCorrect(view.byNumber.get(q.number)!, answers[q.number - 1])) earned.set(t, (earned.get(t) ?? 0) + num(q.points));
  }
  return [...topics.entries()]
    .map(([topic, qs]) => {
      const max = qs.reduce((n, q) => n + num(q.points), 0);
      return { topic, questions: qs.length, max, avgPct: mine.length && max ? (earned.get(topic) ?? 0) / (max * mine.length) : 0 };
    })
    .sort((a, b) => a.avgPct - b.avgPct);
}
