"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleSlash, FileCheck2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluate, groupLabel, round, ruleGroups, type CandidateResult, type ExamPaper } from "@/features/written-exam/scoring";
import { getStudentExam } from "@/services/writtenExamService";

/** Written-exam result (ZipGrade-based exam module) for one student, if linked to a candidate. */
export function StudentWrittenExam({ studentId, onFound }: { studentId: string; onFound?: (found: boolean) => void }) {
  const [state, setState] = useState<{ result: CandidateResult; papers: ExamPaper[]; rules: { label: string; pass: boolean; missing: boolean }[] } | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getStudentExam(studentId)
      .then((d) => {
        if (!alive) return;
        onFound?.(!!d);
        if (!d) return setState(null);
        const [result] = evaluate({ papers: d.papers, sheets: d.sheets, candidates: [d.candidate] }, d.rules);
        // One line per rule group ("… or …"): passed when any rule in it passed.
        const rules = ruleGroups(d.rules).map((g) => ({
          label: groupLabel(d.rules, g, d.papers),
          pass: g.some((i) => result.outcomes[i] === "pass"),
          missing: g.every((i) => result.outcomes[i] === "missing"),
        }));
        setState({ result, papers: d.papers, rules });
      })
      .catch(() => alive && setState(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFound is a state setter
  }, [studentId]);

  if (state === undefined) return <Skeleton className="h-32 w-full" />;
  if (state === null) return null;

  const { result, papers, rules } = state;
  const c = result.candidate;
  const sat = Object.keys(result.scores).length > 0;
  const status = c.excluded
    ? { label: "Excluded", icon: CircleSlash, cls: "bg-muted text-muted-foreground" }
    : !sat
      ? { label: "Absent", icon: CircleSlash, cls: "bg-muted text-muted-foreground" }
      : !rules.length
        ? null
        : result.passed
          ? { label: "Passed", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" }
          : { label: "Not passed", icon: XCircle, cls: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" /> Written exam
          </CardTitle>
          {status && (
            <Badge className={status.cls}>
              <status.icon className="size-3.5" /> {status.label}
            </Badge>
          )}
        </div>
        <CardDescription>
          Exam number <span className="font-medium text-foreground tabular-nums">{c.exam_number}</span> · scored from the ZipGrade sheets with the current answer key.{" "}
          <Link href="/exams" className="underline underline-offset-2">
            Open Written Exams
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {papers.map((p) => {
            const s = result.scores[p.id];
            return (
              <div key={p.id} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{p.name}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {s ? round(s.total) : "—"}
                  {s && <span className="text-sm font-normal text-muted-foreground"> / {round(s.max)}</span>}
                </p>
                {s &&
                  p.subjects.map((sub) => (
                    <p key={sub.id} className="flex justify-between text-xs text-muted-foreground">
                      <span>{sub.name}</span>
                      <span className="tabular-nums">
                        {round(s.subjects[sub.id]?.score ?? 0)} / {round(s.subjects[sub.id]?.max ?? 0)}
                      </span>
                    </p>
                  ))}
                {!s && <p className="text-xs text-muted-foreground">No sheet imported</p>}
              </div>
            );
          })}
        </div>
        {rules.length > 0 && (
          <ul className="space-y-1 text-sm">
            {rules.map(({ label, pass, missing }, i) => {
              const o = pass ? "pass" : missing ? "missing" : "fail";
              return (
                <li key={i} className="flex items-center gap-2">
                  {o === "pass" ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : o === "fail" ? (
                    <XCircle className="size-4 text-rose-600" />
                  ) : (
                    <CircleSlash className="size-4 text-muted-foreground" />
                  )}
                  <span className={o === "pass" ? "" : "text-muted-foreground"}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}
        {c.excluded && c.exclude_reason && <p className="text-xs text-muted-foreground">Excluded: {c.exclude_reason}</p>}
      </CardContent>
    </Card>
  );
}
