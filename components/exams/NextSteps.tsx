"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, BarChart3, Mic } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { candidateGender, groupLabel, ruleGroups, type CandidateResult, type ExamData } from "@/features/written-exam/scoring";
import { examCenterStats, examResultStats } from "@/features/written-exam/stats";
import { applyToStudents, createStudentsFromCandidates } from "@/services/writtenExamService";
import { saveExamCenterStats, saveExamResultStats } from "@/services/selectionProcessService";

/**
 * After the results: move the passers on to the Motivation Interview step
 * (student records at status "Exam done" = waiting for their interview), mark
 * linked candidates who didn't pass as eliminated, and keep the Selection
 * Process numbers in step.
 */
export function NextSteps({ data, results, reload }: { data: ExamData; results: CandidateResult[]; reload: () => Promise<void> }) {
  const [dialog, setDialog] = useState<null | "move" | "stats">(null);
  const [busy, setBusy] = useState(false);

  // Only candidates who actually sat something count as "not passed" for students.
  const sat = (r: CandidateResult) => Object.keys(r.scores).length > 0;
  const passers = results.filter((r) => r.passed);
  const linkedPassers = passers.filter((r) => r.candidate.student);
  const toAdvance = linkedPassers.filter((r) => r.candidate.student!.status === "registered");
  const alreadyThere = linkedPassers.length - toAdvance.length;
  const unlinkedPassers = passers.filter((r) => !r.candidate.student_id);
  const toCreate = unlinkedPassers.filter((r) => r.candidate.full_name?.trim() && candidateGender(r.candidate));
  const cantCreate = unlinkedPassers.filter((r) => !toCreate.includes(r));
  const toEliminate = results.filter(
    (r) => r.candidate.student && !r.passed && !r.candidate.excluded && sat(r) && ["registered", "exam_completed"].includes(r.candidate.student.status),
  );
  const ready = alreadyThere; // passers already at the interview step
  const willMove = toAdvance.length + toCreate.length;
  const centerStats = examCenterStats(data);
  const resultStats = examResultStats(data);

  const reason = (r: CandidateResult) => {
    const group = ruleGroups(data.rules)[r.stoppedGroup ?? 0];
    return `Did not pass the written exam (${group ? groupLabel(data.rules, group, data.papers) : "pass rules"})`.slice(0, 300);
  };

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    try {
      toast.success(await fn());
      setDialog(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function movePassers() {
    let created = 0;
    if (toCreate.length) created = (await createStudentsFromCandidates(data.cycle.id, toCreate.map((r) => r.candidate.id))).created;
    let advanced = 0;
    let eliminated = 0;
    if (toAdvance.length || toEliminate.length) {
      const r = await applyToStudents(
        data.cycle.id,
        toAdvance.map((x) => x.candidate.id),
        toEliminate.map((x) => ({ candidateId: x.candidate.id, reason: reason(x) })),
      );
      advanced = r.advanced;
      eliminated = r.eliminated;
    }
    return [
      `${created + advanced} passer${created + advanced === 1 ? "" : "s"} moved to Motivation Interview`,
      created ? `${created} new student record${created === 1 ? "" : "s"}` : "",
      eliminated ? `${eliminated} marked eliminated` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const noRules = data.rules.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next steps</CardTitle>
        <CardDescription>Move the passers on to the Motivation Interview and keep the Selection Process page up to date.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Main action */}
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
          <p className="flex items-center gap-2 font-medium">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Mic className="size-4" />
            </span>
            Move passers to Motivation Interview
          </p>
          {noRules ? (
            <p className="text-sm text-muted-foreground">Set pass marks first.</p>
          ) : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              <li>
                <strong className="tabular-nums">{passers.length}</strong> passed the exam
              </li>
              <li>
                <strong className="tabular-nums">{ready}</strong> already at the interview step
              </li>
              <li>
                <strong className="tabular-nums">{willMove}</strong> to move now
                {toCreate.length ? <span className="text-muted-foreground"> ({toCreate.length} new student records)</span> : ""}
              </li>
              {cantCreate.length > 0 && (
                <li className="text-amber-700 dark:text-amber-400">
                  <strong className="tabular-nums">{cantCreate.length}</strong> need a name and gender first
                </li>
              )}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={noRules || (!willMove && !toEliminate.length)} onClick={() => setDialog("move")}>
              <ArrowRight /> {willMove ? `Move ${willMove} passer${willMove === 1 ? "" : "s"}…` : "Nothing to move"}
            </Button>
            {passers.length > 0 && (
              <Link href="/selection-process" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                See them on Selection Process <ArrowRight />
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="size-4 text-primary" /> Selection Process numbers
          </p>
          <p className="flex-1 text-xs text-muted-foreground">
            Updated automatically after each change · {resultStats.passed} passed · {resultStats.failed} failed · {resultStats.passed} eligible for interview
          </p>
          <Button variant="outline" size="sm" className="self-start" onClick={() => setDialog("stats")}>
            Check / update now…
          </Button>
        </div>
      </CardContent>

      <Dialog open={dialog === "move"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move passers to Motivation Interview?</DialogTitle>
            <DialogDescription>
              Each passer becomes a student at <strong>Exam done</strong>, which means waiting for their interview. They then appear in Students and
              Field Mode, ready for the interview.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
            <li>
              <strong>{toAdvance.length}</strong> linked student{toAdvance.length === 1 ? "" : "s"}: Registered → <strong>Exam done</strong>
            </li>
            <li>
              <strong>{toCreate.length}</strong> new student record{toCreate.length === 1 ? "" : "s"} for passers who aren&apos;t students yet (status Exam done,
              linked to their result)
            </li>
            {toEliminate.length > 0 && (
              <li>
                <strong>{toEliminate.length}</strong> linked student{toEliminate.length === 1 ? "" : "s"} who didn&apos;t pass → <strong>Eliminated</strong>, with
                the reason
              </li>
            )}
            {ready > 0 && <li className="text-muted-foreground">{ready} passers are already at the interview step or beyond: not changed.</li>}
          </ul>
          {cantCreate.length > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              {cantCreate.length} passer{cantCreate.length === 1 ? " has" : "s have"} no name or gender yet ({cantCreate
                .slice(0, 6)
                .map((r) => r.candidate.exam_number)
                .join(", ")}
              {cantCreate.length > 6 ? "…" : ""}) and will be skipped. Import the candidate list or edit them on the Candidates tab, then move them.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            If some passers already exist as students, link them on the Candidates tab first (“Link by name” or edit) so no duplicate is created.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => run(movePassers)}>
              <ArrowRight /> Move {willMove} passer{willMove === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "stats"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fill the Selection Process exam numbers?</DialogTitle>
            <DialogDescription>
              These numbers are written to the Selection Process page automatically whenever the results change; use this to update them right now.
              Fields the exam module doesn&apos;t know are left as they are.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Row k="Exam centers" v={centerStats.centers_total} />
            <Row k="Sessions done / to do" v={`${centerStats.sessions_done} / ${centerStats.sessions_not_done}`} />
            <Row k="Applicants" v={centerStats.applicants_total} />
            <Row k="Not assigned" v={centerStats.applicants_not_assigned} />
            <Row k="Without session" v={centerStats.applicants_without_schedule} />
            <Row k="Attended (all papers)" v={resultStats.attended} />
            <Row k="Partially attended" v={resultStats.partially_attended} />
            <Row k="Absent" v={resultStats.absent} />
            <Row k="Still to be done" v={resultStats.still_to_be_done} />
            <Row k="Passed (girls / boys)" v={`${resultStats.passed} (${resultStats.passed_girls} / ${resultStats.passed_boys})`} />
            <Row k="Failed (girls / boys)" v={`${resultStats.failed} (${resultStats.failed_girls} / ${resultStats.failed_boys})`} />
            <Row k="Eligible for interview" v={resultStats.passed} />
          </div>
          {resultStats.passed_girls + resultStats.passed_boys < resultStats.passed && (
            <p className="text-xs text-muted-foreground">
              {resultStats.passed - resultStats.passed_girls - resultStats.passed_boys} passers have no gender set, so they aren&apos;t in the girls/boys split.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await saveExamCenterStats(data.cycle.id, centerStats);
                  await saveExamResultStats(data.cycle.id, resultStats);
                  return "Selection Process exam numbers updated";
                })
              }
            >
              Fill numbers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: number | string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}
