"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { OfflineNotice } from "@/components/offline/OfflineNotice";
import { PapersTab } from "@/components/exams/PapersTab";
import { CandidatesTab } from "@/components/exams/CandidatesTab";
import { PlanningTab } from "@/components/exams/PlanningTab";
import { ImportTab } from "@/components/exams/ImportTab";
import { AnalysisTab } from "@/components/exams/AnalysisTab";
import { RulesTab } from "@/components/exams/RulesTab";
import { ResultsTab } from "@/components/exams/ResultsTab";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import type { ExamData } from "@/features/written-exam/scoring";
import { getExamData, setExamLock } from "@/services/writtenExamService";
import { syncSelectionProcess } from "@/features/written-exam/sync";

// Results first: it's what most people open the page for.
const TABS = [
  { value: "results", label: "Results" },
  { value: "candidates", label: "Candidates" },
  { value: "planning", label: "Planning" },
  { value: "papers", label: "Papers & keys" },
  { value: "import", label: "Import results" },
  { value: "analysis", label: "Question analysis" },
  { value: "rules", label: "Pass rules" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const TAB_KEY = "exams-tab";

/**
 * Written exams: papers and answer keys per cycle, ZipGrade imports with a
 * review step, question analysis, adjustable pass rules and results.
 * Scores are calculated in the browser from the raw answers (features/written-exam).
 */
export default function ExamsPage() {
  const { role, loading: roleLoading } = useRole();
  const { online } = useOfflineStatus();
  const { cycles, cycleId, setCycleId, loading: cyclesLoading } = useCycleFilter();
  const [data, setData] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("results");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.some((t) => t.value === saved)) setTab(saved);
    } catch {
      // storage unavailable
    }
  }, []);

  const reload = useCallback(async () => {
    if (!cycleId) {
      setLoading(false);
      return;
    }
    try {
      const next = await getExamData(cycleId);
      setData(next);
      // Keep the Selection Process exam numbers up to date (best effort, in the background).
      syncSelectionProcess(next).catch(() => {});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load exam data");
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    if (cyclesLoading || !online) return;
    setLoading(true);
    setData(null);
    reload();
  }, [cyclesLoading, online, reload]);

  if (!roleLoading && !can(role, "enterExamScores")) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to written exams.</p>;
  }

  const locked = data?.cycle.exam_rules_locked ?? false;
  const canEdit = can(role, "enterExamScores") && !locked;

  function changeTab(v: Tab) {
    setTab(v);
    try {
      localStorage.setItem(TAB_KEY, v);
    } catch {
      // storage unavailable
    }
  }

  async function toggleLock() {
    if (!cycleId) return;
    const next = !locked;
    if (!next && role !== "super_admin") return;
    try {
      await setExamLock(cycleId, next);
      toast.success(next ? "Exam results locked" : "Exam results unlocked");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change the lock");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Written exams</h1>
          <p className="text-sm text-muted-foreground">
            Candidates, exam centers, answer keys, ZipGrade results, question analysis and pass rules for the selected cycle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && (role === "super_admin" || (role === "program_manager" && !locked)) && (
            <Button variant="outline" onClick={toggleLock}>
              {locked ? <LockOpen /> : <Lock />}
              {locked ? "Unlock results" : "Lock results"}
            </Button>
          )}
          <CycleSelect cycles={cycles} value={cycleId} onChange={setCycleId} className="w-full sm:w-56" />
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            Results for this cycle are locked. Keys, imports and pass rules can&apos;t be changed until a Super Admin unlocks them.
          </p>
        </div>
      )}

      {!online ? (
        <OfflineNotice message="Written exams need an internet connection. This page will load when you're back online." />
      ) : !cyclesLoading && !cycleId ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Create a selection cycle first (Configuration → Cycles), then set up its exam papers here.
        </p>
      ) : loading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full max-w-xl" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)}>
          <div className="overflow-x-auto [scrollbar-width:none]">
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="candidates" className="mt-4">
            <CandidatesTab data={data} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="planning" className="mt-4">
            <PlanningTab data={data} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="papers" className="mt-4">
            <PapersTab data={data} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="import" className="mt-4">
            {/* After an import, show the results. */}
            <ImportTab data={data} canEdit={canEdit} reload={reload} onImported={() => changeTab("results")} />
          </TabsContent>
          <TabsContent value="analysis" className="mt-4">
            <AnalysisTab data={data} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <RulesTab data={data} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="results" className="mt-4">
            <ResultsTab data={data} canEdit={canEdit} reload={reload} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
