"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Award,
  Building2,
  CalendarDays,
  Clock,
  FileCheck,
  GraduationCap,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { StudentListItem } from "@/services/studentService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_ELIGIBLE_AGE, MIN_ELIGIBLE_AGE, POOR_LEVELS } from "@/lib/constants";
import { getAge, getLatestVisit, getPovertyCertificateStatus, isAgeOutOfRange } from "@/features/social-form/derived";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Colours. Gender is the only identity colour on this page; the palette was
// checked with the dataviz validator (CVD-safe, >= 3:1 contrast on white).
// Every other breakdown is a magnitude, drawn in the single primary hue.
// ---------------------------------------------------------------------------
const GENDERS = [
  { key: "female", label: "Female", color: "#db2777" },
  { key: "male", label: "Male", color: "#2563eb" },
  { key: "lgbtqia+", label: "LGBTQIA+", color: "#d97706" },
] as const;

const nf = new Intl.NumberFormat("en-US");
const fmt = (n: number) => nf.format(n);
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
/** Percentage text; a non-zero share that rounds to 0 reads "<1%" rather than a misleading "0%". */
const pctText = (part: number, total: number) => (part > 0 && pct(part, total) === 0 ? "<1%" : `${pct(part, total)}%`);

type View = "selected" | "waitlisted" | "all";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs",
        tone === "warning" && "border-amber-200 bg-amber-50/60",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {tone === "warning" ? <AlertTriangle className="size-3.5 text-amber-600" /> : <Icon className="size-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function ReportCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type BarRow = { label: string; value: number; note?: string; muted?: boolean };

/**
 * Horizontal bars for one breakdown: label, bar (length = share of the
 * largest row), count and % of the total written beside it.
 */
function BarList({ rows, total, emptyText = "No data yet" }: { rows: BarRow[]; total: number; emptyText?: string }) {
  if (total === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const share = pctText(row.value, total);
        return (
          <li
            key={row.label}
            className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,10rem)_1fr_auto]"
            title={`${row.label}: ${fmt(row.value)} (${share})`}
          >
            <span className={cn("truncate", row.muted ? "text-muted-foreground" : "text-foreground")}>
              {row.label}
              {row.note && <span className="ml-1 text-xs text-amber-700">· {row.note}</span>}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full", row.muted ? "bg-muted-foreground/40" : "bg-primary")}
                style={{ width: `${row.value > 0 ? Math.max(2, (row.value / max) * 100) : 0}%` }}
              />
            </span>
            <span className="w-20 text-right tabular-nums">
              <span className="font-semibold">{fmt(row.value)}</span>
              <span className="ml-1 text-xs text-muted-foreground">{share}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Keeps the biggest rows and folds the rest into "Others" so the list stays readable. */
function topRows(counts: Map<string, number>, limit: number): BarRow[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const rows: BarRow[] = sorted.slice(0, limit).map(([label, value]) => ({ label, value }));
  const rest = sorted.slice(limit);
  if (rest.length > 0) {
    rows.push({
      label: `Others (${rest.length})`,
      value: rest.reduce((sum, [, v]) => sum + v, 0),
      muted: true,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------
function analyse(data: StudentListItem[]) {
  const total = data.length;
  const gender: Record<string, number> = { female: 0, male: 0, "lgbtqia+": 0 };
  const genderNgo = {
    ngo: { female: 0, male: 0, "lgbtqia+": 0 } as Record<string, number>,
    none: { female: 0, male: 0, "lgbtqia+": 0 } as Record<string, number>,
  };
  const poor: Record<string, number> = Object.fromEntries(POOR_LEVELS.map((l) => [l, 0]));
  let poorNotSet = 0;
  const major = { science: 0, social_science: 0, none: 0 };
  const cert = { yes: 0, no: 0, none: 0 };
  const ngos = new Map<string, number>();
  let noNgo = 0;
  const provinces = new Map<string, number>();
  const ages = { under: 0, a: 0, b: 0, c: 0, over: 0, unknown: 0 };

  for (const s of data) {
    gender[s.gender] = (gender[s.gender] ?? 0) + 1;
    const ngoName = s.ngo_partners?.organization_name;
    const bucket = ngoName ? genderNgo.ngo : genderNgo.none;
    bucket[s.gender] = (bucket[s.gender] ?? 0) + 1;
    if (ngoName) ngos.set(ngoName, (ngos.get(ngoName) ?? 0) + 1);
    else noNgo += 1;

    const level = s.committee_decisions?.poor_level;
    if (level && level in poor) poor[level] += 1;
    else poorNotSet += 1;

    const m = getLatestVisit(s)?.major;
    if (m === "science") major.science += 1;
    else if (m === "social_science") major.social_science += 1;
    else major.none += 1;

    cert[getPovertyCertificateStatus(s)] += 1;

    const province = s.provinces?.name_en ?? "No province";
    provinces.set(province, (provinces.get(province) ?? 0) + 1);

    const age = getAge(s);
    if (age == null) ages.unknown += 1;
    else if (age < MIN_ELIGIBLE_AGE) ages.under += 1;
    else if (age <= 19) ages.a += 1;
    else if (age <= 22) ages.b += 1;
    else if (age <= MAX_ELIGIBLE_AGE) ages.c += 1;
    else ages.over += 1;
  }

  const outOfRange = data.filter((s) => isAgeOutOfRange(getAge(s))).length;
  return { total, gender, genderNgo, poor, poorNotSet, major, cert, ngos, noNgo, provinces, ages, outOfRange };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
export function FinalistReportView({
  selected,
  waitlisted,
}: {
  selected: StudentListItem[];
  waitlisted: StudentListItem[];
}) {
  const [view, setView] = useState<View>("selected");
  const data = useMemo(
    () => (view === "selected" ? selected : view === "waitlisted" ? waitlisted : [...selected, ...waitlisted]),
    [view, selected, waitlisted],
  );
  const r = useMemo(() => analyse(data), [data]);

  const views: { id: View; label: string; short: string; icon: LucideIcon; count: number }[] = [
    { id: "selected", label: "Main List", short: "Main", icon: Award, count: selected.length },
    { id: "waitlisted", label: "Waiting List", short: "Waiting", icon: Clock, count: waitlisted.length },
    { id: "all", label: "All finalists", short: "All", icon: Users, count: selected.length + waitlisted.length },
  ];
  const viewLabel = views.find((v) => v.id === view)!.label;
  const certRecorded = r.cert.yes + r.cert.no;
  const withNgo = r.total - r.noNgo;

  return (
    <div className="space-y-6">
      {/* Which list */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span id="report-on-label" className="text-sm font-medium text-muted-foreground">
            Report on
          </span>
          <Select value={view} onValueChange={(next) => next && setView(next as View)}>
            <SelectTrigger aria-labelledby="report-on-label" className="w-full sm:w-56">
              <SelectValue>
                {(value: string) => {
                  const v = views.find((x) => x.id === value);
                  return v ? `${v.label} (${v.count})` : "";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {views.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label} ({v.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {fmt(r.total)} students
        </p>
      </div>

      {r.total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No students on the {viewLabel.toLowerCase()} yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile icon={Users} label="Students" value={fmt(r.total)} detail={viewLabel} />
            <StatTile
              icon={UserRound}
              label="Female"
              value={`${pct(r.gender.female, r.total)}%`}
              detail={`${fmt(r.gender.female)} of ${fmt(r.total)}`}
            />
            <StatTile
              icon={Building2}
              label="Referred by an NGO"
              value={`${pct(withNgo, r.total)}%`}
              detail={`${fmt(withNgo)} students`}
            />
            <StatTile
              icon={GraduationCap}
              label="Science track"
              value={`${pct(r.major.science, r.total)}%`}
              detail={`${fmt(r.major.science)} students`}
            />
            <StatTile
              icon={FileCheck}
              label="Poverty certificate"
              value={`${fmt(r.cert.yes)}`}
              detail={certRecorded > 0 ? `${pct(r.cert.yes, certRecorded)}% of those recorded` : "Not recorded yet"}
            />
            <StatTile
              icon={CalendarDays}
              label="Outside age range"
              value={fmt(r.outOfRange)}
              detail={`Eligible ${MIN_ELIGIBLE_AGE}–${MAX_ELIGIBLE_AGE}`}
              tone={r.outOfRange > 0 ? "warning" : "default"}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Gender */}
            <ReportCard title="Gender" description="Split of the list, and by NGO referral">
              <div className="space-y-5">
                <div
                  className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
                  role="img"
                  aria-label={GENDERS.map((g) => `${g.label} ${r.gender[g.key]}`).join(", ")}
                >
                  {GENDERS.filter((g) => r.gender[g.key] > 0).map((g) => (
                    <span
                      key={g.key}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${(r.gender[g.key] / r.total) * 100}%`, backgroundColor: g.color }}
                      title={`${g.label}: ${fmt(r.gender[g.key])} (${pctText(r.gender[g.key], r.total)})`}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-3 gap-2">
                  {GENDERS.map((g) => (
                    <li key={g.key} className="rounded-lg border px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.label}
                      </span>
                      <span className="mt-0.5 block text-lg font-semibold tabular-nums">
                        {fmt(r.gender[g.key])}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {pctText(r.gender[g.key], r.total)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Gender by NGO referral</caption>
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th scope="col" className="py-2 text-left font-medium" />
                        {GENDERS.map((g) => (
                          <th key={g.key} scope="col" className="py-2 text-right font-medium">
                            {g.label}
                          </th>
                        ))}
                        <th scope="col" className="py-2 text-right font-medium">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {(
                        [
                          ["Referred by NGO", r.genderNgo.ngo],
                          ["No NGO", r.genderNgo.none],
                        ] as const
                      ).map(([label, row]) => (
                        <tr key={label} className="border-b last:border-0">
                          <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                            {label}
                          </th>
                          {GENDERS.map((g) => (
                            <td key={g.key} className="py-2 text-right font-medium">
                              {fmt(row[g.key] ?? 0)}
                            </td>
                          ))}
                          <td className="py-2 text-right font-semibold">
                            {fmt(GENDERS.reduce((sum, g) => sum + (row[g.key] ?? 0), 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ReportCard>

            {/* Poor level */}
            <ReportCard title="Poor level" description="Committee rating · A+ is the poorest">
              <BarList
                total={r.total}
                rows={[
                  ...POOR_LEVELS.map((level) => ({ label: level, value: r.poor[level] })),
                  ...(r.poorNotSet > 0 ? [{ label: "Not set", value: r.poorNotSet, muted: true }] : []),
                ]}
              />
            </ReportCard>

            {/* Major */}
            <ReportCard title="Major" description="Academic track from the home visit">
              <BarList
                total={r.total}
                rows={[
                  { label: "Science", value: r.major.science },
                  { label: "Social Science", value: r.major.social_science },
                  ...(r.major.none > 0 ? [{ label: "Not reported", value: r.major.none, muted: true }] : []),
                ]}
              />
            </ReportCard>

            {/* Poverty certificate */}
            <ReportCard title="Poverty certificate" description="As recorded at the home visit">
              <BarList
                total={r.total}
                rows={[
                  { label: "Have", value: r.cert.yes },
                  { label: "Don't have", value: r.cert.no },
                  { label: "Not recorded", value: r.cert.none, muted: true },
                ]}
              />
            </ReportCard>

            {/* Age */}
            <ReportCard title="Age" description={`Eligible range is ${MIN_ELIGIBLE_AGE}–${MAX_ELIGIBLE_AGE}`}>
              <BarList
                total={r.total}
                rows={[
                  {
                    label: `Under ${MIN_ELIGIBLE_AGE}`,
                    value: r.ages.under,
                    note: r.ages.under > 0 ? "outside range" : undefined,
                  },
                  { label: `${MIN_ELIGIBLE_AGE}–19`, value: r.ages.a },
                  { label: "20–22", value: r.ages.b },
                  { label: `23–${MAX_ELIGIBLE_AGE}`, value: r.ages.c },
                  {
                    label: `Over ${MAX_ELIGIBLE_AGE}`,
                    value: r.ages.over,
                    note: r.ages.over > 0 ? "outside range" : undefined,
                  },
                  ...(r.ages.unknown > 0 ? [{ label: "Unknown", value: r.ages.unknown, muted: true }] : []),
                ]}
              />
            </ReportCard>

            {/* NGO */}
            <ReportCard title="NGO referrals" description={`${fmt(withNgo)} referred by ${fmt(r.ngos.size)} NGOs`}>
              <BarList
                total={r.total}
                rows={[
                  ...topRows(r.ngos, 8),
                  ...(r.noNgo > 0 ? [{ label: "No NGO", value: r.noNgo, muted: true }] : []),
                ]}
              />
            </ReportCard>

            {/* Province */}
            <ReportCard
              title="Provinces"
              description={`Students come from ${fmt(r.provinces.size)} provinces`}
              className="lg:col-span-2"
            >
              <BarList total={r.total} rows={topRows(r.provinces, 12)} />
            </ReportCard>
          </div>
        </>
      )}
    </div>
  );
}
