"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { acceptedAnswers, type ExamData } from "@/features/written-exam/scoring";
import { guessSheet, parseZipGrade, reviewEntries, zipRowsFromMatrix, type ZipEntry, type ZipFile } from "@/features/written-exam/zipgrade";
import { importSheets } from "@/services/writtenExamService";
import { readSpreadsheet } from "@/components/exams/readSpreadsheet";
import { cn } from "@/lib/utils";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type KeyCheck = { kind: "blocking" | "info"; message: string } | { kind: "diffs"; diffs: string[] };
type Sheet = { name: string; matrix: unknown[][] };

export function ImportTab({ data, canEdit, reload }: TabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paperId, setPaperId] = useState(data.papers[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [zip, setZip] = useState<ZipFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Conflicting duplicates: exam number → chosen file row, or 0 = skip. */
  const [choice, setChoice] = useState<Record<string, number>>({});
  /** Invalid numbers: file row → corrected number ("" = skip). */
  const [fixes, setFixes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  /** Sheets of the chosen workbook that contain answers (one per paper is common). */
  const [book, setBook] = useState<Sheet[] | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);

  const paper = data.papers.find((p) => p.id === paperId) ?? null;
  const existingSheets = data.sheets.filter((s) => s.paper_id === paperId).length;
  const [replaceAll, setReplaceAll] = useState(false);
  const review = useMemo(() => (zip ? reviewEntries(zip.entries, data.candidates) : null), [zip, data.candidates]);

  function reset() {
    setZip(null);
    setBook(null);
    setSheetIdx(0);
    setFileName(null);
    setError(null);
    setChoice({});
    setFixes({});
    if (fileRef.current) fileRef.current.value = "";
  }

  /** Parses one sheet of the loaded workbook into the review. */
  function loadSheet(sheets: Sheet[], i: number) {
    setSheetIdx(i);
    setChoice({});
    setFixes({});
    setError(null);
    try {
      setZip(parseZipGrade(zipRowsFromMatrix(sheets[i].matrix)));
    } catch (e) {
      setZip(null);
      setError(e instanceof Error ? e.message : "Couldn't read that sheet");
    }
  }

  async function onFile(file: File) {
    reset();
    setFileName(file.name);
    try {
      const { sheets } = await readSpreadsheet(file);
      // Only sheets that contain answers (a "Stu1" column) are offered.
      const usable = sheets.filter((s) => zipRowsFromMatrix(s.matrix).length > 0);
      if (!usable.length) {
        throw new Error(
          'No answers found. The file needs a header row with Stu1, Stu2… columns and an ID column (ZipGrade "Full Format (with student responses)", or a trimmed copy of it).',
        );
      }
      setBook(usable);
      loadSheet(usable, paper ? guessSheet(usable.map((s) => s.name), paper.name) : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    }
  }

  // ---- key check -----------------------------------------------------------
  const keyCheck = useMemo((): KeyCheck | null => {
    if (!zip || !paper) return null;
    if (paper.questions.length === 0) {
      if (!zip.key) return { kind: "blocking", message: "This paper has no answer key, and the file has no PriKey columns. Upload the key on Papers & keys first." };
      return { kind: "info", message: `This paper has no answer key yet. The key will be taken from this file: ${zip.questionCount} questions, 1 point each.` };
    }
    if (zip.questionCount !== paper.questions.length) {
      return { kind: "blocking", message: `The file has ${zip.questionCount} questions but “${paper.name}” has ${paper.questions.length}. Pick the right paper or fix the key.` };
    }
    const diffs = zip.key
      ? paper.questions
          .filter((q) => zip.key![q.number - 1] && !acceptedAnswers(q.answer).includes(zip.key![q.number - 1]))
          .map((q) => `Q${q.number}: app ${q.answer.replace(",", " or ")}, file ${zip.key![q.number - 1]}`)
      : [];
    return { kind: "diffs", diffs };
  }, [zip, paper]);

  // ---- final list ------------------------------------------------------------
  const final = useMemo(() => {
    if (!review) return { sheets: [] as ZipEntry[], problem: null as string | null };
    const out = [...review.ready];
    for (const g of review.conflicts) {
      const row = choice[g.examNumber];
      const pick = g.entries.find((e) => e.row === row);
      if (pick) out.push(pick);
    }
    for (const e of review.invalid) {
      const n = (fixes[e.row] ?? "").trim();
      if (n) out.push({ ...e, examNumber: n });
    }
    const badFix = review.invalid.find((e) => {
      const n = (fixes[e.row] ?? "").trim();
      return n && (!/^\d+$/.test(n) || n.length !== review.expectedLength || Number(n) === 0);
    });
    if (badFix) return { sheets: out, problem: `Row ${badFix.row}: exam numbers have ${review.expectedLength} digits.` };
    const seen = new Map<string, number>();
    for (const e of out) {
      if (seen.has(e.examNumber)) return { sheets: out, problem: `Exam number ${e.examNumber} is used twice (rows ${seen.get(e.examNumber)} and ${e.row}).` };
      seen.set(e.examNumber, e.row);
    }
    return { sheets: out, problem: null };
  }, [review, choice, fixes]);

  // A hint for invalid numbers: gaps in the file's own run of numbers (e.g. 1728–1749 without 1737).
  const gaps = useMemo(() => {
    if (!review?.invalid.length) return [];
    const nums = [...review.ready, ...review.exactDuplicates.map((g) => g.entries[0]), ...review.conflicts.map((g) => g.entries[0])]
      .map((e) => Number(e.examNumber))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    if (nums.length < 2) return [];
    const have = new Set(nums);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (max - min > 5000) return [];
    const out: string[] = [];
    for (let n = min; n <= max && out.length <= 10; n++) if (!have.has(n)) out.push(String(n).padStart(review.expectedLength, "0"));
    return out.length <= 10 ? out : [];
  }, [review]);

  // Exam numbers in this file that already have a sheet for this paper.
  const overlap = useMemo(() => {
    const withSheet = new Set(data.sheets.filter((s) => s.paper_id === paperId).map((s) => s.candidate_id));
    const numbers = new Set(data.candidates.filter((c) => withSheet.has(c.id)).map((c) => c.exam_number));
    return final.sheets.filter((e) => numbers.has(e.examNumber)).length;
  }, [data.sheets, data.candidates, paperId, final.sheets]);

  const unresolved = review ? review.conflicts.filter((g) => choice[g.examNumber] === undefined).length : 0;
  const blocking = keyCheck?.kind === "blocking" ? keyCheck.message : null;
  const canImport = canEdit && !!paper && !!zip && !blocking && unresolved === 0 && !final.problem && final.sheets.length > 0;

  async function doImport() {
    if (!paper || !zip || !review) return;
    setBusy(true);
    try {
      const res = await importSheets(paper.id, {
        fileName: fileName ? (book && book.length > 1 ? `${fileName} (${book[sheetIdx]?.name})` : fileName) : undefined,
        rowsInFile: zip.entries.length,
        summary: {
          exactDuplicates: review.exactDuplicates.map((g) => g.examNumber),
          conflicts: Object.fromEntries(review.conflicts.map((g) => [g.examNumber, choice[g.examNumber] || null])),
          invalidFixed: review.invalid.filter((e) => fixes[e.row]?.trim()).map((e) => ({ row: e.row, from: e.examNumber, to: fixes[e.row].trim() })),
          invalidSkipped: review.invalid.filter((e) => !fixes[e.row]?.trim()).map((e) => e.row),
          nameMismatches: review.nameMismatches.length,
          doubleBubbles: review.doubleBubbles,
          notRecognised: review.notRecognised,
        },
        mode: replaceAll ? "replace" : "merge",
        keyFromFile: paper.questions.length === 0 && zip.key ? zip.key.map((answer, i) => ({ number: i + 1, answer })) : undefined,
        sheets: final.sheets.map((e) => ({
          examNumber: e.examNumber,
          name: e.name || undefined,
          answers: e.answers,
          zipEarned: e.earned,
          zipPossible: e.possible,
          keyVersion: e.keyVersion,
        })),
      });
      toast.success(
        `Imported ${res.saved} sheets into “${paper.name}” · ${res.total} in total${res.keyCreated ? " (answer key taken from the file)" : ""}`,
      );
      setReplaceAll(false);
      reset();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (data.papers.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Add a paper on Papers &amp; keys first.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Import a ZipGrade export</CardTitle>
          <CardDescription>
            In ZipGrade, open the quiz and choose CSV → <strong>Full Format (with student responses)</strong>. A trimmed Excel copy works
            too (ID, Score and Stu1, Stu2… columns), including one workbook with a sheet per paper. Nothing is saved until you confirm below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={paperId}
            onValueChange={(v) => {
              setPaperId(v ?? "");
              // Workbook with a sheet per paper: follow the paper.
              const next = data.papers.find((p) => p.id === v);
              if (book && book.length > 1 && next) loadSheet(book, guessSheet(book.map((s) => s.name), next.name));
            }}
          >
            <SelectTrigger className="w-full sm:w-64" aria-label="Paper">
              <SelectValue>{(v: string) => data.papers.find((p) => p.id === v)?.name ?? "Choose a paper"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {data.papers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            id="zipgrade-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
            <FileUp /> {fileName ? "Choose another file" : "Choose file"}
          </Button>
          {book && book.length > 1 && (
            <Select value={String(sheetIdx)} onValueChange={(v) => v != null && loadSheet(book, Number(v))}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Sheet">
                <SelectValue>{(v: string) => `Sheet: ${book[Number(v)]?.name ?? ""}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {book.map((s, i) => (
                  <SelectItem key={s.name} value={String(i)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {fileName && <span className="truncate text-sm text-muted-foreground">{fileName}</span>}
        </CardContent>
      </Card>

      {error && <Notice tone="bad">{error}</Notice>}

      {zip && review && paper && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Rows in file" value={zip.entries.length} />
            <Stat label="Ready" value={review.ready.length} tone="good" />
            <Stat label="Scanned twice (kept once)" value={review.exactDuplicates.length} />
            <Stat label="Conflicts to resolve" value={review.conflicts.length} tone={review.conflicts.length ? "warn" : undefined} />
            <Stat label="Invalid numbers" value={review.invalid.length} tone={review.invalid.length ? "warn" : undefined} />
            <Stat label="Double bubbles (wrong)" value={review.doubleBubbles} />
          </div>

          {blocking && <Notice tone="bad">{blocking}</Notice>}
          {keyCheck?.kind === "info" && <Notice tone="info">{keyCheck.message}</Notice>}
          {keyCheck?.kind === "diffs" && keyCheck.diffs.length > 0 && (
            <Notice tone="warn">
              The file&apos;s answer key differs from the app&apos;s on {keyCheck.diffs.length} question{keyCheck.diffs.length === 1 ? "" : "s"}:{" "}
              {keyCheck.diffs.join("; ")}. The app&apos;s key is used for scoring. That&apos;s expected if you corrected the key here.
            </Notice>
          )}
          {keyCheck?.kind === "diffs" && keyCheck.diffs.length === 0 && zip.key && (
            <Notice tone="good">The file&apos;s answer key matches the app&apos;s key.</Notice>
          )}
          {!zip.keyConsistent && <Notice tone="warn">The answer key differs between rows (several key versions?). Only one version is supported for now.</Notice>}

          {review.conflicts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Same exam number, different answers</CardTitle>
                <CardDescription>Probably two candidates bubbled the same number, or one sheet was scanned twice and read differently. Choose which paper counts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.conflicts.map((g) => (
                  <fieldset key={g.examNumber} className="space-y-1.5">
                    <legend className="text-sm font-medium">Exam number {g.examNumber}</legend>
                    {g.entries.map((e) => (
                      <label key={e.row} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`conflict-${g.examNumber}`}
                          checked={choice[g.examNumber] === e.row}
                          onChange={() => setChoice((c) => ({ ...c, [g.examNumber]: e.row }))}
                        />
                        Row {e.row} · {e.name || "no name"} · {e.earned ?? "?"} / {e.possible ?? "?"}
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="radio"
                        name={`conflict-${g.examNumber}`}
                        checked={choice[g.examNumber] === 0}
                        onChange={() => setChoice((c) => ({ ...c, [g.examNumber]: 0 }))}
                      />
                      Skip this number for now
                    </label>
                  </fieldset>
                ))}
              </CardContent>
            </Card>
          )}

          {review.invalid.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Missing or invalid exam numbers</CardTitle>
                <CardDescription>
                  These sheets have no usable number (exam numbers here have {review.expectedLength} digits). Type the right number to
                  include a sheet, or leave it empty to skip it.
                  {gaps.length > 0 && (
                    <>
                      {" "}
                      Numbers missing from this file&apos;s sequence: <strong className="tabular-nums">{gaps.join(", ")}</strong>.
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {review.invalid.map((e) => (
                  <div key={e.row} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-56 truncate">
                      Row {e.row} · {e.name || "no name"}
                    </span>
                    <span className="w-24 text-muted-foreground tabular-nums">
                      {e.earned == null ? "" : e.possible == null ? `score ${e.earned}` : `${e.earned} / ${e.possible}`}
                    </span>
                    <span className="text-muted-foreground">number on sheet: “{e.examNumber}”</span>
                    <Input
                      id={`fix-${e.row}`}
                      aria-label={`Exam number for row ${e.row}`}
                      inputMode="numeric"
                      placeholder="Skip"
                      value={fixes[e.row] ?? ""}
                      onChange={(ev) => setFixes((f) => ({ ...f, [e.row]: ev.target.value }))}
                      className="w-28"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {review.nameMismatches.length > 0 && (
            <Notice tone="warn">
              {review.nameMismatches.length} exam number{review.nameMismatches.length === 1 ? "" : "s"} already belong to a candidate with a
              different name: {review.nameMismatches.slice(0, 5).map((m) => `${m.entry.examNumber} (“${m.entry.name}” here, “${m.existingName}” before)`).join("; ")}
              {review.nameMismatches.length > 5 ? "…" : ""}. The sheets are imported for the existing candidate; check the numbers if that&apos;s wrong.
            </Notice>
          )}

          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">
                {final.sheets.length} sheet{final.sheets.length === 1 ? "" : "s"} will be imported into “{paper.name}”.
              </p>
              <p className="text-muted-foreground">
                {existingSheets === 0
                  ? "Candidates are created from the exam numbers; their names come from the sheets."
                  : replaceAll
                    ? `All ${existingSheets} sheets imported earlier for this paper are deleted first.`
                    : `Added to the ${existingSheets} sheets already imported (e.g. other exam centers)${overlap ? `; ${overlap} exam number${overlap === 1 ? " is" : "s are"} already there and will be replaced` : ""}.`}
              </p>
              {existingSheets > 0 && (
                <label className="mt-1.5 flex items-center gap-2 text-muted-foreground">
                  <Checkbox checked={replaceAll} onCheckedChange={(v) => setReplaceAll(v === true)} />
                  Replace all earlier sheets for this paper (full re-import)
                </label>
              )}
              {unresolved > 0 && <p className="text-amber-700">Resolve {unresolved} conflict{unresolved === 1 ? "" : "s"} above first.</p>}
              {final.problem && <p className="text-rose-600">{final.problem}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={doImport} disabled={!canImport || busy}>
                <Upload /> {busy ? "Importing…" : `Import ${final.sheets.length}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Notice({ tone, children }: { tone: "good" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  const Icon = tone === "good" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
        tone === "bad" && "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
