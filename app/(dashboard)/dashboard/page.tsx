"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Venus,
  Mars,
  Rainbow,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  GraduationCap,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NgoYearlyChart } from "@/components/charts/NgoYearlyChart";
import { VisitorStatsChart } from "@/components/charts/VisitorStatsChart";
import { NgoTotalsChart } from "@/components/charts/NgoTotalsChart";
import { ProvinceChart } from "@/components/charts/ProvinceChart";
import {
  getDashboardData,
  getVisitorStats,
  type DashboardStudent,
  type VisitorStat,
} from "@/services/dashboardService";
import { getNgoYearlyStats, type NgoYearlyStat } from "@/services/ngoService";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { cn } from "@/lib/utils";
import { CARD_COLOR_STYLES, type CardColor } from "@/lib/cardColors";
import { StudentDetailDrawer } from "@/components/dashboard/StudentDetailDrawer";

type GenderFilter = "" | "female" | "male" | "lgbtqia+";

/** The three decision outcomes that support a click-to-drill-down student list. */
type DecisionStatus = "selected" | "waitlisted" | "eliminated";

const GENDER_FILTERS: { value: GenderFilter; label: string; icon: LucideIcon; color: CardColor }[] = [
  { value: "", label: "All", icon: Users, color: "slate" },
  { value: "female", label: "Female", icon: Venus, color: "pink" },
  { value: "male", label: "Male", icon: Mars, color: "blue" },
  { value: "lgbtqia+", label: "LGBTQIA+", icon: Rainbow, color: "violet" },
];

const DECISION_CARDS: { status: DecisionStatus; label: string; icon: LucideIcon; color: CardColor }[] = [
  { status: "selected", label: "Selected Students", icon: CheckCircle2, color: "green" },
  { status: "waitlisted", label: "Waiting List Students", icon: Clock, color: "amber" },
  { status: "eliminated", label: "Eliminated Students", icon: XCircle, color: "rose" },
];

function applyGender(students: DashboardStudent[], filter: GenderFilter) {
  return filter ? students.filter((s) => s.gender === filter) : students;
}

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

  useEffect(() => {
    if (cyclesLoading) return;
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
  }, [cycleId, cyclesLoading]);

  // Gender counts — always absolute (unfiltered), used for the filter cards
  const genderCounts = useMemo(() => ({
    female: students.filter((s) => s.gender === "female").length,
    male: students.filter((s) => s.gender === "male").length,
    "lgbtqia+": students.filter((s) => s.gender === "lgbtqia+").length,
  }), [students]);

  const filtered = useMemo(() => applyGender(students, genderFilter), [students, genderFilter]);

  const decisionCounts = useMemo(() => ({
    selected: filtered.filter((s) => s.status === "selected").length,
    waitlisted: filtered.filter((s) => s.status === "waitlisted").length,
    eliminated: filtered.filter((s) => s.status === "eliminated").length,
  }), [filtered]);

  const kpis = useMemo(() => ({
    provincesCovered: new Set(filtered.map((s) => s.province_name).filter(Boolean)).size,
  }), [filtered]);

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

  const activeDetailMeta = DECISION_CARDS.find((d) => d.status === activeDetail);

  const detailStudents = useMemo(
    () => (activeDetail ? filtered.filter((s) => s.status === activeDetail) : []),
    [filtered, activeDetail],
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Program KPIs for the selected cycle, and NGO referral trends across cycles.
          </p>
        </div>
        <CycleSelect cycles={cycles} value={cycleId} allowAll onChange={setCycleId} className="w-full sm:w-56" />
      </div>

      {/* Gender filter cards — click to filter every KPI + chart below */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {GENDER_FILTERS.map(({ value, label, icon: Icon, color }) => {
          const count =
            value === ""
              ? students.length
              : genderCounts[value as keyof typeof genderCounts];
          const active = genderFilter === value;
          const styles = CARD_COLOR_STYLES[color];
          return (
            <Card
              key={value}
              className={cn(
                "cursor-pointer select-none border-0 shadow-sm ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                styles.bg,
                styles.ring,
                active && [styles.activeBg, "ring-2 shadow-md"],
              )}
              onClick={() => setGenderFilter(active ? "" : value)}
            >
              <CardContent className="flex items-center gap-3">
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", styles.iconBg, styles.iconText)}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <CardDescription className="truncate">{label}</CardDescription>
                  <CardTitle className="text-2xl">{loading ? "—" : count}</CardTitle>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main KPI tiles — respond to gender filter; the three decision cards drill down into a student list */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ...DECISION_CARDS.map((d) => ({
            label: d.label,
            value: decisionCounts[d.status],
            icon: d.icon,
            color: d.color,
            status: d.status as DecisionStatus | null,
          })),
          { label: "Partner NGOs", value: partnerNgos, icon: Building2, color: "indigo" as const, status: null },
          { label: "Partner Schools", value: partnerSchools, icon: GraduationCap, color: "cyan" as const, status: null },
          { label: "Provinces Covered", value: kpis.provincesCovered, icon: MapPin, color: "teal" as const, status: null },
        ].map(({ label, value, icon: Icon, color, status }) => {
          const styles = CARD_COLOR_STYLES[color];
          return (
            <Card
              key={label}
              className={cn(
                "border-0 shadow-sm ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                styles.bg,
                styles.ring,
                status && "cursor-pointer select-none",
              )}
              onClick={status ? () => setActiveDetail(status) : undefined}
            >
              <CardContent className="flex items-center gap-3">
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", styles.iconBg, styles.iconText)}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <CardDescription className="truncate">{label}</CardDescription>
                  <CardTitle className="text-2xl">{loading ? "—" : value}</CardTitle>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* NGO YoY + Social Forms — 2 columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Students Referred by NGO, Year over Year</CardTitle>
            <CardDescription>
              Filter by year to compare NGOs, or by NGO to see their trend across years.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-80 w-full" /> : <NgoYearlyChart stats={yearlyStats} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Forms Filled by Visitor</CardTitle>
            <CardDescription>
              How many distinct students each home visitor has visited and recorded a social form for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-80 w-full" /> : <VisitorStatsChart stats={visitorStats} />}
          </CardContent>
        </Card>
      </div>

      {/* NGO totals chart */}
      <Card>
        <CardHeader>
          <CardTitle>Students by NGO</CardTitle>
          <CardDescription>
            Total students referred by each NGO
            {genderFilter ? ` — ${genderFilter === "lgbtqia+" ? "LGBTQIA+" : genderFilter} only` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-80 w-full" /> : <NgoTotalsChart stats={ngoTotals} />}
        </CardContent>
      </Card>

      {/* Province chart */}
      <Card>
        <CardHeader>
          <CardTitle>Students by Province</CardTitle>
          <CardDescription>
            Number of students from each province
            {genderFilter ? ` — ${genderFilter === "lgbtqia+" ? "LGBTQIA+" : genderFilter} only` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-80 w-full" /> : <ProvinceChart stats={provinceStats} />}
        </CardContent>
      </Card>

      <StudentDetailDrawer
        open={activeDetail !== null}
        onOpenChange={(next) => !next && setActiveDetail(null)}
        title={activeDetailMeta?.label ?? ""}
        icon={activeDetailMeta?.icon ?? CheckCircle2}
        color={activeDetailMeta?.color ?? "green"}
        students={detailStudents}
      />
    </div>
  );
}
