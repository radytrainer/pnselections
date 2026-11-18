"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { topicAnalysis, type ExamPaper, type ExamSheet } from "@/features/written-exam/scoring";

/**
 * Average result per topic for one paper, weakest first. Topics come from the
 * key file's Topic column. Renders nothing when the key has no topics.
 */
export function TopicResults({ paper, sheets, compact = false }: { paper: ExamPaper; sheets: ExamSheet[]; compact?: boolean }) {
  const topics = useMemo(() => topicAnalysis(paper, sheets), [paper, sheets]);
  const [showAll, setShowAll] = useState(false);
  const hasTopics = topics.some((t) => t.topic !== "No topic");
  const sheetCount = useMemo(() => sheets.filter((s) => s.paper_id === paper.id).length, [paper.id, sheets]);
  if (!hasTopics || !sheetCount) return null;

  const LIMIT = compact ? 6 : 10;
  const shown = showAll ? topics : topics.slice(0, LIMIT);

  const list = (
    <div className="space-y-2.5">
      <ul className="space-y-2.5" aria-label={`Average result by topic, ${paper.name}`}>
        {shown.map((t) => {
          const pct = Math.round(t.avgPct * 100);
          return (
            <li key={t.topic} className="group" title={`${t.topic}: ${pct}% of points earned on average · ${t.questions} question${t.questions === 1 ? "" : "s"}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{t.topic}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-medium">{pct}%</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {t.questions} q
                  </span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-300 group-hover:opacity-80"
                  style={{ width: `${Math.max(pct, 1)}%`, background: "var(--viz-1)" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {topics.length > LIMIT && (
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${topics.length} topics`}
        </button>
      )}
    </div>
  );

  if (compact) return list;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results by topic</CardTitle>
        <CardDescription>
          Average share of each topic&apos;s points earned across {sheetCount} sheets, weakest first. Useful for planning next year&apos;s paper and
          for spotting topics no one was taught.
        </CardDescription>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </Card>
  );
}
