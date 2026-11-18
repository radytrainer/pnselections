"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ColumnDef } from "@tanstack/react-table";
import {
  acceptedAnswers,
  LETTERS,
  paperMax,
  questionAnalysis,
  round,
  type ExamData,
  type ExamQuestion,
  type QuestionStats,
} from "@/features/written-exam/scoring";
import { saveKeyVersion, updateQuestion } from "@/services/writtenExamService";
import { TopicResults } from "@/components/exams/TopicResults";
import { cn } from "@/lib/utils";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type Meta = ResponsiveColumnMeta<QuestionStats>;

export function AnalysisTab({ data, canEdit, reload }: TabProps) {
  const [paperId, setPaperId] = useState(data.papers.find((p) => p.questions.length)?.id ?? data.papers[0]?.id ?? "");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [editing, setEditing] = useState<ExamQuestion | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  // "" = sheets answered on the main key; otherwise a key version (e.g. "B").
  const [version, setVersion] = useState("");

  const paper = data.papers.find((p) => p.id === paperId) ?? null;
  const versions = paper?.key_versions ?? [];
  const kv = versions.find((v) => v.version === version) ?? null;
  const stats = useMemo(() => (paper ? questionAnalysis(paper, data.sheets, kv?.version ?? null) : []), [paper, data.sheets, kv]);
  const flagged = stats.filter((s) => s.keyAlert);
  const shown = onlyFlagged ? stats.filter((s) => s.keyAlert || s.hard || s.question.cancelled) : stats;

  async function save(q: ExamQuestion, patch: { answer?: string; cancelled?: boolean }, message: string) {
    try {
      // On a version, a corrected answer belongs to that version's key; cancelling always applies to the main question.
      if (kv && paper && patch.answer != null) {
        const pos = kv.question_map.indexOf(q.number);
        const answers = kv.answers.map((a, i) => (i === pos ? patch.answer! : a));
        await saveKeyVersion(paper.id, kv.version, answers, kv.question_map);
      } else await updateQuestion(q.id, patch);
      toast.success(message);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  const columns = useMemo<ColumnDef<QuestionStats>[]>(
    () => [
      {
        id: "q",
        header: "Q",
        meta: { card: "title", className: "w-14" } satisfies Meta,
        cell: ({ row }) => {
          const n = row.original.question.number;
          const pos = kv ? kv.question_map.indexOf(n) + 1 : 0;
          return (
            <span className="font-medium tabular-nums">
              Q{n}
              {kv && pos !== n && (
                <span className="block text-xs font-normal text-muted-foreground">{pos ? `Q${pos} on ${kv.version}` : `not on ${kv.version}`}</span>
              )}
            </span>
          );
        },
      },
      {
        id: "subject",
        header: "Subject",
        meta: { card: "summary" } satisfies Meta,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.subject?.name ?? "—"}</span>,
      },
      {
        id: "key",
        header: "Key",
        meta: { card: "summary" } satisfies Meta,
        cell: ({ row }) => (
          <span className={cn("font-mono font-medium", row.original.question.cancelled && "text-muted-foreground line-through")}>
            {acceptedAnswers(row.original.question.answer).join(" or ")}
          </span>
        ),
      },
      {
        id: "correct",
        header: "Correct",
        meta: {
          card: "summary",
          cardCell: (s) => `${Math.round(s.correctPct * 100)}% correct`,
        } satisfies Meta,
        cell: ({ row }) => {
          const pct = Math.round(row.original.correctPct * 100);
          return (
            <div className="flex min-w-32 items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--viz-1)" }} />
              </div>
              <span className="tabular-nums">{pct}%</span>
            </div>
          );
        },
      },
      {
        id: "answers",
        header: "What candidates chose",
        meta: { card: "detail", label: "What candidates chose" } satisfies Meta,
        cell: ({ row }) => {
          const s = row.original;
          const accepted = acceptedAnswers(s.question.answer);
          return (
            <div className="flex flex-wrap gap-1 text-xs tabular-nums">
              {Object.entries(s.counts).map(([l, n]) => (
                <span
                  key={l}
                  className={cn(
                    "rounded px-1.5 py-0.5",
                    accepted.includes(l) ? "bg-emerald-100 font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-muted",
                    s.keyAlert && l === s.topChoice && !accepted.includes(l) && "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
                  )}
                  title={accepted.includes(l) ? "Accepted answer" : undefined}
                >
                  {l} {n}
                </span>
              ))}
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">blank {s.blank}</span>
              {s.multi > 0 && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">2 bubbles {s.multi}</span>}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        meta: { card: "summary" } satisfies Meta,
        cell: ({ row }) => {
          const s = row.original;
          if (s.question.cancelled) return <Badge className="bg-muted text-muted-foreground">Cancelled</Badge>;
          if (s.keyAlert)
            return (
              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" title={s.keyAlert}>
                <AlertTriangle /> Check the key
              </Badge>
            );
          if (s.hard) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">Very few correct</Badge>;
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { card: "actions", className: "w-px" } satisfies Meta,
        cell: ({ row }) => {
          const q = row.original.question;
          if (!canEdit) return null;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Correct the answer for question ${q.number}`}
                title="Correct the answer"
                onClick={() => {
                  setEditing(q);
                  setPicked(acceptedAnswers(q.answer));
                }}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={q.cancelled ? `Restore question ${q.number}` : `Cancel question ${q.number}`}
                title={q.cancelled ? "Restore question" : "Cancel question (counts for nobody)"}
                onClick={() =>
                  save(q, { cancelled: !q.cancelled }, q.cancelled ? `Question ${q.number} restored` : `Question ${q.number} cancelled`)
                }
              >
                {q.cancelled ? <RotateCcw /> : <Ban />}
              </Button>
            </div>
          );
        },
      },
    ],
    // save/reload are stable for this render cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, kv],
  );

  if (!paper) return <p className="text-sm text-muted-foreground">Add a paper first.</p>;

  const sheetsForPaper = stats[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={paperId}
            onValueChange={(v) => {
              setPaperId(v ?? "");
              setVersion("");
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
          {versions.length > 0 && (
            <Select value={version || "__main__"} onValueChange={(v) => setVersion(!v || v === "__main__" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Key version">
                <SelectValue>{(v: string) => (v === "__main__" ? "Main key sheets" : `Version ${v} sheets`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__main__">Main key sheets</SelectItem>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={v.version}>
                    Version {v.version} sheets
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyFlagged} onCheckedChange={(v) => setOnlyFlagged(v === true)} />
            Only questions that need a look
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          {sheetsForPaper} sheets · out of {round(paperMax(paper))} ·{" "}
          <span className={flagged.length ? "font-medium text-rose-700 dark:text-rose-400" : ""}>
            {flagged.length} question{flagged.length === 1 ? "" : "s"} to check
          </span>
        </p>
      </div>

      {flagged.length > 0 && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <strong>Check the key</strong> means one wrong letter was chosen by at least 40% of candidates and at least twice as often as
          the accepted answer. That&apos;s either a key error or a very common misconception. Read the question before changing anything.
        </p>
      )}

      {kv && (
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Showing version {kv.version} sheets against version {kv.version}&apos;s key, in main-paper question order. Correcting an answer here
          changes version {kv.version}&apos;s key only; cancelling a question cancels it for every version.
        </p>
      )}

      {!kv && <TopicResults paper={paper} sheets={data.sheets} />}

      {paper.questions.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No answer key yet. Upload one on Papers &amp; keys, or import a ZipGrade file.
        </p>
      ) : (
        <ResponsiveDataTable data={shown} columns={columns} getRowId={(s) => s.question.id} empty="No questions to show." />
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Correct question {editing?.number}
              {kv ? ` (version ${kv.version})` : ""}
            </DialogTitle>
            <DialogDescription>
              Choose the accepted answer. Tick more than one when several answers are right; every candidate is rescored at once.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-3">
            {LETTERS.slice(0, Math.max(editing?.options ?? 4, 4)).map((l) => (
              <label key={l} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox
                  checked={picked.includes(l)}
                  onCheckedChange={(v) => setPicked((p) => (v === true ? [...p, l].sort() : p.filter((x) => x !== l)))}
                />
                {l}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!picked.length || picked.join(",") === acceptedAnswers(editing?.answer ?? "").join(",")}
              onClick={async () => {
                if (!editing) return;
                await save(editing, { answer: picked.join(",") }, `Question ${editing.number}: accepted ${picked.join(" or ")}`);
                setEditing(null);
              }}
            >
              Save and rescore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
