/**
 * Parsing for the two files the selection team uploads:
 *  - ZipGrade "Full Format (with student responses)" CSV export
 *  - the answer-key file (No. · Topic content · Correct answer · Score · Options)
 * plus the review step that runs in the browser before anything is saved.
 * Spreadsheet decoding (xlsx) happens in the caller; these take plain rows.
 */
import { acceptedAnswers, type ExamCandidate } from "@/features/written-exam/scoring";

export type ZipEntry = {
  /** 1-based row in the file, for messages. */
  row: number;
  examNumber: string;
  name: string;
  answers: string[];
  earned: number | null;
  possible: number | null;
  keyVersion: string | null;
  recognised: boolean;
};

export type ZipFile = {
  questionCount: number;
  /** Key from the PriKey columns (first row), or null if missing. */
  key: string[] | null;
  keyConsistent: boolean;
  entries: ZipEntry[];
};

const cell = (v: unknown) => (v == null ? "" : String(v).trim());

export function parseZipGrade(rows: Record<string, unknown>[]): ZipFile {
  if (!rows.length) throw new Error("The file is empty.");
  const header = Object.keys(rows[0]);
  const stuCols = header.filter((h) => /^Stu\d+$/.test(h)).map((h) => Number(h.slice(3)));
  if (!header.includes("StudentID") || stuCols.length === 0) {
    throw new Error('This doesn\'t look like a ZipGrade "Full Format (with student responses)" export: it needs the StudentID and Stu1, Stu2… columns.');
  }
  const questionCount = Math.max(...stuCols);
  const hasKey = header.includes("PriKey1");
  const key = hasKey ? Array.from({ length: questionCount }, (_, i) => cell(rows[0][`PriKey${i + 1}`]).toUpperCase()) : null;
  const keyConsistent =
    !hasKey ||
    rows.every((r) => Array.from({ length: questionCount }, (_, i) => cell(r[`PriKey${i + 1}`]).toUpperCase()).join() === key!.join());

  const entries = rows.map((r, i) => ({
    row: typeof r.__row === "number" ? r.__row : i + 2,
    examNumber: cell(r.StudentID).replace(/\.0+$/, ""),
    name: [cell(r.FirstName), cell(r.LastName)].filter(Boolean).join(" ").replace(/^,\s*/, ""),
    answers: Array.from({ length: questionCount }, (_, q) => cell(r[`Stu${q + 1}`]).toUpperCase()),
    earned: cell(r["Earned Points"]) === "" ? null : Number(r["Earned Points"]),
    possible: cell(r["Possible Points"]) === "" ? null : Number(r["Possible Points"]),
    keyVersion: cell(r["Key Version"]) || null,
    // Trimmed exports have no CustomID column: we can't tell, so don't flag anyone.
    recognised: "CustomID" in r ? cell(r.CustomID) !== "" : true,
  }));
  return { questionCount, key, keyConsistent, entries };
}

/**
 * Turns one spreadsheet sheet into ZipGrade rows. Accepts the full export and
 * trimmed versions of it (e.g. a macro that keeps only ID, Score and answers):
 *  - title rows above the header are skipped (the header is the row with "Stu1")
 *  - the ID column may be "StudentID", "ID", "Exam number"… or an unlabeled
 *    column of numbers
 *  - "Score" is read as Earned Points when there's no Earned Points column
 * Names, PriKey and Key Version columns are optional; without PriKey the
 * paper's key in the app is used.
 */
export function zipRowsFromMatrix(matrix: unknown[][]): Record<string, unknown>[] {
  const hi = matrix.findIndex((r) => r.some((c) => cell(c).toLowerCase() === "stu1"));
  if (hi < 0) return [];
  const header = matrix[hi].map(cell);
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");
  const data = matrix.slice(hi + 1);
  const rename = (from: (h: string) => boolean, to: string) => {
    if (header.includes(to)) return;
    const i = header.findIndex((h) => h && from(norm(h)));
    if (i >= 0) header[i] = to;
  };
  rename((h) => ["id", "idnumber", "examnumber", "examno", "zipgradeid", "studentnumber"].includes(h), "StudentID");
  rename((h) => ["score", "earned", "points", "earnedpoints"].includes(h), "Earned Points");
  rename((h) => ["possible", "possiblepoints", "outof", "max"].includes(h), "Possible Points");
  if (!header.includes("StudentID")) {
    // An unlabeled column that holds numbers in most rows is the ID.
    const i = header.findIndex((h, col) => {
      if (h) return false;
      const vals = data.map((r) => cell(r[col])).filter(Boolean);
      return vals.length > 0 && vals.filter((v) => /^\d+(\.0+)?$/.test(v)).length >= vals.length * 0.8;
    });
    if (i >= 0) header[i] = "StudentID";
  }
  const out: Record<string, unknown>[] = [];
  data.forEach((r, i) => {
    if (!r.some((c) => cell(c) !== "")) return;
    const o: Record<string, unknown> = { __row: hi + i + 2 };
    header.forEach((h, col) => h && (o[h] = r[col] ?? ""));
    out.push(o);
  });
  return out;
}

/** Picks the sheet whose name matches a paper ("english" → "English", "math" → "Math & Logic"). */
export function guessSheet(sheetNames: string[], paperName: string): number {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const p = n(paperName);
  const i = sheetNames.findIndex((s) => {
    const x = n(s);
    return x.length >= 3 && (p.includes(x) || x.includes(p) || x.slice(0, 4) === p.slice(0, 4));
  });
  return i >= 0 ? i : 0;
}

export type KeyRow = { number: number; answer: string; points: number; options: number; topic: string | null };

/** Answer-key file: finds the header row with "Correct answer", reads every numbered row under it. */
export function parseKeyFile(rows: unknown[][]): KeyRow[] {
  const norm = (v: unknown) => cell(v).toLowerCase().replace(/[^a-z]/g, "");
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === "correctanswer"));
  if (headerIdx < 0) throw new Error('Couldn\'t find a "Correct answer" column. Expected columns: No., Topic content, Correct answer, Score, Options.');
  const h = rows[headerIdx].map(norm);
  const col = (...names: string[]) => h.findIndex((c) => names.includes(c));
  const cNo = col("no", "number", "question", "q");
  const cAns = col("correctanswer");
  const cScore = col("score", "points", "point");
  const cOpt = col("options", "option");
  const cTopic = col("topiccontent", "topic");
  const out: KeyRow[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const n = Number(cell(r[cNo >= 0 ? cNo : 0]));
    const answer = acceptedAnswers(cell(r[cAns])).join(",");
    if (!Number.isInteger(n) || n < 1 || !answer) continue;
    if (!/^[A-J](,[A-J])*$/.test(answer)) throw new Error(`Question ${n}: "${cell(r[cAns])}" is not a valid answer (use letters like B or A,B).`);
    out.push({
      number: n,
      answer,
      points: cScore >= 0 && cell(r[cScore]) !== "" ? Number(r[cScore]) : 1,
      options: cOpt >= 0 && cell(r[cOpt]) !== "" ? Number(r[cOpt]) : 4,
      topic: cTopic >= 0 ? cell(r[cTopic]) || null : null,
    });
  }
  if (!out.length) throw new Error("No questions found under the header row.");
  if (new Set(out.map((q) => q.number)).size !== out.length) throw new Error("A question number appears more than once.");
  return out.sort((a, b) => a.number - b.number);
}

export type VersionKey = { answers: string[]; questionMap: number[] };

/**
 * A key file for another version of the paper: the same columns as the main
 * key (No., Correct answer) plus "Main No." — the main paper's question number
 * for each question on this version. Without that column the order is assumed
 * to be the same as the main paper (only the answer letters differ).
 */
export function parseVersionKeyFile(rows: unknown[][], mainNumbers: number[]): VersionKey {
  const norm = (v: unknown) => cell(v).toLowerCase().replace(/[^a-z]/g, "");
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === "correctanswer"));
  if (headerIdx < 0) throw new Error('Couldn\'t find a "Correct answer" column. Expected columns: No., Correct answer, Main No.');
  const h = rows[headerIdx].map(norm);
  const col = (...names: string[]) => h.findIndex((c) => names.includes(c));
  const cMain = col("mainno", "mainnumber", "mainquestion", "primaryno", "originalno", "original", "main");
  const cNo = h.findIndex((c, i) => i !== cMain && ["no", "number", "question", "q"].includes(c));
  const cAns = col("correctanswer");
  const items: { n: number; answer: string; main: number }[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const n = Number(cell(r[cNo >= 0 ? cNo : 0]));
    const answer = acceptedAnswers(cell(r[cAns])).join(",");
    if (!Number.isInteger(n) || n < 1 || !answer) continue;
    if (!/^[A-J](,[A-J])*$/.test(answer)) throw new Error(`Question ${n}: "${cell(r[cAns])}" is not a valid answer (use letters like B or A,B).`);
    const main = cMain >= 0 ? Number(cell(r[cMain])) : n;
    if (!Number.isInteger(main) || main < 1) throw new Error(`Question ${n}: the Main No. "${cell(r[cMain])}" isn't a question number.`);
    items.push({ n, answer, main });
  }
  if (!items.length) throw new Error("No questions found under the header row.");
  items.sort((a, b) => a.n - b.n);
  if (items.some((it, i) => it.n !== i + 1)) throw new Error("Question numbers must run 1, 2, 3… without gaps.");
  const mains = items.map((it) => it.main);
  const dup = mains.find((m, i) => mains.indexOf(m) !== i);
  if (dup) throw new Error(`Main question ${dup} appears twice in the Main No. column.`);
  const known = new Set(mainNumbers);
  const unknown = mains.filter((m) => !known.has(m));
  if (unknown.length) throw new Error(`Main question ${unknown.slice(0, 5).join(", ")} isn't in the main key.`);
  return { answers: items.map((it) => it.answer), questionMap: mains };
}

const normName = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-zក-៿]/g, "");

export type DuplicateGroup = { examNumber: string; entries: ZipEntry[] };

export type Review = {
  /** Usable as-is (valid number, single sheet). */
  ready: ZipEntry[];
  /** Same number, identical answers: one is kept automatically. */
  exactDuplicates: DuplicateGroup[];
  /** Same number, different answers: someone must choose. */
  conflicts: DuplicateGroup[];
  /** Number missing, "0" or not a number. */
  invalid: ZipEntry[];
  /** Number already belongs to a candidate with a different name. */
  nameMismatches: { entry: ZipEntry; existingName: string }[];
  doubleBubbles: number;
  notRecognised: number;
  expectedLength: number;
};

/**
 * Exam numbers are compared by value, not by spelling: Excel turns "0001"
 * into 1, so "1", "01" and "0001" are the same candidate.
 */
export function canonicalNumber(n: string) {
  const t = n.trim();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, "") : t;
}

export function reviewEntries(entries: ZipEntry[], existing: ExamCandidate[]): Review {
  const lengths = new Map<number, number>();
  for (const e of entries) if (/^\d+$/.test(e.examNumber)) lengths.set(e.examNumber.length, (lengths.get(e.examNumber.length) ?? 0) + 1);
  const expectedLength = [...lengths.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 4;
  // Spell each number the way the candidate already exists ("1" in the file → "0001" in the app).
  const existingByValue = new Map(existing.map((c) => [canonicalNumber(c.exam_number), c.exam_number]));

  const invalid: ZipEntry[] = [];
  const byNumber = new Map<string, ZipEntry[]>();
  for (const raw of entries) {
    // Any length is fine; only empty, non-numeric or zero numbers are unusable.
    const ok = /^\d+$/.test(raw.examNumber) && Number(raw.examNumber) > 0;
    if (!ok) {
      invalid.push(raw);
      continue;
    }
    const key = canonicalNumber(raw.examNumber);
    const e = { ...raw, examNumber: existingByValue.get(key) ?? raw.examNumber };
    byNumber.set(key, [...(byNumber.get(key) ?? []), e]);
  }

  const ready: ZipEntry[] = [];
  const exactDuplicates: DuplicateGroup[] = [];
  const conflicts: DuplicateGroup[] = [];
  for (const list of byNumber.values()) {
    const examNumber = list[0].examNumber;
    if (list.length === 1) ready.push(list[0]);
    else if (new Set(list.map((e) => e.answers.join(","))).size === 1) {
      exactDuplicates.push({ examNumber, entries: list });
      ready.push(list[0]);
    } else conflicts.push({ examNumber, entries: list });
  }

  const nameByNumber = new Map(existing.map((c) => [c.exam_number, c.full_name ?? ""]));
  const nameMismatches = ready
    .filter((e) => {
      const existingName = nameByNumber.get(e.examNumber);
      return existingName && e.name && normName(existingName) !== normName(e.name);
    })
    .map((e) => ({ entry: e, existingName: nameByNumber.get(e.examNumber)! }));

  return {
    ready,
    exactDuplicates,
    conflicts,
    invalid,
    nameMismatches,
    doubleBubbles: entries.reduce((n, e) => n + e.answers.filter((a) => a.length > 1).length, 0),
    notRecognised: entries.filter((e) => !e.recognised).length,
    expectedLength,
  };
}
