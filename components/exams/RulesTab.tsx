"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  evaluate,
  funnel,
  groupLabel,
  paperMax,
  ruleGroups,
  round,
  ruleMax,
  ruleThreshold,
  type ExamData,
  type ExamRule,
  type RuleUnit,
} from "@/features/written-exam/scoring";
import { saveRules } from "@/services/writtenExamService";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type Draft = { key: string; paper_id: string; subject_id: string | null; min: string; unit: RuleUnit; or: boolean };

const WHOLE = "__whole__";
let seq = 0;
const toDraft = (r: ExamRule): Draft => ({
  key: `r${++seq}`,
  paper_id: r.paper_id,
  subject_id: r.subject_id,
  min: String(Number(r.min_value)),
  unit: r.unit,
  or: !!r.or_previous,
});

export function RulesTab({ data, canEdit, reload }: TabProps) {
  const [drafts, setDrafts] = useState<Draft[]>(() => data.rules.map(toDraft));
  const [saving, setSaving] = useState(false);

  const asRules: ExamRule[] = drafts.map((d, i) => ({
    paper_id: d.paper_id,
    subject_id: d.subject_id,
    min_value: Number(d.min) || 0,
    unit: d.unit,
    or_previous: i > 0 && d.or,
  }));
  const dirty =
    JSON.stringify(asRules) !==
    JSON.stringify(
      data.rules.map((r, i) => ({
        paper_id: r.paper_id,
        subject_id: r.subject_id,
        min_value: Number(r.min_value),
        unit: r.unit,
        or_previous: i > 0 && !!r.or_previous,
      })),
    );
  const groups = ruleGroups(asRules);
  const groupOf = (i: number) => groups.findIndex((g) => g.includes(i));

  // Live preview with the unsaved rules.
  const results = useMemo(() => evaluate(data, asRules), [data, JSON.stringify(asRules)]); // eslint-disable-line react-hooks/exhaustive-deps
  const steps = useMemo(() => funnel(results, asRules, data.papers), [results]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = data.candidates.length;
  const excludedPassing = results.filter((r) => r.meetsRules && r.candidate.excluded).length;
  const passed = results.filter((r) => r.passed).length;

  const problem = drafts.find((d) => {
    const v = Number(d.min);
    return d.min.trim() === "" || !Number.isFinite(v) || v < 0 || (d.unit === "percent" && v > 100);
  });

  const update = (key: string, patch: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const move = (i: number, dir: -1 | 1) =>
    setDrafts((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(i + dir, 0, item);
      return next;
    });

  async function save() {
    setSaving(true);
    try {
      await saveRules(
        data.cycle.id,
        drafts.map((d, i) => ({ paperId: d.paper_id, subjectId: d.subject_id, minValue: Number(d.min), unit: d.unit, orPrevious: i > 0 && d.or })),
      );
      toast.success("Pass rules saved");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save rules");
    } finally {
      setSaving(false);
    }
  }

  if (data.papers.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Add papers and import results first.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Pass rules</CardTitle>
          <CardDescription>
            Rules apply in order: a candidate must pass every rule, and the first rule usually filters most candidates (for example
            English first, then Math &amp; Logic). Switch the link between two rules to <strong>or</strong> to accept either one. A candidate
            without a sheet for a rule&apos;s paper doesn&apos;t pass it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {drafts.length === 0 && <p className="text-sm text-muted-foreground">No rules yet, so nobody passes. Add the first rule.</p>}
          {drafts.map((d, i) => {
            const paper = data.papers.find((p) => p.id === d.paper_id);
            const rule = asRules[i];
            const max = ruleMax(rule, data.papers);
            const step = steps[i];
            const gi = groupOf(i);
            const inOrGroup = (groups[gi]?.length ?? 0) > 1;
            return (
              <div key={d.key}>
                {i > 0 && (
                  <div className="flex items-center gap-2 py-1.5 pl-3" role="group" aria-label={`Link between rule ${i} and rule ${i + 1}`}>
                    <span className="h-4 w-px bg-border" />
                    <div className="inline-flex rounded-md border p-0.5 text-xs">
                      {(["and", "or"] as const).map((k) => {
                        const active = (k === "or") === d.or;
                        return (
                          <button
                            key={k}
                            type="button"
                            disabled={!canEdit}
                            aria-pressed={active}
                            onClick={() => update(d.key, { or: k === "or" })}
                            className={
                              "rounded px-2 py-0.5 font-medium uppercase transition-colors disabled:cursor-default " +
                              (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                            }
                          >
                            {k}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-xs text-muted-foreground">{d.or ? "either rule is enough" : "must also pass"}</span>
                  </div>
                )}
              <div className={"rounded-lg border p-3" + (inOrGroup ? " border-primary/40 bg-primary/[0.03]" : "")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {i + 1}
                  </span>
                  <Select value={d.paper_id} disabled={!canEdit} onValueChange={(v) => v && update(d.key, { paper_id: v, subject_id: null })}>
                    <SelectTrigger className="w-44" aria-label="Paper">
                      <SelectValue>{(v: string) => data.papers.find((p) => p.id === v)?.name ?? "Paper"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {data.papers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={d.subject_id ?? WHOLE}
                    disabled={!canEdit}
                    onValueChange={(v) => update(d.key, { subject_id: !v || v === WHOLE ? null : v })}
                  >
                    <SelectTrigger className="w-40" aria-label="Score">
                      <SelectValue>
                        {(v: string) => (v === WHOLE ? "Whole paper" : (paper?.subjects.find((s) => s.id === v)?.name ?? "Whole paper"))}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WHOLE}>Whole paper</SelectItem>
                      {paper?.subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">at least</span>
                  <Input
                    id={`rule-min-${d.key}`}
                    aria-label="Minimum"
                    type="number"
                    min={0}
                    step="0.5"
                    value={d.min}
                    disabled={!canEdit}
                    onChange={(e) => update(d.key, { min: e.target.value })}
                    className="w-20"
                  />
                  <Select value={d.unit} disabled={!canEdit} onValueChange={(v) => v && update(d.key, { unit: v as RuleUnit })}>
                    <SelectTrigger className="w-32" aria-label="Unit">
                      <SelectValue>{(v: string) => (v === "percent" ? "percent" : `points / ${round(max)}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="points">points / {round(max)}</SelectItem>
                      <SelectItem value="percent">percent</SelectItem>
                    </SelectContent>
                  </Select>
                  {canEdit && (
                    <div className="ml-auto flex">
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" disabled={i === drafts.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                        <ArrowDown />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDrafts((l) => l.filter((x) => x.key !== d.key))} aria-label="Remove rule">
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {d.unit === "percent" && `= ${round(ruleThreshold(rule, max))} of ${round(max)} · `}
                  {step ? `${step.passAlone} pass this rule on its own · ${step.remaining} still in after it` : ""}
                </p>
              </div>
              </div>
            );
          })}

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const used = new Set(drafts.map((d) => d.paper_id));
                  const next = data.papers.find((p) => !used.has(p.id)) ?? data.papers[0];
                  setDrafts((l) => [
                    ...l,
                    { key: `r${++seq}`, paper_id: next.id, subject_id: null, min: String(Math.round(paperMax(next) / 2)), unit: "points", or: false },
                  ]);
                }}
              >
                <Plus /> Add rule
              </Button>
              {dirty && (
                <>
                  <Button size="sm" onClick={save} disabled={saving || !!problem}>
                    <Save /> Save rules
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDrafts(data.rules.map(toDraft))}>
                    <RotateCcw /> Undo changes
                  </Button>
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    {problem ? "Check the minimum values." : "Unsaved changes: the preview already shows them."}
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Updates as you type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FunnelBar label="All candidates" value={total} total={total} />
          {groups.map((g) => {
            const last = g[g.length - 1];
            const s = steps[last];
            if (!s) return null;
            const nums = g.map((i) => i + 1).join(" or ");
            return (
              <FunnelBar
                key={last}
                label={`After rule ${nums}: ${groupLabel(asRules, g, data.papers)}`}
                value={s.remaining}
                total={total}
              />
            );
          })}
          <div className="rounded-lg bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">Passed</p>
            <p className="text-2xl font-semibold tabular-nums">{passed}</p>
            <p className="text-xs text-muted-foreground">
              {total ? Math.round((100 * passed) / total) : 0}% of {total} candidates
              {excludedPassing > 0 && ` · ${excludedPassing} excluded by hand not counted`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted-foreground" title={label}>
          {label}
        </span>
        <span className="shrink-0 font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: "var(--viz-1)" }} />
      </div>
    </div>
  );
}
