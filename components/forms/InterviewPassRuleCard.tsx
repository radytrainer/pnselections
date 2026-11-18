"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";
import { listCycles, type Cycle } from "@/services/lookupService";
import {
  getInterviewPassRule,
  previewInterviewPassRule,
  saveInterviewPassRule,
  type InterviewPassPreview,
} from "@/services/interviewService";
import { passMarkPoints, type InterviewPassRule } from "@/features/interview/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Motivation Interview pass mark for one cycle (migration 0059). Shows the mark
 * in points for the current number of active questions, previews what the rule
 * would do to interviews already saved, and can re-grade them on save.
 */
export function InterviewPassRuleCard({ activeQuestionCount }: { activeQuestionCount: number }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [saved, setSaved] = useState<InterviewPassRule | null>(null);
  const [mode, setMode] = useState<InterviewPassRule["mode"]>("percent");
  const [valueText, setValueText] = useState("50");
  const [preview, setPreview] = useState<InterviewPassPreview | null>(null);
  const [reapply, setReapply] = useState(true);
  const [saving, setSaving] = useState(false);

  const maxScore = activeQuestionCount * 5;

  useEffect(() => {
    listCycles()
      .then((list) => {
        setCycles(list);
        const active = list.find((c) => c.status === "active") ?? list[0];
        if (active) setCycleId(active.id);
      })
      .catch(() => setCycles([]));
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    let stale = false;
    getInterviewPassRule(cycleId)
      .then((r) => {
        if (stale) return;
        const rule = { mode: r.mode, value: Number(r.value) };
        setSaved(rule);
        setMode(rule.mode);
        setValueText(String(rule.value));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load the pass mark"));
    return () => {
      stale = true;
    };
  }, [cycleId]);

  const value = Number(valueText);
  const error = useMemo(() => {
    if (valueText.trim() === "" || !Number.isFinite(value) || value < 0) return "Enter a number";
    if (mode === "percent" && value > 100) return "Can't be above 100%";
    if (mode === "points" && maxScore > 0 && value > maxScore) return `Can't be above the maximum (${maxScore})`;
    return null;
  }, [valueText, value, mode, maxScore]);
  const rule: InterviewPassRule = { mode, value };
  const dirty = !!saved && (saved.mode !== mode || saved.value !== value);

  // Live preview against interviews already saved in the cycle (debounced).
  useEffect(() => {
    if (!cycleId || error) {
      setPreview(null);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      previewInterviewPassRule(cycleId, { mode, value })
        .then((p) => !stale && setPreview(p))
        .catch(() => !stale && setPreview(null));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [cycleId, mode, value, error]);

  function switchMode(next: InterviewPassRule["mode"]) {
    if (next === mode) return;
    // Convert the current mark so switching doesn't change the meaning.
    if (!error && maxScore > 0) {
      setValueText(String(next === "points" ? passMarkPoints(rule, maxScore) : Math.round((value / maxScore) * 1000) / 10));
    }
    setMode(next);
  }

  const changes = preview ? preview.toPass + preview.toFail : 0;

  async function save() {
    if (error || !cycleId) return;
    setSaving(true);
    try {
      const res = await saveInterviewPassRule(cycleId, rule, reapply && changes > 0);
      setSaved(rule);
      toast.success(
        res.changed > 0
          ? `Pass mark saved — ${res.changed} interview result${res.changed === 1 ? "" : "s"} updated`
          : "Pass mark saved",
      );
      previewInterviewPassRule(cycleId, rule).then(setPreview).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the pass mark");
    } finally {
      setSaving(false);
    }
  }

  const points = !error && maxScore > 0 ? passMarkPoints(rule, maxScore) : null;
  const cycleName = cycles.find((c) => c.id === cycleId)?.name ?? "";

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-muted-foreground" />
            Pass mark
          </CardTitle>
          <CardDescription>The score a student needs to pass the Motivation Interview, set per cycle.</CardDescription>
        </div>
        {cycles.length > 0 && (
          <Select value={cycleId} onValueChange={(v) => v && setCycleId(v)}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Cycle">
              <SelectValue>{() => cycleName || "Select cycle"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.status === "active" ? " (active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Set as</span>
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Pass mark type">
              {(["points", "percent"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    "rounded px-3 py-1 text-sm transition-colors",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {m === "points" ? "Points" : "Percent"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="interview-pass-value" className="block text-xs font-medium text-muted-foreground">
              Pass at least
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="interview-pass-value"
                inputMode="decimal"
                className="w-24"
                value={valueText}
                onChange={(e) => setValueText(e.target.value)}
                aria-invalid={!!error}
              />
              <span className="text-sm text-muted-foreground">{mode === "points" ? `/ ${maxScore} points` : "%"}</span>
            </div>
          </div>
          <Button onClick={save} disabled={!!error || !dirty || saving || !cycleId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm">
            A student passes with <span className="font-semibold">{points ?? "—"} / {maxScore}</span> or more
            {maxScore > 0 && points !== null && <span className="text-muted-foreground"> ({Math.round((points / maxScore) * 1000) / 10}%)</span>}
            <span className="text-muted-foreground"> · {activeQuestionCount} active questions × 5 stars</span>
          </p>
        )}
        {mode === "points" && (
          <p className="text-xs text-muted-foreground">
            Points stay fixed if you add or remove questions. Use Percent to scale with the number of questions.
          </p>
        )}

        {preview && preview.interviewed > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p>
              With this mark, of <span className="font-medium">{preview.interviewed}</span> interviews already saved in {cycleName || "this cycle"}:{" "}
              <span className="font-medium text-green-700 dark:text-green-400">{preview.passed} pass</span>,{" "}
              <span className="font-medium text-red-700 dark:text-red-400">{preview.failed} fail</span>.
            </p>
            {changes > 0 ? (
              <>
                <p className="mt-1 text-muted-foreground">
                  {changes} result{changes === 1 ? "" : "s"} would change
                  {preview.toPass > 0 && ` · ${preview.toPass} fail → pass`}
                  {preview.toFail > 0 && ` · ${preview.toFail} pass → fail`}.
                </p>
                <label className="mt-2 flex items-start gap-2">
                  <Checkbox className="mt-0.5" checked={reapply} onCheckedChange={(v) => setReapply(v === true)} />
                  <span>
                    Update these results when I save
                    <span className="block text-xs text-muted-foreground">
                      Students who now fail leave the working lists (still counted on Selection Process); students who now pass come back.
                      Unticked, the mark only applies to interviews saved from now on.
                    </span>
                  </span>
                </label>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">No saved result would change.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
