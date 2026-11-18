"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * Phase 3: carry the exam outcome into the rest of the app — student
 * statuses, new student records for passers, and the Selection Process numbers.
 */
export function NextSteps({ data, results, reload }: { data: ExamData; results: CandidateResult[]; reload: () => Promise<void> }) {
  const [dialog, setDialog] = useState<null | "status" | "create" | "stats">(null);
  const [busy, setBusy] = useState(false);

  // Only candidates who actually sat something count as "not passed" for students.
  const sat = (r: CandidateResult) => Object.keys(r.scores).length > 0;
  const linked = results.filter((r) => r.candidate.student);
  const toAdvance = linked.filter((r) => r.passed && r.candidate.student!.status === "registered");
  const toEliminate = linked.filter(
    (r) => !r.passed && !r.candidate.excluded && sat(r) && ["registered", "exam_completed"].includes(r.candidate.student!.status),
  );
  const unlinkedPassers = results.filter((r) => r.passed && !r.candidate.student_id);
  const creatable = unlinkedPassers.filter((r) => r.candidate.full_name && candidateGender(r.candidate));
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

  const noRules = data.rules.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next steps</CardTitle>
        <CardDescription>Carry the exam results into student records and the Selection Process page. Each step shows what will change before it runs.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Step
          icon={UserCheck}
          title="Update student statuses"
          text={noRules ? "Set pass rules first." : `${toAdvance.length} to mark exam completed · ${toEliminate.length} to mark eliminated`}
          action="Review…"
          disabled={noRules || (!toAdvance.length && !toEliminate.length)}
          onClick={() => setDialog("status")}
        />
        <Step
          icon={UserPlus}
          title="Create students for passers"
          text={noRules ? "Set pass rules first." : `${unlinkedPassers.length} passers aren't students yet · ${creatable.length} have a name and gender`}
          action="Review…"
          disabled={noRules || !creatable.length}
          onClick={() => setDialog("create")}
        />
        <Step
          icon={BarChart3}
          title="Fill Selection Process numbers"
          text={`${centerStats.centers_total} center${centerStats.centers_total === 1 ? "" : "s"} · ${resultStats.attended} attended · ${resultStats.passed} passed`}
          action="Review…"
          onClick={() => setDialog("stats")}
        />
      </CardContent>

      <Dialog open={dialog === "status"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update student statuses?</DialogTitle>
            <DialogDescription>Only students linked to a candidate change. Students already past the exam stage are left alone.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            <li>
              <strong>{toAdvance.length}</strong> passers: Registered → <strong>Exam completed</strong>
            </li>
            <li>
              <strong>{toEliminate.length}</strong> who didn&apos;t pass: → <strong>Eliminated</strong>, with the rule they didn&apos;t pass as the reason
            </li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await applyToStudents(
                    data.cycle.id,
                    toAdvance.map((x) => x.candidate.id),
                    toEliminate.map((x) => ({ candidateId: x.candidate.id, reason: reason(x) })),
                  );
                  return `${r.advanced} marked exam completed, ${r.eliminated} marked eliminated${r.unchanged ? `, ${r.unchanged} unchanged` : ""}`;
                })
              }
            >
              Update {toAdvance.length + toEliminate.length} students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "create"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create {creatable.length} student records?</DialogTitle>
            <DialogDescription>
              Each passer becomes a student with status Exam completed, a new student code, and a link to their exam result. Their other details
              can be filled in later from the Students page.
            </DialogDescription>
          </DialogHeader>
          {unlinkedPassers.length > creatable.length && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              {unlinkedPassers.length - creatable.length} passer{unlinkedPassers.length - creatable.length === 1 ? "" : "s"} have no gender or name yet and
              will be skipped. Set it on the Candidates tab (edit the candidate).
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            If some of them already exist as students, link them on the Candidates tab first (“Link by name” or edit a candidate) to avoid duplicates.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await createStudentsFromCandidates(data.cycle.id, creatable.map((x) => x.candidate.id));
                  return `${r.created} student records created${r.skipped ? `, ${r.skipped} skipped` : ""}`;
                })
              }
            >
              Create {creatable.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "stats"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fill the Selection Process exam numbers?</DialogTitle>
            <DialogDescription>
              Replaces the hand-typed numbers on the Exam Centers and Exam Results cards with these. Fields the exam module doesn&apos;t know
              (like information sessions not linked) are left as they are.
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

function Step({ icon: Icon, title, text, action, disabled, onClick }: { icon: typeof UserCheck; title: string; text: string; action: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-primary" /> {title}
      </p>
      <p className="flex-1 text-xs text-muted-foreground">{text}</p>
      <Button variant="outline" size="sm" className="self-start" disabled={disabled} onClick={onClick}>
        {action}
      </Button>
    </div>
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
