"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicResults } from "@/components/exams/TopicResults";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { evaluate, paperMax, round, scoreSheet, type ExamData } from "@/features/written-exam/scoring";
import { getExamData } from "@/services/writtenExamService";

/**
 * Written-exam summary for the dashboard (one cycle): candidates, attendance,
 * pass count, average per paper and the weakest topics. Only for the roles
 * that work on exams, and only once a cycle has imported sheets.
 */
export function DashboardExamCard({ cycleId }: { cycleId: string }) {
  const { role } = useRole();
  const allowed = can(role, "enterExamScores");
  const [data, setData] = useState<ExamData | null | undefined>(undefined);

  useEffect(() => {
    if (!allowed || !cycleId) return;
    let alive = true;
    setData(undefined);
    getExamData(cycleId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [allowed, cycleId]);

  const summary = useMemo(() => {
    if (!data || !data.sheets.length) return null;
    const results = evaluate(data, data.rules);
    const sat = results.filter((r) => Object.keys(r.scores).length > 0).length;
    const passed = results.filter((r) => r.passed).length;
    const papers = data.papers
      .map((p) => {
        const mine = data.sheets.filter((s) => s.paper_id === p.id);
        const max = paperMax(p);
        const avg = mine.length ? mine.reduce((n, s) => n + scoreSheet(p, s).total, 0) / mine.length : 0;
        return { paper: p, sheets: mine.length, avg, max };
      })
      .filter((p) => p.sheets > 0);
    return { candidates: data.candidates.length, sat, passed, hasRules: data.rules.length > 0, papers };
  }, [data]);

  if (!allowed || !cycleId) return null;
  if (data === undefined) return <Skeleton className="h-56 w-full" />;
  if (!data || !summary) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Written exam</CardTitle>
          <CardDescription>Scored from the ZipGrade sheets with the current keys and pass rules.</CardDescription>
        </div>
        <Link href="/exams" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Open Written Exams <ChevronRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Candidates" value={summary.candidates} />
          <Stat label="Sat the exam" value={summary.sat} note={summary.candidates ? `${Math.round((100 * summary.sat) / summary.candidates)}%` : undefined} />
          <Stat
            label="Passed"
            value={summary.hasRules ? summary.passed : "—"}
            note={summary.hasRules ? (summary.sat ? `${Math.round((100 * summary.passed) / summary.sat)}% of those who sat` : undefined) : "No pass rules yet"}
          />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Average score</dt>
            {summary.papers.map((p) => (
              <dd key={p.paper.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">{p.paper.name}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{Math.round(p.avg * 10) / 10}</span>
                  <span className="text-muted-foreground"> / {round(p.max)}</span>
                </span>
              </dd>
            ))}
          </div>
        </dl>
        <div className="grid gap-6 lg:grid-cols-2">
          {summary.papers.map((p) =>
            p.paper.questions.some((q) => q.topic) ? (
              <div key={p.paper.id}>
                <p className="mb-3 text-sm font-medium">
                  {p.paper.name} <span className="font-normal text-muted-foreground">· weakest topics first</span>
                </p>
                <TopicResults paper={p.paper} sheets={data.sheets} compact />
              </div>
            ) : null,
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="truncate text-xs text-muted-foreground" title={note}>{note}</dd>}
    </div>
  );
}
