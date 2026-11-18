"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  PencilLine,
  RotateCcw,
  Save,
  Search,
  UserMinus,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveDataTable, type ResponsiveColumnMeta } from "@/components/tables/ResponsiveDataTable";
import {
  candidateGender,
  evaluate,
  paperMax,
  round,
  ruleGroups,
  ruleLabel,
  ruleMax,
  ruleThreshold,
  type CandidateResult,
  type ExamData,
  type ExamPaper,
  type ExamRule,
  type RuleUnit,
} from "@/features/written-exam/scoring";
import { saveRules, setScoreOverride, updateCandidate } from "@/services/writtenExamService";
import { NextSteps } from "@/components/exams/NextSteps";
import { ResultsPrint } from "@/components/exams/ResultsPrint";
import { exportResultsDocx, exportResultsXlsx, type ResultsExport, type ResultStatusLabel } from "@/components/exams/resultsExport";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const GENDER_LABEL: Record<string, string> = { female: "Female", male: "Male", "lgbtqia+": "LGBTQIA+" };
import { cn } from "@/lib/utils";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type Meta = ResponsiveColumnMeta<CandidateResult>;
type Filter = "all" | "passed" | "failed" | "absent" | "excluded";
type Sort = "number" | "name" | "result" | `paper:${string}`;
type Status = "passed" | "failed" | "absent" | "excluded" | "pending";
/** One pass mark being edited on this page (mirrors an exam rule). */
type Mark = { paperId: string; subjectId: string | null; min: string; unit: RuleUnit; orPrevious: boolean };

const PAGE = 50;
const ALL = "__all__";
const NONE = "__none__";

const STATUS: Record<Status, { label: string; icon: LucideIcon; cls: string }> = {
  passed: { label: "Pass", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  failed: { label: "Fail", icon: XCircle, cls: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  absent: { label: "Absent", icon: CircleSlash, cls: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" },
  excluded: { label: "Excluded", icon: UserMinus, cls: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" },
  pending: { label: "No pass marks", icon: CircleSlash, cls: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
};

const marksFrom = (data: ExamData): Mark[] =>
  data.rules.length
    ? data.rules.map((r, i) => ({ paperId: r.paper_id, subjectId: r.subject_id, min: String(Number(r.min_value)), unit: r.unit, orPrevious: i > 0 && !!r.or_previous }))
    : // No rules yet: one empty pass mark per paper, ready to fill in.
      [...data.papers].sort((a, b) => a.sort_order - b.sort_order).map((p) => ({ paperId: p.id, subjectId: null, min: "", unit: "points" as const, orPrevious: false }));

/**
 * Results of the written exam: every candidate with their exam center, score
 * per paper and final result. Pass marks can be adjusted here (results update
 * as you type), scores can be corrected by hand, and the list exported.
 */
export function ResultsTab({ data, canEdit, reload }: TabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [centerId, setCenterId] = useState(ALL);
  const [sort, setSort] = useState<Sort>("number");
  const [page, setPage] = useState(1);
  const [marks, setMarks] = useState<Mark[]>(() => marksFrom(data));
  const [savingMarks, setSavingMarks] = useState(false);
  const [editing, setEditing] = useState<CandidateResult | null>(null);
  const [excluding, setExcluding] = useState<CandidateResult | null>(null);
  const [reason, setReason] = useState("");
  const [exporting, setExporting] = useState(false);
  /** Set while the printable PDF report is open. */
  const [printing, setPrinting] = useState<ResultsExport | null>(null);

  const papers = useMemo(() => [...data.papers].sort((a, b) => a.sort_order - b.sort_order), [data.papers]);
  const paperById = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);

  // Rules as currently typed (unsaved marks preview the results live).
  const viewRules = useMemo<ExamRule[]>(
    () =>
      marks
        .filter((m) => m.min.trim() !== "" && Number.isFinite(Number(m.min)))
        .map((m, i) => ({ paper_id: m.paperId, subject_id: m.subjectId, min_value: Number(m.min), unit: m.unit, or_previous: i > 0 && m.orPrevious })),
    [marks],
  );
  const savedMarks = useMemo(() => JSON.stringify(marksFrom(data)), [data]);
  const marksDirty = JSON.stringify(marks) !== savedMarks;
  const markProblem = marks.find((m) => {
    if (m.min.trim() === "") return false;
    const v = Number(m.min);
    const max = ruleMax({ paper_id: m.paperId, subject_id: m.subjectId, min_value: 0, unit: "points" }, papers);
    return !Number.isFinite(v) || v < 0 || (m.unit === "percent" ? v > 100 : max > 0 && v > max);
  });

  const results = useMemo(() => evaluate(data, viewRules), [data, viewRules]);
  const groups = useMemo(() => ruleGroups(viewRules), [viewRules]);

  const statusOf = (r: CandidateResult): Status => {
    if (r.candidate.excluded) return "excluded";
    if (Object.keys(r.scores).length === 0) return "absent";
    if (!viewRules.length) return "pending";
    return r.passed ? "passed" : "failed";
  };

  /** Lowest whole-paper pass mark for a paper, in points (for colouring its score). */
  const markFor = (paper: ExamPaper) => {
    const ts = viewRules.filter((r) => r.paper_id === paper.id && !r.subject_id).map((r) => ruleThreshold(r, paperMax(paper)));
    return ts.length ? Math.min(...ts) : null;
  };

  /** Why a candidate didn't pass: "English 18 — needs 20". */
  const failReason = (r: CandidateResult) => {
    const g = groups[r.stoppedGroup ?? -1];
    if (!g) return "";
    return g
      .map((i) => {
        const rule = viewRules[i];
        const p = paperById.get(rule.paper_id);
        const sc = r.scores[rule.paper_id];
        const subject = rule.subject_id ? p?.subjects.find((s) => s.id === rule.subject_id) : null;
        const value = subject ? sc?.subjects[subject.id]?.score : sc?.total;
        const name = subject ? `${p?.name} · ${subject.name}` : (p?.name ?? "Paper");
        const need = round(ruleThreshold(rule, ruleMax(rule, papers)));
        return value == null ? `${name}: no paper` : `${name} ${round(value)} — needs ${need}`;
      })
      .join(" or ");
  };

  const centerById = useMemo(() => new Map(data.centers.map((c) => [c.id, c])), [data.centers]);
  const placeOf = (r: CandidateResult) => {
    const c = r.candidate.center_id ? centerById.get(r.candidate.center_id) : null;
    const room = c?.rooms.find((x) => x.id === r.candidate.room_id);
    return { center: c?.name ?? null, room: room?.name ?? null };
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: results.length, passed: 0, failed: 0, absent: 0, excluded: 0 };
    for (const r of results) {
      const s = statusOf(r);
      if (s === "passed" || s === "failed" || s === "absent" || s === "excluded") c[s]++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, viewRules]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = results.filter((r) => {
      if (filter !== "all" && statusOf(r) !== filter) return false;
      if (centerId === NONE && r.candidate.center_id) return false;
      if (centerId !== ALL && centerId !== NONE && r.candidate.center_id !== centerId) return false;
      if (!q) return true;
      return (
        r.candidate.exam_number.includes(q) ||
        (r.candidate.full_name ?? "").toLowerCase().includes(q) ||
        (r.candidate.student?.code ?? "").toLowerCase().includes(q)
      );
    });
    const rank: Record<Status, number> = { passed: 0, failed: 1, pending: 2, absent: 3, excluded: 4 };
    return list.sort((a, b) => {
      if (sort === "name") return (a.candidate.full_name ?? "").localeCompare(b.candidate.full_name ?? "");
      if (sort === "result") return rank[statusOf(a)] - rank[statusOf(b)] || a.candidate.exam_number.localeCompare(b.candidate.exam_number);
      if (sort.startsWith("paper:")) {
        const id = sort.slice(6);
        return (b.scores[id]?.total ?? -1) - (a.scores[id]?.total ?? -1);
      }
      return a.candidate.exam_number.localeCompare(b.candidate.exam_number, undefined, { numeric: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, filter, centerId, search, sort, viewRules]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE, current * PAGE);

  async function saveMarks() {
    setSavingMarks(true);
    try {
      const kept = marks.filter((m) => m.min.trim() !== "");
      await saveRules(
        data.cycle.id,
        kept.map((m, i) => ({ paperId: m.paperId, subjectId: m.subjectId, minValue: Number(m.min), unit: m.unit, orPrevious: i > 0 && m.orPrevious })),
      );
      toast.success("Pass marks saved");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save pass marks");
    } finally {
      setSavingMarks(false);
    }
  }

  const scoreCell = (r: CandidateResult, p: ExamPaper) => {
    const sc = r.scores[p.id];
    if (!sc) return <span className="text-muted-foreground">—</span>;
    const mark = markFor(p);
    const met = mark == null ? null : sc.total + 1e-9 >= mark;
    return (
      <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
        {sc.manual && (
          <span title={`Manual score${sc.manual.calculated != null ? ` (calculated ${round(sc.manual.calculated)})` : ""}: ${sc.manual.reason}`}>
            <PencilLine className="size-3.5 text-amber-600" aria-label="Manual score" />
          </span>
        )}
        <span className={cn("font-semibold tabular-nums", met === true && "text-emerald-700 dark:text-emerald-400", met === false && "text-rose-700 dark:text-rose-400")}>
          {round(sc.total)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">/ {round(sc.max)}</span>
        {met === true && <CheckCircle2 className="size-3.5 text-emerald-600" aria-label="Meets the pass mark" />}
        {met === false && <XCircle className="size-3.5 text-rose-600" aria-label="Below the pass mark" />}
      </span>
    );
  };

  const columns = useMemo<ColumnDef<CandidateResult>[]>(() => {
    const cols: ColumnDef<CandidateResult>[] = [
      {
        id: "number",
        header: "ID",
        meta: { card: "hidden", className: "w-20" } satisfies Meta,
        cell: ({ row }) => <span className="font-mono text-sm tabular-nums">{row.original.candidate.exam_number}</span>,
      },
      {
        id: "name",
        header: "Name",
        meta: {
          card: "title",
          cardCell: (r) => (
            <div className="min-w-0">
              <p className="truncate font-medium">{r.candidate.full_name || r.candidate.student?.name || "No name"}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{r.candidate.exam_number}</span>
                {placeOf(r).center ? ` · ${placeOf(r).center}` : ""}
              </p>
            </div>
          ),
        } satisfies Meta,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="max-w-60 truncate font-medium">{row.original.candidate.full_name || row.original.candidate.student?.name || <span className="font-normal text-muted-foreground">No name</span>}</p>
            {row.original.candidate.student && <p className="text-xs text-muted-foreground">Student {row.original.candidate.student.code}</p>}
          </div>
        ),
      },
      {
        id: "center",
        header: "Exam center",
        meta: { card: "hidden" } satisfies Meta,
        cell: ({ row }) => {
          const p = placeOf(row.original);
          return p.center ? (
            <div className="min-w-0">
              <p className="max-w-44 truncate text-sm">{p.center}</p>
              {p.room && <p className="text-xs text-muted-foreground">{p.room}</p>}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Not assigned</span>
          );
        },
      },
      ...papers.map(
        (p): ColumnDef<CandidateResult> => ({
          id: `p-${p.id}`,
          header: () => <span className="block text-right">{p.name}</span>,
          meta: {
            card: "summary",
            className: "text-right",
            cardCell: (r) => (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">{p.name}</span> {scoreCell(r, p)}
              </span>
            ),
          } satisfies Meta,
          cell: ({ row }) => scoreCell(row.original, p),
        }),
      ),
      {
        id: "result",
        header: "Result",
        meta: { card: "summary" } satisfies Meta,
        cell: ({ row }) => {
          const r = row.original;
          const s = statusOf(r);
          const S = STATUS[s];
          const why = s === "failed" ? failReason(r) : s === "excluded" ? (r.candidate.exclude_reason ?? "") : "";
          return (
            <div className="min-w-0">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", S.cls)}>
                <S.icon className="size-3.5" /> {S.label}
              </span>
              {why && <p className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground" title={why}>{why}</p>}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { card: "actions", className: "w-px" } satisfies Meta,
        cell: ({ row }) => {
          if (!canEdit) return null;
          const c = row.original.candidate;
          return (
            <div className="flex justify-end gap-0.5">
              <Button variant="ghost" size="icon-sm" title="Edit scores" aria-label={`Edit scores for ${c.full_name ?? c.exam_number}`} onClick={() => setEditing(row.original)}>
                <PencilLine />
              </Button>
              {c.excluded ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Include again"
                  aria-label={`Include ${c.full_name ?? c.exam_number} again`}
                  onClick={async () => {
                    try {
                      await updateCandidate(c.id, { excluded: false });
                      toast.success("Included again");
                      await reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  <UserPlus />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Exclude from the process"
                  aria-label={`Exclude ${c.full_name ?? c.exam_number}`}
                  onClick={() => {
                    setExcluding(row.original);
                    setReason("");
                  }}
                >
                  <UserMinus />
                </Button>
              )}
            </div>
          );
        },
      },
    ];
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, canEdit, papers, viewRules]);

  /** Exactly what the table shows (all pages): filters, exam center, search, sort and pass marks. */
  function buildExport(): ResultsExport {
    const rowsOut = filtered.map((r, i) => {
      const place = placeOf(r);
      const s = statusOf(r);
      return {
        n: i + 1,
        id: r.candidate.exam_number,
        name: r.candidate.full_name || r.candidate.student?.name || "",
        gender: GENDER_LABEL[candidateGender(r.candidate) ?? ""] ?? "",
        center: place.center ?? "Not assigned",
        room: place.room ?? "",
        scores: papers.map((p) => (r.scores[p.id] ? round(r.scores[p.id]!.total) : null)),
        manual: papers.map((p) => !!r.scores[p.id]?.manual),
        result: STATUS[s].label as ResultStatusLabel,
        reason: s === "failed" ? failReason(r) : s === "excluded" ? (r.candidate.exclude_reason ?? "") : "",
      };
    });
    const shownPassed = rowsOut.filter((r) => r.result === "Pass");
    const shownMarked = rowsOut.filter((r) => r.result === "Pass" || r.result === "Fail").length;
    const genderCount = (g: string) => shownPassed.filter((r) => r.gender === g).length;
    const filterText = filter === "all" ? "All candidates" : (tiles.find((x) => x.key === filter)?.label ?? "");
    const centerText = centerId === ALL ? "all exam centers" : centerId === NONE ? "no exam center" : (centerById.get(centerId)?.name ?? "");
    const passMarks = viewRules.length
      ? groups.map((g) => g.map((i) => ruleLabel(viewRules[i], papers)).join(" or ")).join("  AND  ")
      : "Not set";
    const date = new Date();
    return {
      fileBase: `Exam results - ${data.cycle.name}${centerId !== ALL && centerId !== NONE ? ` - ${centerText}` : ""}${filter !== "all" ? ` - ${filterText}` : ""}`,
      cycleName: data.cycle.name,
      generated: date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
      scope: `${filterText} · ${centerText}${search.trim() ? ` · search “${search.trim()}”` : ""} · ${rowsOut.length} candidate${rowsOut.length === 1 ? "" : "s"}`,
      passMarks,
      summary: [
        { label: "Candidates", value: String(rowsOut.length) },
        { label: "Passed", value: String(shownPassed.length) },
        { label: "Not passed", value: String(rowsOut.filter((r) => r.result === "Fail").length) },
        { label: "Absent", value: String(rowsOut.filter((r) => r.result === "Absent").length) },
        { label: "Pass rate", value: shownMarked ? `${Math.round((100 * shownPassed.length) / shownMarked)}%` : "—" },
        { label: "Passed girls / boys", value: `${genderCount("Female")} / ${genderCount("Male")}` },
      ],
      papers: papers.map((p) => ({ name: p.name, max: round(paperMax(p)) })),
      rows: rowsOut,
    };
  }

  const closePrint = useCallback(() => setPrinting(null), []);

  async function runExport(kind: "xlsx" | "docx" | "pdf") {
    if (!filtered.length) return;
    const model = buildExport();
    if (kind === "pdf") return setPrinting(model);
    setExporting(true);
    try {
      if (kind === "xlsx") await exportResultsXlsx(model);
      else await exportResultsDocx(model);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const unnamed = results.filter((r) => !r.candidate.full_name?.trim() && !r.candidate.student).length;
  const passRate = counts.passed + counts.failed ? Math.round((100 * counts.passed) / (counts.passed + counts.failed)) : 0;
  const tiles: { key: Filter; label: string; value: number; sub: string; tone: string }[] = [
    { key: "all", label: "Candidates", value: counts.all, sub: `${counts.all - counts.absent - counts.excluded} sat the exam`, tone: "" },
    { key: "passed", label: "Passed", value: counts.passed, sub: viewRules.length ? `${passRate}% of those marked` : "Set pass marks", tone: "text-emerald-700 dark:text-emerald-400" },
    { key: "failed", label: "Not passed", value: counts.failed, sub: "Below a pass mark", tone: "text-rose-700 dark:text-rose-400" },
    { key: "absent", label: "Absent", value: counts.absent, sub: "No paper scored", tone: "" },
    { key: "excluded", label: "Excluded", value: counts.excluded, sub: "Removed by hand", tone: "" },
  ];

  return (
    <div className="space-y-4">
      {/* Key figures — also the result filter */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setFilter(t.key);
              setPage(1);
            }}
            aria-pressed={filter === t.key}
            className={cn(
              "rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition hover:border-primary/40",
              filter === t.key && "border-primary ring-1 ring-primary",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p className={cn("text-2xl font-semibold tabular-nums", t.tone)}>{t.value}</p>
            <p className="truncate text-xs text-muted-foreground">{t.sub}</p>
          </button>
        ))}
      </div>

      {/* Pass marks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pass marks</CardTitle>
          <CardDescription>
            A candidate passes when they reach every mark. Switch a link to <strong>or</strong> to accept either. The table updates as you type; save to keep
            it. Subject-level marks are on the Pass rules tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {papers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add papers first (Papers &amp; keys).</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {marks.map((m, i) => {
                const p = paperById.get(m.paperId);
                const subject = m.subjectId ? p?.subjects.find((s) => s.id === m.subjectId) : null;
                const max = ruleMax({ paper_id: m.paperId, subject_id: m.subjectId, min_value: 0, unit: "points" }, papers);
                return (
                  <div key={`${m.paperId}-${m.subjectId}-${i}`} className="flex items-center gap-2">
                    {i > 0 && (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setMarks((list) => list.map((x, j) => (j === i ? { ...x, orPrevious: !x.orPrevious } : x)))}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-semibold uppercase transition-colors disabled:cursor-default",
                          m.orPrevious ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                        title={m.orPrevious ? "Either mark is enough (click for AND)" : "Both marks needed (click for OR)"}
                      >
                        {m.orPrevious ? "or" : "and"}
                      </button>
                    )}
                    <label className="flex items-center gap-2 rounded-lg border bg-muted/30 py-1 pr-2 pl-3 text-sm">
                      <span className="font-medium">
                        {p?.name ?? "Paper"}
                        {subject ? ` · ${subject.name}` : ""}
                      </span>
                      <span className="text-muted-foreground">≥</span>
                      <Input
                        aria-label={`Pass mark for ${p?.name}`}
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        placeholder="—"
                        value={m.min}
                        disabled={!canEdit}
                        onChange={(e) => setMarks((list) => list.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))}
                        className="h-8 w-16 bg-background text-center font-semibold tabular-nums"
                      />
                      <span className="text-muted-foreground tabular-nums">{m.unit === "percent" ? "%" : `/ ${round(max)}`}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
          {canEdit && marksDirty && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={saveMarks} disabled={savingMarks || !!markProblem}>
                <Save /> Save pass marks
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMarks(marksFrom(data))}>
                <RotateCcw /> Undo
              </Button>
              <span className={cn("text-xs", markProblem ? "text-rose-600" : "text-amber-700 dark:text-amber-400")}>
                {markProblem ? "A pass mark is above the paper's maximum." : "Not saved yet: the table already shows these marks."}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="results-search"
              aria-label="Search candidates"
              placeholder="Search name or ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={centerId}
            onValueChange={(v) => {
              setCenterId(v ?? ALL);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label="Exam center">
              <SelectValue>{(v: string) => (v === ALL ? "All exam centers" : v === NONE ? "No exam center" : (centerById.get(v)?.name ?? "Exam center"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All exam centers</SelectItem>
              {data.centers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value={NONE}>No exam center</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Sort">
              <SelectValue>
                {(v: string) =>
                  v === "number" ? "Sort: ID" : v === "name" ? "Sort: Name" : v === "result" ? "Sort: Result" : `Sort: ${paperById.get(v.slice(6))?.name ?? "Score"} (high first)`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">ID</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="result">Result</SelectItem>
              {papers.map((p) => (
                <SelectItem key={p.id} value={`paper:${p.id}`}>
                  {p.name} (high first)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={filtered.length === 0 || exporting} />}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export {filtered.length}
            <ChevronDown className="opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => runExport("xlsx")}>
              <FileSpreadsheet /> Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runExport("pdf")}>
              <FileDown /> PDF (print → Save as PDF)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runExport("docx")}>
              <FileText /> Word (.docx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {unnamed > 0 && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          <strong>{unnamed} candidate{unnamed === 1 ? " has" : "s have"} no name.</strong> The ZipGrade results only contain ID numbers. To show names, import
          your candidate list on the <strong>Candidates</strong> tab (Import list: ID number, First name, Last name…). Matching IDs get their names
          filled in, and 1, 01 and 0001 count as the same ID. Linking a candidate to a student also gives them a name.
        </p>
      )}

      <ResponsiveDataTable data={rows} columns={columns} getRowId={(r) => r.candidate.id} empty="No candidates match." />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length === 0 ? "No results" : `Showing ${(current - 1) * PAGE + 1}–${Math.min(current * PAGE, filtered.length)} of ${filtered.length}`}</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            Page {current} of {pages}
          </span>
          <Button variant="outline" size="icon-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {canEdit && !marksDirty && <NextSteps data={data} results={results} reload={reload} />}

      {editing && <EditScoresDialog result={editing} papers={papers} onClose={() => setEditing(null)} reload={reload} />}
      {printing && <ResultsPrint model={printing} onDone={closePrint} />}

      <Dialog open={!!excluding} onOpenChange={(o) => !o && setExcluding(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exclude {excluding?.candidate.full_name || excluding?.candidate.exam_number}?</DialogTitle>
            <DialogDescription>They stay in the results but are never counted as passed. You can include them again later.</DialogDescription>
          </DialogHeader>
          <Input id="exclude-reason" placeholder="Reason (e.g. cheating, duplicate candidate)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluding(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!excluding) return;
                try {
                  await updateCandidate(excluding.candidate.id, { excluded: true, excludeReason: reason.trim() || null });
                  toast.success("Candidate excluded");
                  setExcluding(null);
                  await reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Exclude
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Manual scores for one candidate: one field per paper, prefilled with the
 * current score. A changed score needs a reason; "Use calculated" removes the
 * manual score and goes back to the score from the scanned sheet.
 */
function EditScoresDialog({ result, papers, onClose, reload }: { result: CandidateResult; papers: ExamPaper[]; onClose: () => void; reload: () => Promise<void> }) {
  const initial = Object.fromEntries(papers.map((p) => [p.id, result.scores[p.id] ? String(round(result.scores[p.id]!.total)) : ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const c = result.candidate;

  const changes = papers.filter((p) => values[p.id].trim() !== initial[p.id]);
  const invalid = changes.find((p) => {
    const v = values[p.id].trim();
    if (v === "") return false;
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 || n > paperMax(p);
  });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await reload();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit scores · {c.full_name || c.exam_number}</DialogTitle>
          <DialogDescription>
            ID <span className="font-mono">{c.exam_number}</span>. A manual score replaces the score calculated from the scanned sheet and is marked
            with ✎ in the results.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {papers.map((p) => {
            const sc = result.scores[p.id];
            const calculated = sc?.manual ? sc.manual.calculated : sc ? sc.total : null;
            return (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={`score-${p.id}`} className="text-sm font-medium">
                    {p.name}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`score-${p.id}`}
                      type="number"
                      min={0}
                      max={paperMax(p)}
                      step="0.5"
                      inputMode="decimal"
                      placeholder="—"
                      value={values[p.id]}
                      onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                      className="h-9 w-20 text-center font-semibold tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground tabular-nums">/ {round(paperMax(p))}</span>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {calculated != null ? `Calculated from the sheet: ${round(calculated)}` : "No scanned sheet for this paper"}
                  {sc?.manual && (
                    <>
                      {" · "}
                      <span className="text-amber-700 dark:text-amber-400">Manual: {sc.manual.reason}</span>{" "}
                      <button
                        type="button"
                        disabled={busy}
                        className="font-medium text-primary hover:underline"
                        onClick={() => run(() => setScoreOverride(c.id, p.id, null), `${p.name}: back to the calculated score`)}
                      >
                        Use calculated
                      </button>
                    </>
                  )}
                </p>
              </div>
            );
          })}
          {changes.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="score-reason" className="text-sm font-medium">
                Reason
              </label>
              <Input
                id="score-reason"
                placeholder="e.g. sheet couldn't be scanned, marked by hand"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
              />
            </div>
          )}
          {invalid && <p className="text-sm text-rose-600">{invalid.name}: the score must be between 0 and {round(paperMax(invalid))}.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || changes.length === 0 || !!invalid || !reason.trim()}
            onClick={() =>
              run(async () => {
                for (const p of changes) {
                  const v = values[p.id].trim();
                  await setScoreOverride(c.id, p.id, v === "" ? null : Number(v), reason.trim());
                }
              }, "Scores saved")
            }
          >
            Save {changes.length > 1 ? `${changes.length} scores` : "score"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
