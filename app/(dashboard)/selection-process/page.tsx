"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Gavel,
  Home,
  Mic,
  type LucideIcon,
} from "lucide-react";
import { getActiveCycle, listCycles, type Cycle } from "@/services/lookupService";
import { getSelectionProcessStats, type SelectionProcessStats } from "@/services/selectionProcessService";
import {
  ExamCentersCard,
  ExamResultsCard,
  InformationSessionsCard,
  InterviewCentersCard,
  InterviewResultsCard,
  examCenterChecks,
  examResultChecks,
  examResultValues,
  infoSessionChecks,
  infoSessionValues,
  interviewCenterChecks,
  interviewResultChecks,
  interviewResultValues,
} from "@/components/selection-process/cards";
import { formatNumber, pct } from "@/components/selection-process/primitives";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const SELECTION_FLOW: { title: string; description: string; icon: LucideIcon; accent: string }[] = [
  {
    title: "Information Session",
    description: "Students learn about the scholarship and apply",
    icon: CalendarDays,
    accent: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  },
  {
    title: "Entrance Exam",
    description: "Applicants sit the written exam",
    icon: GraduationCap,
    accent: "bg-blue-100 text-blue-700 ring-blue-200",
  },
  {
    title: "Motivation Interview",
    description: "Exam passers are interviewed",
    icon: Mic,
    accent: "bg-violet-100 text-violet-700 ring-violet-200",
  },
  {
    title: "Home Visit",
    description: "Staff visit the family and fill in the social form",
    icon: Home,
    accent: "bg-amber-100 text-amber-700 ring-amber-200",
  },
  {
    title: "Selection Committee",
    description: "The committee votes and makes the final decision",
    icon: Gavel,
    accent: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
];

/** The five steps every candidate goes through, in order. */
function SelectionFlow() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Selection flow</CardTitle>
        <CardDescription>The five steps every candidate goes through, in order.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col items-stretch lg:flex-row lg:items-start">
          {SELECTION_FLOW.map((step, i) => (
            <li key={step.title} className="flex flex-col items-center lg:flex-1 lg:flex-row lg:items-start">
              <div className="flex w-full items-center gap-3 rounded-xl border bg-muted/20 p-3 lg:flex-col lg:border-0 lg:bg-transparent lg:p-0 lg:text-center">
                <div className="relative shrink-0">
                  <div className={cn("flex size-12 items-center justify-center rounded-full ring-4", step.accent)}>
                    <step.icon className="size-5" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background ring-2 ring-card">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 lg:mt-3 lg:px-1">
                  <p className="text-sm font-semibold leading-tight">{step.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {i < SELECTION_FLOW.length - 1 && (
                <div aria-hidden="true" className="flex shrink-0 items-center justify-center py-1.5 lg:mt-6 lg:w-8 lg:py-0 xl:w-10">
                  <ArrowDown className="size-4 text-muted-foreground lg:hidden" />
                  <div className="hidden h-0.5 w-full bg-border lg:block" />
                  <ChevronRight className="-ml-1.5 hidden size-4 shrink-0 text-muted-foreground lg:block" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

type FunnelStep = { label: string; value: number; step: number };

/** People moving through the process, each step with the share kept from the step before. */
function Funnel({ steps, onOpen }: { steps: FunnelStep[]; onOpen: (step: number) => void }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recruitment funnel</CardTitle>
        <CardDescription>How many people reached each step, and how many carried on from the step before.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {steps.map((step, i) => {
            const prev = i > 0 ? steps[i - 1].value : null;
            const kept = prev != null && prev > 0 ? pct(step.value, prev) : null;
            return (
              <li key={step.label} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(step.step)}
                  className="flex h-full w-full flex-col rounded-xl border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
                  <span className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(step.value)}</span>
                  <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(step.value > 0 ? 2 : 0, (step.value / max) * 100)}%` }}
                    />
                  </span>
                  <span className="mt-1.5 text-xs text-muted-foreground">
                    {i === 0 ? "Starting point" : kept == null ? "—" : `${kept}% of previous step`}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground xl:block"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

type Issue = { step: number; stage: string; count: number; label: string };

/** Every open issue from every stage in one place, each linking to its stage. */
function NeedsAttention({ issues, onOpen }: { issues: Issue[]; onOpen: (step: number) => void }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        <span className="font-medium">All on track.</span> No open issues in any stage.
      </div>
    );
  }
  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-500" />
          Needs attention
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {issues.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 md:grid-cols-2">
          {issues.map((issue) => (
            <li key={`${issue.step}-${issue.label}`}>
              <button
                type="button"
                onClick={() => onOpen(issue.step)}
                className="group flex w-full items-center gap-3 rounded-lg border bg-amber-50/50 px-3 py-2 text-left text-sm transition-colors hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="min-w-12 rounded-md bg-amber-100 px-2 py-0.5 text-center text-sm font-semibold text-amber-800 tabular-nums">
                  {formatNumber(issue.count)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{issue.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {PHASE_TITLES[phaseOfStep(issue.step)]} · {issue.stage}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

type Phase = "outreach" | "exam" | "interview";

/** Which tab holds each stage card (1 = info sessions ... 5 = interview results). */
function phaseOfStep(step: number): Phase {
  if (step <= 1) return "outreach";
  if (step <= 3) return "exam";
  return "interview";
}

type PhaseTab = {
  id: Phase;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  metric: string;
  issues: number;
};

const PHASE_STORAGE_KEY = "selection-process-phase";

const PHASE_TITLES: Record<Phase, string> = { outreach: "Outreach", exam: "Entrance Exam", interview: "Interview" };

/**
 * The three data phases as a connected flow that works like tabs: pick a
 * step to see its details below. Arrow keys move between steps.
 */
function PhaseTabs({ tabs, active, onChange }: { tabs: PhaseTab[]; active: Phase; onChange: (phase: Phase) => void }) {
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    document.getElementById(`phase-tab-${tabs[next].id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label="Selection process phases" className="grid grid-cols-3 items-stretch gap-2 sm:gap-0">
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <div key={tab.id} className="relative flex min-w-0 items-stretch">
            <button
              id={`phase-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="phase-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "group relative flex w-full min-w-0 flex-col items-center gap-2 rounded-xl border-2 px-2 py-3 text-center transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:gap-3 sm:px-4 sm:text-left",
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent bg-muted/40 hover:border-border hover:bg-muted/70",
              )}
            >
              <span className="relative shrink-0">
                <span className={cn("flex size-10 items-center justify-center rounded-full", tab.accent)}>
                  <tab.icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-card",
                    selected ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
                  )}
                >
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <span className={cn("truncate text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>
                    {tab.title}
                  </span>
                  {tab.issues > 0 && (
                    <span
                      className="hidden shrink-0 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 sm:inline"
                      title={`${tab.issues} open issue${tab.issues === 1 ? "" : "s"}`}
                    >
                      {tab.issues}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{tab.metric}</span>
              </span>
              {tab.issues > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 sm:hidden"
                  role="img"
                  aria-label={`${tab.issues} open issues`}
                />
              )}
            </button>
            {i < tabs.length - 1 && (
              <span
                aria-hidden="true"
                className="relative z-10 hidden w-6 shrink-0 items-center justify-center text-muted-foreground sm:flex lg:w-10"
              >
                <span className="h-0.5 flex-1 bg-border" />
                <ChevronRight className="-ml-1 size-4" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading selection process">
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function SelectionProcessPage() {
  const { role } = useRole();
  const canEdit = can(role, "manageSelectionProcessStats");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string>("");
  const [cyclesLoaded, setCyclesLoaded] = useState(false);
  const [stats, setStats] = useState<SelectionProcessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("outreach");

  // Remember the last phase viewed in this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PHASE_STORAGE_KEY);
      if (saved === "outreach" || saved === "exam" || saved === "interview") setPhase(saved);
    } catch {
      // storage unavailable
    }
  }, []);

  const changePhase = useCallback((next: Phase) => {
    setPhase(next);
    try {
      localStorage.setItem(PHASE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  /** Open the tab that holds a stage card and scroll to that card. */
  const openStep = useCallback(
    (step: number) => {
      changePhase(phaseOfStep(step));
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          document.getElementById(`stage-${step}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
        ),
      );
    },
    [changePhase],
  );

  useEffect(() => {
    Promise.all([listCycles(), getActiveCycle()])
      .then(([allCycles, active]) => {
        setCycles(allCycles ?? []);
        setCycleId(active?.id ?? allCycles?.[0]?.id ?? "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load cycles"))
      .finally(() => setCyclesLoaded(true));
  }, []);

  const load = useCallback(() => {
    if (!cycleId) return;
    setLoading(true);
    return getSelectionProcessStats(cycleId)
      .then(setStats)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load selection process data"))
      .finally(() => setLoading(false));
  }, [cycleId]);

  useEffect(() => {
    load();
  }, [load]);

  const funnel = useMemo<FunnelStep[]>(() => {
    if (!stats) return [];
    const info = infoSessionValues(stats.informationSessions);
    const exam = examResultValues(stats.examResults);
    const interview = interviewResultValues(stats.interviewResults);
    return [
      { label: "Attended sessions", value: info.attendees_actual_boys + info.attendees_actual_girls, step: 1 },
      { label: "Applied", value: info.applicants_total, step: 1 },
      { label: "Sat the exam", value: exam.attended, step: 3 },
      { label: "Passed the exam", value: exam.passed, step: 3 },
      { label: "Interviewed", value: interview.attended, step: 5 },
      { label: "Passed interview", value: interview.passed, step: 5 },
    ];
  }, [stats]);

  const issues = useMemo<Issue[]>(() => {
    if (!stats) return [];
    const stages: [number, string, { count: number; missingLabel: string }[]][] = [
      [1, "Information Sessions", infoSessionChecks(stats.informationSessions)],
      [2, "Exam Centers", examCenterChecks(stats.examCenters)],
      [3, "Exam Results", examResultChecks(stats.examResults)],
      [4, "Interview Centers", interviewCenterChecks(stats.interviewCenters)],
      [5, "Interview Results", interviewResultChecks(stats.interviewResults)],
    ];
    return stages.flatMap(([step, stage, checks]) =>
      checks.filter((c) => c.count > 0).map((c) => ({ step, stage, count: c.count, label: c.missingLabel })),
    );
  }, [stats]);

  const phaseTabs = useMemo<PhaseTab[]>(() => {
    if (!stats) return [];
    const info = infoSessionValues(stats.informationSessions);
    const exam = examResultValues(stats.examResults);
    const interview = interviewResultValues(stats.interviewResults);
    const issuesIn = (p: Phase) => issues.filter((i) => phaseOfStep(i.step) === p).length;
    return [
      {
        id: "outreach",
        title: "Outreach",
        description: "Information sessions and the applications they bring in.",
        icon: CalendarDays,
        accent: "bg-indigo-100 text-indigo-700",
        metric: `${formatNumber(info.applicants_total)} applied`,
        issues: issuesIn("outreach"),
      },
      {
        id: "exam",
        title: "Entrance Exam",
        description: "Exam venues, then the results.",
        icon: GraduationCap,
        accent: "bg-blue-100 text-blue-700",
        metric: `${formatNumber(exam.passed)} passed`,
        issues: issuesIn("exam"),
      },
      {
        id: "interview",
        title: "Interview",
        description: "Interview venues, then the results.",
        icon: Mic,
        accent: "bg-violet-100 text-violet-700",
        metric: `${formatNumber(interview.passed)} passed`,
        issues: issuesIn("interview"),
      },
    ];
  }, [stats, issues]);

  const activeTab = phaseTabs.find((t) => t.id === phase);

  return (
    <div className="space-y-8 scroll-smooth">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Selection Process</h1>
          <p className="text-sm text-muted-foreground">
            Track the recruitment funnel from information sessions to interview results.
          </p>
        </div>
        <CycleSelect cycles={cycles} value={cycleId} onChange={setCycleId} className="w-full sm:w-56" />
      </div>

      {cyclesLoaded && !cycleId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No selection cycle yet. Create one under Configuration → Selection Cycles.
          </CardContent>
        </Card>
      ) : loading || !stats ? (
        <LoadingState />
      ) : (
        <>
          <div className="space-y-4">
            <SelectionFlow />
            <Funnel steps={funnel} onOpen={openStep} />
            <NeedsAttention issues={issues} onOpen={openStep} />
          </div>

          <section className="space-y-4" aria-label="Phase details">
            <div>
              <h2 className="text-lg font-semibold">Phase details</h2>
              <p className="text-sm text-muted-foreground">Pick a phase to see its numbers.</p>
            </div>
            <PhaseTabs tabs={phaseTabs} active={phase} onChange={changePhase} />

            <div
              id="phase-panel"
              role="tabpanel"
              aria-labelledby={`phase-tab-${phase}`}
              className="space-y-4 rounded-2xl border bg-muted/20 p-3 sm:p-5"
            >
              {activeTab && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{activeTab.title}:</span> {activeTab.description}
                </p>
              )}
              {phase === "outreach" && (
                <InformationSessionsCard
                  stats={stats.informationSessions}
                  cycleId={cycleId}
                  canEdit={canEdit}
                  onSaved={load}
                />
              )}
              {phase === "exam" && (
                <div className="grid items-start gap-5 xl:grid-cols-2">
                  <ExamCentersCard stats={stats.examCenters} cycleId={cycleId} canEdit={canEdit} onSaved={load} />
                  <ExamResultsCard stats={stats.examResults} cycleId={cycleId} canEdit={canEdit} onSaved={load} />
                </div>
              )}
              {phase === "interview" && (
                <div className="grid items-start gap-5 xl:grid-cols-2">
                  <InterviewCentersCard
                    stats={stats.interviewCenters}
                    cycleId={cycleId}
                    canEdit={canEdit}
                    onSaved={load}
                  />
                  <InterviewResultsCard
                    stats={stats.interviewResults}
                    cycleId={cycleId}
                    canEdit={canEdit}
                    onSaved={load}
                  />
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
