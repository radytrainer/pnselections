"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Search, UserMinus, UserPlus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  evaluate,
  paperMax,
  round,
  groupLabel,
  ruleGroups,
  subjectMax,
  type CandidateResult,
  type ExamData,
} from "@/features/written-exam/scoring";
import { updateCandidate } from "@/services/writtenExamService";
import { downloadXlsx } from "@/components/exams/readSpreadsheet";
import { NextSteps } from "@/components/exams/NextSteps";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type Meta = ResponsiveColumnMeta<CandidateResult>;
type Filter = "all" | "passed" | "failed" | "missing" | "excluded";

const PAGE = 50;
const FILTER_LABEL: Record<Filter, string> = {
  all: "All candidates",
  passed: "Passed",
  failed: "Not passed",
  missing: "Missing a paper",
  excluded: "Excluded",
};

export function ResultsTab({ data, canEdit, reload }: TabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [excluding, setExcluding] = useState<CandidateResult | null>(null);
  const [reason, setReason] = useState("");

  const results = useMemo(() => evaluate(data, data.rules), [data]);
  const counts = useMemo(
    () => ({
      all: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed && !r.candidate.excluded).length,
      missing: results.filter((r) => data.papers.some((p) => !r.scores[p.id])).length,
      excluded: results.filter((r) => r.candidate.excluded).length,
    }),
    [results, data.papers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results
      .filter((r) => {
        if (filter === "passed" && !r.passed) return false;
        if (filter === "failed" && (r.passed || r.candidate.excluded)) return false;
        if (filter === "missing" && !data.papers.some((p) => !r.scores[p.id])) return false;
        if (filter === "excluded" && !r.candidate.excluded) return false;
        if (!q) return true;
        return r.candidate.exam_number.includes(q) || (r.candidate.full_name ?? "").toLowerCase().includes(q);
      })
      .sort((a, b) => Number(b.passed) - Number(a.passed) || a.candidate.exam_number.localeCompare(b.candidate.exam_number));
  }, [results, filter, search, data.papers]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE, current * PAGE);

  const outcome = (r: CandidateResult) => {
    if (r.candidate.excluded) return { label: "Excluded", cls: "bg-muted text-muted-foreground" };
    if (r.passed) return { label: "Passed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" };
    if (!data.rules.length) return { label: "No rules yet", cls: "bg-muted text-muted-foreground" };
    const group = ruleGroups(data.rules)[r.stoppedGroup ?? 0] ?? [0];
    const missing = group.every((i) => r.outcomes[i] === "missing");
    const nums = group.map((i) => i + 1).join(" or ");
    return {
      label: missing ? `No paper (rule ${nums})` : `Not passed (rule ${nums})`,
      cls: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
      title: groupLabel(data.rules, group, data.papers),
    };
  };

  const columns = useMemo<ColumnDef<CandidateResult>[]>(() => {
    const cols: ColumnDef<CandidateResult>[] = [
      {
        id: "number",
        header: "Exam no.",
        meta: { card: "hidden", className: "w-24" } satisfies Meta,
        cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.candidate.exam_number}</span>,
      },
      {
        id: "name",
        header: "Name",
        meta: {
          card: "title",
          cardCell: (r) => (
            <div className="min-w-0">
              <p className="truncate font-medium">{r.candidate.full_name || "No name"}</p>
              <p className="font-mono text-xs text-muted-foreground">{r.candidate.exam_number}</p>
            </div>
          ),
        } satisfies Meta,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="max-w-56 truncate">{row.original.candidate.full_name || <span className="text-muted-foreground">No name</span>}</p>
            {row.original.candidate.student && (
              <p className="text-xs text-muted-foreground">Student {row.original.candidate.student.code}</p>
            )}
          </div>
        ),
      },
    ];
    for (const p of data.papers) {
      // Subjects first (when a paper has more than one), then the paper total.
      if (p.subjects.length > 1) {
        for (const s of p.subjects) {
          cols.push({
            id: `s-${s.id}`,
            header: s.name,
            meta: { card: "detail", label: `${p.name} · ${s.name}`, className: "text-right tabular-nums" } satisfies Meta,
            cell: ({ row }) => {
              const sc = row.original.scores[p.id]?.subjects[s.id];
              return sc ? `${round(sc.score)}/${round(sc.max)}` : <span className="text-muted-foreground">—</span>;
            },
          });
        }
      }
      cols.push({
        id: `p-${p.id}`,
        header: p.name,
        meta: {
          card: "summary",
          cardCell: (r) => {
            const sc = r.scores[p.id];
            return (
              <span>
                {p.name} <span className="font-medium text-foreground tabular-nums">{sc ? `${round(sc.total)}/${round(sc.max)}` : "no paper"}</span>
              </span>
            );
          },
          className: "text-right tabular-nums",
        } satisfies Meta,
        cell: ({ row }) => {
          const sc = row.original.scores[p.id];
          return sc ? <span className="font-medium">{`${round(sc.total)}/${round(sc.max)}`}</span> : <span className="text-muted-foreground">no paper</span>;
        },
      });
    }
    cols.push(
      {
        id: "outcome",
        header: "Result",
        meta: { card: "summary" } satisfies Meta,
        cell: ({ row }) => {
          const o = outcome(row.original);
          return (
            <Badge className={o.cls} title={o.title}>
              {o.label}
            </Badge>
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
          return c.excluded ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title={c.exclude_reason ? `Excluded: ${c.exclude_reason}. Include again` : "Include again"}
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
          );
        },
      },
    );
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, canEdit]);

  async function exportExcel() {
    const header = ["Exam number", "Name"];
    for (const p of data.papers) {
      if (p.subjects.length > 1) for (const s of p.subjects) header.push(`${s.name} (/${round(subjectMax(p, s))})`);
      header.push(`${p.name} total (/${round(paperMax(p))})`);
    }
    header.push("Result", "Excluded reason");
    const body = filtered.map((r) => {
      const line: (string | number | null)[] = [r.candidate.exam_number, r.candidate.full_name ?? ""];
      for (const p of data.papers) {
        const sc = r.scores[p.id];
        if (p.subjects.length > 1) for (const s of p.subjects) line.push(sc ? round(sc.subjects[s.id]?.score ?? 0) : null);
        line.push(sc ? round(sc.total) : null);
      }
      line.push(outcome(r).label, r.candidate.exclude_reason ?? "");
      return line;
    });
    await downloadXlsx(
      `exam-results-${data.cycle.year}-${filter}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      FILTER_LABEL[filter],
      [header, ...body],
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && <NextSteps data={data} results={results} reload={reload} />}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="results-search"
              aria-label="Search candidates"
              placeholder="Search name or exam number"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter((v as Filter) ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Filter">
              <SelectValue>{(v: string) => `${FILTER_LABEL[v as Filter]} (${counts[v as Filter]})`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FILTER_LABEL[f]} ({counts[f]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
          <Download /> Export {filtered.length} to Excel
        </Button>
      </div>

      {!data.rules.length && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No pass rules yet, so nobody is marked as passed. Set them on the Pass rules tab.
        </p>
      )}

      <ResponsiveDataTable data={rows} columns={columns} getRowId={(r) => r.candidate.id} empty="No candidates match." />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtered.length === 0 ? "No results" : `Showing ${(current - 1) * PAGE + 1}–${Math.min(current * PAGE, filtered.length)} of ${filtered.length}`}
        </span>
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
