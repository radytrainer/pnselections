"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, CalendarDays, ClipboardCheck, GraduationCap, Mic, type LucideIcon } from "lucide-react";
import { getActiveCycle, listCycles } from "@/services/lookupService";
import { getSelectionProcessStats, type SelectionProcessStats } from "@/services/selectionProcessService";
import {
  ExamCentersCard,
  ExamResultsCard,
  InformationSessionsCard,
  InterviewCentersCard,
  InterviewResultsCard,
} from "@/components/selection-process/cards";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Cycle = { id: string; year: number; name: string; status: string };

function OverviewTile({
  icon: Icon,
  accent,
  label,
  value,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", accent)}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SelectionProcessPage() {
  const { role } = useRole();
  const canEdit = can(role, "manageSelectionProcessStats");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string>("");
  const [stats, setStats] = useState<SelectionProcessStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listCycles(), getActiveCycle()])
      .then(([allCycles, active]) => {
        setCycles(allCycles ?? []);
        setCycleId(active?.id ?? allCycles?.[0]?.id ?? "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load cycles"));
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

  const infoSessionsTotal = stats
    ? (stats.informationSessions?.sessions_done ?? 0) +
      (stats.informationSessions?.sessions_planned ?? 0) +
      (stats.informationSessions?.sessions_without_date ?? 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Selection Process</h1>
          <p className="text-sm text-muted-foreground">
            Recruitment funnel from information sessions through interview results.
          </p>
        </div>
        <Select value={cycleId} onValueChange={(value) => value && setCycleId(value)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Select cycle">
              {(value: string) => cycles.find((c) => c.id === value)?.name ?? "Select cycle"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {cycles.map((cycle) => (
              <SelectItem key={cycle.id} value={cycle.id}>
                {cycle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!cycleId ? (
        <p className="text-sm text-muted-foreground">No selection cycle found yet.</p>
      ) : loading || !stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <OverviewTile
              icon={CalendarDays}
              accent="bg-indigo-100 text-indigo-600"
              label="Info Sessions"
              value={infoSessionsTotal}
            />
            <OverviewTile
              icon={Building2}
              accent="bg-blue-100 text-blue-600"
              label="Exam Centers"
              value={stats.examCenters?.centers_total ?? 0}
            />
            <OverviewTile
              icon={GraduationCap}
              accent="bg-emerald-100 text-emerald-600"
              label="Exam Passed"
              value={stats.examResults?.passed ?? 0}
            />
            <OverviewTile
              icon={Mic}
              accent="bg-violet-100 text-violet-600"
              label="Interview Centers"
              value={stats.interviewCenters?.centers_total ?? 0}
            />
            <OverviewTile
              icon={ClipboardCheck}
              accent="bg-amber-100 text-amber-600"
              label="Interview Passed"
              value={stats.interviewResults?.passed ?? 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <InformationSessionsCard
              stats={stats.informationSessions}
              cycleId={cycleId}
              canEdit={canEdit}
              onSaved={load}
            />
            <ExamCentersCard stats={stats.examCenters} cycleId={cycleId} canEdit={canEdit} onSaved={load} />
            <ExamResultsCard stats={stats.examResults} cycleId={cycleId} canEdit={canEdit} onSaved={load} />
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
        </>
      )}
    </div>
  );
}
