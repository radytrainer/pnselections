"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Percent,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDashboardData,
  getVisitorStats,
  type DashboardStudent,
  type VisitorStat,
} from "@/services/dashboardService";
import { getNgoYearlyStats, type NgoYearlyStat } from "@/services/ngoService";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { OfflineNotice } from "@/components/offline/OfflineNotice";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { STUDENT_STATUSES, type StudentStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CardColor } from "@/lib/cardColors";
import { StudentDetailDrawer } from "@/components/dashboard/StudentDetailDrawer";
import { DashboardExamCard } from "@/components/exams/DashboardExamCard";

// Charts (recharts, ~120 KB) load in parallel with the dashboard data instead
// of blocking the first paint; they only render once that data arrives anyway.
const chartLoading = () => <Skeleton className="h-72 w-full" />;
const NgoYearlyChart = dynamic(() => import("@/components/charts/NgoYearlyChart").then((m) => m.NgoYearlyChart), {
  ssr: false,
  loading: chartLoading,
});
const VisitorStatsChart = dynamic(() => import("@/components/charts/VisitorStatsChart").then((m) => m.VisitorStatsChart), {
  ssr: false,
  loading: chartLoading,
});
const NgoTotalsChart = dynamic(() => import("@/components/charts/NgoTotalsChart").then((m) => m.NgoTotalsChart), {
  ssr: false,
  loading: chartLoading,
});
const ProvinceChart = dynamic(() => import("@/components/charts/ProvinceChart").then((m) => m.ProvinceChart), {
  ssr: false,
  loading: chartLoading,
});

/** Cambodia's provinces (incl. Phnom Penh) — the denominator for "provinces covered". */
const TOTAL_PROVINCES = 25;

type GenderFilter = "" | "female" | "male" | "lgbtqia+";

/** The three decision outcomes that support a click-to-drill-down student list. */
type DecisionStatus = "selected" | "waitlisted" | "eliminated";

/** Gender keeps a fixed color per entity (validated categorical slots 1-3), so filtering never repaints it. */
const GENDERS: { value: Exclude<GenderFilter, "">; label: string; color: string }[] = [
  { value: "female", label: "Female", color: "var(--viz-2)" },
  { value: "male", label: "Male", color: "var(--viz-1)" },
  { value: "lgbtqia+", label: "LGBTQIA+", color: "var(--viz-3)" },
];

/** Decisions use the reserved status colors — always with an icon and label, never color alone. */
const DECISIONS: {
  status: DecisionStatus;
  label: string;
  hint: string;
  icon: LucideIcon;
  drawerColor: CardColor;
  tone: string;
}[] = [
  {
    status: "selected",
    label: "Selected",
    hint: "Awarded a scholarship",
    icon: CheckCircle2,
    drawerColor: "green",
    tone: "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:ring-emerald-500/30",
  },
  {
    status: "waitlisted",
    label: "Waiting list",
    hint: "Next in line if a place opens",
    icon: Clock,
    drawerColor: "amber",
    tone: "text-amber-700 bg-amber-50 ring-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/30",
  },
  {
    status: "eliminated",
    label: "Eliminated",
    hint: "Did not meet the criteria",
    icon: XCircle,
    drawerColor: "rose",
    tone: "text-rose-700 bg-rose-50 ring-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:ring-rose-500/30",
  },
];

/** Where each student currently is — the pipeline stages in process order. */
const PIPELINE: { status: StudentStatus; label: string }[] = [
  { status: "registered", label: "Registered" },
  { status: "exam_completed", label: "Exam done" },
  { status: "interview_completed", label: "Passed interview" },
  { status: "home_visit_completed", label: "Home visit done" },
  { status: "committee_review", label: "Committee review" },
];
const OUTCOME_LABELS: Partial<Record<StudentStatus, string>> = {
  selected: "Selected",
  waitlisted: "Waiting list",
  rejected: "Rejected",
  eliminated: "Eliminated",
  declined: "Declined",
  dropped_out: "Dropped out",
};

function applyGender(students: DashboardStudent[], filter: GenderFilter) {
  return filter ? students.filter((s) => s.gender === filter) : students;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const fmt = (n: number) => n.toLocaleString();

export default function DashboardPage() {
  const [students, setStudents] = useState<DashboardStudent[]>([]);
  const [partnerNgos, setPartnerNgos] = useState(0);
  const [partnerSchools, setPartnerSchools] = useState(0);
  const [yearlyStats, setYearlyStats] = useState<NgoYearlyStat[]>([]);
  const [visitorStats, setVisitorStats] = useState<VisitorStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("");
  const [activeDetail, setActiveDetail] = useState<DecisionStatus | null>(null);

  // Defaults to the active cycle so one generation's numbers aren't mixed
  // with the next; "All Cycles" is still available for comparisons.
  const { cycles, cycleId, setCycleId, loading: cyclesLoading } = useCycleFilter();
  const { online } = useOfflineStatus();

  // Live numbers need the server: skip while offline, re-load on reconnect.
  useEffect(() => {
    if (cyclesLoading || !online) return;
    setLoading(true);
    const cycle = cycleId || undefined;
    // NGO yearly trends compare cycles by design, so they always cover every cycle.
    Promise.all([getDashboardData(cycle), getNgoYearlyStats(), getVisitorStats(cycle)])
      .then(([d, y, v]) => {
        setStudents(d.students);
        setPartnerNgos(d.partnerNgos);
        setPartnerSchools(d.partnerSchools);
        setYearlyStats(y);
        setVisitorStats(v);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [cycleId, cyclesLoading, online]);

  // Gender counts — always absolute (unfiltered), used for the filter and the split bar.
  const genderCounts = useMemo(
    () => ({
      female: students.filter((s) => s.gender === "female").length,
      male: students.filter((s) => s.gender === "male").length,
      "lgbtqia+": students.filter((s) => s.gender === "lgbtqia+").length,
    }),
    [students],
  );

  const filtered = useMemo(() => applyGender(students, genderFilter), [students, genderFilter]);
  const total = filtered.length;

  const decisionCounts = useMemo(
    () => ({
      selected: filtered.filter((s) => s.status === "selected").length,
      waitlisted: filtered.filter((s) => s.status === "waitlisted").length,
      eliminated: filtered.filter((s) => s.status === "eliminated").length,
    }),
    [filtered],
  );

  const provincesCovered = useMemo(
    () => new Set(filtered.map((s) => s.province_name).filter(Boolean)).size,
    [filtered],
  );

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STUDENT_STATUSES.map((s) => [s, 0])) as Record<StudentStatus, number>;
    for (const s of filtered) counts[s.status as StudentStatus] = (counts[s.status as StudentStatus] ?? 0) + 1;
    return counts;
  }, [filtered]);

  const inProgress = PIPELINE.reduce((sum, p) => sum + statusCounts[p.status], 0);
  const decided = total - inProgress;
  const outcomes = (Object.keys(OUTCOME_LABELS) as StudentStatus[])
    .map((status) => ({ status, label: OUTCOME_LABELS[status]!, count: statusCounts[status] }))
    .filter((o) => o.count > 0);

  const provinceStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filtered) {
      const name = s.province_name ?? "Unknown";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([provinceName, studentCount]) => ({ provinceName, studentCount }))
      .sort((a, b) => b.studentCount - a.studentCount);
  }, [filtered]);

  const ngoTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filtered) {
      if (!s.ngo_name) continue;
      map.set(s.ngo_name, (map.get(s.ngo_name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([ngoName, studentCount]) => ({ ngoName, studentCount }))
      .sort((a, b) => b.studentCount - a.studentCount);
  }, [filtered]);

  const activeDetailMeta = DECISIONS.find((d) => d.status === activeDetail);
  const detailStudents = useMemo(
    () => (activeDetail ? filtered.filter((s) => s.status === activeDetail) : []),
    [filtered, activeDetail],
  );

  const cycleName = cycleId ? cycles.find((c) => c.id === cycleId)?.name : "All cycles";
  const genderLabel = GENDERS.find((g) => g.value === genderFilter)?.label;
  const scopeSuffix = genderLabel ? ` · ${genderLabel} only` : "";

  if (!online) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <OfflineNotice message="The dashboard shows live numbers from the server, so it needs an internet connection. It will load automatically when you're back online." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header + filters (one row, above everything they affect) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {cycleName ?? "Selected cycle"} · selection progress, outcomes and partner reach
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div role="radiogroup" aria-label="Filter by gender" className="flex flex-wrap gap-0.5 rounded-lg border bg-muted/40 p-0.5">
            {([{ value: "" as GenderFilter, label: "All", count: students.length }, ...GENDERS.map((g) => ({ ...g, count: genderCounts[g.value] }))]).map(
              (g) => {
                const active = genderFilter === g.value;
                return (
                  <button
                    key={g.value || "all"}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setGenderFilter(g.value)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm whitespace-nowrap transition-colors",
                      active ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {"color" in g && <span className="size-2 rounded-full" style={{ background: g.color }} aria-hidden />}
                    {g.label}
                    <span className="tabular-nums text-xs text-muted-foreground">{loading ? "–" : fmt(g.count)}</span>
                  </button>
                );
              },
            )}
          </div>
          <CycleSelect cycles={cycles} value={cycleId} allowAll onChange={setCycleId} className="w-full sm:w-52" />
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="col-span-3 lg:col-span-1">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total students</p>
              <Users className="size-4 text-muted-foreground" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{fmt(total)}</p>
            )}
            <GenderSplit counts={genderCounts} loading={loading} />
          </CardContent>
        </Card>

        {DECISIONS.map((d) => {
          const value = decisionCounts[d.status];
          return (
            <button
              key={d.status}
              type="button"
              onClick={() => setActiveDetail(d.status)}
              className="group text-left focus-visible:outline-none"
              aria-label={`${d.label}: ${value} students — view list`}
            >
              <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-muted-foreground">{d.label}</p>
                    <span className={cn("hidden size-7 shrink-0 items-center justify-center rounded-full ring-1 sm:flex", d.tone)}>
                      <d.icon className="size-4" />
                    </span>
                  </div>
                  {loading ? (
                    <Skeleton className="h-9 w-20" />
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{fmt(value)}</p>
                      <span className="text-sm text-muted-foreground tabular-nums">{pct(value, total)}%</span>
                    </div>
                  )}
                  <p className="mt-auto hidden items-center justify-between text-xs text-muted-foreground sm:flex">
                    {d.hint}
                    <span className="flex items-center gap-0.5 font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      View list <ChevronRight className="size-3.5" />
                    </span>
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Reach strip */}
      <Card className="py-0">
        <CardContent className="grid grid-cols-2 divide-y px-0 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <ReachStat icon={Percent} label="Selection rate" loading={loading} value={`${pct(decisionCounts.selected, total)}%`} sub={`${fmt(decisionCounts.selected)} of ${fmt(total)} students`} />
          <ReachStat icon={MapPin} label="Provinces covered" loading={loading} value={`${provincesCovered}`} sub={`of ${TOTAL_PROVINCES} provinces`} />
          <ReachStat icon={Building2} label="Partner NGOs" loading={loading} value={fmt(partnerNgos)} sub="active partners" />
          <ReachStat icon={GraduationCap} label="Partner schools" loading={loading} value={fmt(partnerSchools)} sub="active partners" />
        </CardContent>
      </Card>

      {/* Pipeline + outcomes */}
      <Card>
        <CardHeader>
          <CardTitle>Selection pipeline</CardTitle>
          <CardDescription>
            Where every student is right now{scopeSuffix} — {fmt(inProgress)} in progress, {fmt(decided)} with a final outcome.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-2.5">
            {PIPELINE.map((stage, i) => (
              <StageBar key={stage.status} step={i + 1} label={stage.label} count={statusCounts[stage.status]} total={total} loading={loading} />
            ))}
          </div>
          <div className="space-y-3 lg:border-l lg:pl-8">
            <p className="text-sm font-medium">Final outcomes</p>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : outcomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No final decisions yet for this selection.</p>
            ) : (
              <ul className="space-y-2">
                {outcomes.map((o) => (
                  <li key={o.status} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{o.label}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium tabular-nums">{fmt(o.count)}</span>
                      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{pct(o.count, total)}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {online && cycleId && <DashboardExamCard cycleId={cycleId} />}

      {/* Trends + field work */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>NGO referrals, year over year</CardTitle>
            <CardDescription>Referred vs. selected across all cycles. Pick a year to compare NGOs, or an NGO to see its trend.</CardDescription>
          </CardHeader>
          <CardContent>{loading ? <Skeleton className="h-72 w-full" /> : <NgoYearlyChart stats={yearlyStats} />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Home visits by visitor</CardTitle>
            <CardDescription>Distinct students each home visitor has visited and recorded a social form for.</CardDescription>
          </CardHeader>
          <CardContent>{loading ? <Skeleton className="h-72 w-full" /> : <VisitorStatsChart stats={visitorStats} />}</CardContent>
        </Card>
      </div>

      {/* Reach breakdowns */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Students by NGO</CardTitle>
            <CardDescription>Students referred by each NGO{scopeSuffix}.</CardDescription>
          </CardHeader>
          <CardContent>{loading ? <Skeleton className="h-72 w-full" /> : <NgoTotalsChart stats={ngoTotals} />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Students by province</CardTitle>
            <CardDescription>Where students come from{scopeSuffix}.</CardDescription>
          </CardHeader>
          <CardContent>{loading ? <Skeleton className="h-72 w-full" /> : <ProvinceChart stats={provinceStats} />}</CardContent>
        </Card>
      </div>

      <StudentDetailDrawer
        open={activeDetail !== null}
        onOpenChange={(next) => !next && setActiveDetail(null)}
        title={activeDetailMeta ? `${activeDetailMeta.label} students` : ""}
        icon={activeDetailMeta?.icon ?? CheckCircle2}
        color={activeDetailMeta?.drawerColor ?? "green"}
        students={detailStudents}
      />
    </div>
  );
}

/** Stacked female/male/LGBTQIA+ bar with a labelled legend (identity never by color alone). */
function GenderSplit({ counts, loading }: { counts: Record<Exclude<GenderFilter, "">, number>; loading: boolean }) {
  const sum = counts.female + counts.male + counts["lgbtqia+"];
  if (loading) return <Skeleton className="h-8 w-full" />;
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Gender split">
        {GENDERS.map((g) =>
          counts[g.value] > 0 ? (
            <div key={g.value} style={{ width: `${(counts[g.value] / Math.max(sum, 1)) * 100}%`, background: g.color }} />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {GENDERS.map((g) => (
          <span key={g.value} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: g.color }} aria-hidden />
            {g.label}
            <span className="font-medium tabular-nums text-foreground">{fmt(counts[g.value])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ReachStat({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-14" />
        ) : (
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function StageBar({
  step,
  label,
  count,
  total,
  loading,
}: {
  step: number;
  label: string;
  count: number;
  total: number;
  loading: boolean;
}) {
  const share = pct(count, total);
  return (
    <div className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-2 text-sm sm:grid-cols-[1.5rem_8.5rem_1fr_4.5rem] sm:gap-3">
      <span className="hidden size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground sm:flex">{step}</span>
      <span className="truncate">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        {!loading && (
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: "var(--viz-1)" }}
          />
        )}
      </div>
      <span className="text-right tabular-nums">
        {loading ? "–" : (
          <>
            <span className="font-medium">{fmt(count)}</span>{" "}
            <span className="text-xs text-muted-foreground">{share}%</span>
          </>
        )}
      </span>
    </div>
  );
}
