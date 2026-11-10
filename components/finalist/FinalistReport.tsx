"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAge, getMajor, isAgeOutOfRange } from "@/features/social-form/derived";
import { MAX_ELIGIBLE_AGE, MIN_ELIGIBLE_AGE, POOR_LEVELS } from "@/lib/constants";
import type { StudentListItem } from "@/services/studentService";

const GENDER_LABELS: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };
// Matches the Dashboard page's gender color mapping for cross-page consistency.
const GENDER_COLORS: Record<string, string> = { male: "#3b82f6", female: "#ec4899", "lgbtqia+": "#8b5cf6" };

// Matches the Major split-bar on the Summary tab (cyan/fuchsia).
const MAJOR_COLORS: Record<string, string> = { Science: "#06b6d4", "Social Science": "#d946ef" };

// Matches POOR_LEVEL_BAR_CLASSES on the Summary tab (green family = A tier, orange family = B tier).
const POOR_LEVEL_COLORS: Record<(typeof POOR_LEVELS)[number], string> = {
  "A+": "#22c55e",
  A: "#4ade80",
  "A-": "#86efac",
  "B+": "#f97316",
  B: "#fb923c",
  "B-": "#fdba74",
};

const AGE_IN_RANGE_COLOR = "#6366f1";
const AGE_OUT_OF_RANGE_COLOR = "#f43f5e";
const NGO_BAR_COLOR = "#0891b2";

function pctLabel({ name, percent }: { name?: string; percent?: number }) {
  return `${name ?? ""} ${Math.round((percent ?? 0) * 100)}%`;
}

function buildAgeBuckets(ages: number[]) {
  const buckets = [
    { label: `<${MIN_ELIGIBLE_AGE}`, count: 0, outOfRange: true },
    { label: "17–19", count: 0, outOfRange: false },
    { label: "20–22", count: 0, outOfRange: false },
    { label: `23–${MAX_ELIGIBLE_AGE}`, count: 0, outOfRange: false },
    { label: `${MAX_ELIGIBLE_AGE + 1}+`, count: 0, outOfRange: true },
  ];
  for (const age of ages) {
    if (age < MIN_ELIGIBLE_AGE) buckets[0].count += 1;
    else if (age <= 19) buckets[1].count += 1;
    else if (age <= 22) buckets[2].count += 1;
    else if (age <= MAX_ELIGIBLE_AGE) buckets[3].count += 1;
    else buckets[4].count += 1;
  }
  return buckets;
}

export function FinalistReport({
  selected,
  waitlisted,
}: {
  selected: StudentListItem[];
  waitlisted: StudentListItem[];
}) {
  const all = useMemo(() => [...selected, ...waitlisted], [selected, waitlisted]);

  const genderData = useMemo(() => {
    const counts: Record<string, number> = { male: 0, female: 0, "lgbtqia+": 0 };
    for (const s of all) counts[s.gender] = (counts[s.gender] ?? 0) + 1;
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([gender, count]) => ({ gender, name: GENDER_LABELS[gender] ?? gender, count }));
  }, [all]);

  const majorCounts = useMemo(() => {
    let science = 0;
    let socialScience = 0;
    let unreported = 0;
    for (const s of all) {
      const major = getMajor(s);
      if (major === "Science") science += 1;
      else if (major === "Social Science") socialScience += 1;
      else unreported += 1;
    }
    return { science, socialScience, unreported };
  }, [all]);

  const majorData = useMemo(
    () =>
      [
        { name: "Science", count: majorCounts.science },
        { name: "Social Science", count: majorCounts.socialScience },
      ].filter((d) => d.count > 0),
    [majorCounts],
  );

  const poorLevelData = useMemo(
    () =>
      POOR_LEVELS.map((level) => ({
        level,
        count: all.filter((s) => s.committee_decisions?.poor_level === level).length,
      })),
    [all],
  );

  const ageData = useMemo(() => {
    const ages = all.map((s) => getAge(s)).filter((a): a is number => a != null);
    return buildAgeBuckets(ages);
  }, [all]);

  const outOfRangeCount = useMemo(
    () => all.filter((s) => isAgeOutOfRange(getAge(s))).length,
    [all],
  );

  const ngoData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of all) {
      const name = s.ngo_partners?.organization_name ?? "No NGO";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([ngoName, count]) => ({ ngoName, count }))
      .sort((a, b) => b.count - a.count);
  }, [all]);

  if (all.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No finalists yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gender</CardTitle>
            <CardDescription>{all.length} finalists total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    label={pctLabel}
                  >
                    {genderData.map((entry) => (
                      <Cell key={entry.gender} fill={GENDER_COLORS[entry.gender] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Major</CardTitle>
            <CardDescription>
              Academic track reported on the social form
              {majorCounts.unreported > 0 && ` — ${majorCounts.unreported} not reported`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {majorData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No major data reported yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={majorData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      label={pctLabel}
                    >
                      {majorData.map((entry) => (
                        <Cell key={entry.name} fill={MAJOR_COLORS[entry.name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Poor Levels</CardTitle>
            <CardDescription>Committee-assigned poverty rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={poorLevelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                    {poorLevelData.map((entry) => (
                      <Cell key={entry.level} fill={POOR_LEVEL_COLORS[entry.level]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Age Range</CardTitle>
            <CardDescription>
              Eligible range is {MIN_ELIGIBLE_AGE}–{MAX_ELIGIBLE_AGE}
              {outOfRangeCount > 0 && ` — ${outOfRangeCount} outside it`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                    {ageData.map((entry) => (
                      <Cell key={entry.label} fill={entry.outOfRange ? AGE_OUT_OF_RANGE_COLOR : AGE_IN_RANGE_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>NGO</CardTitle>
          <CardDescription>Finalists referred by each NGO</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ngoData} margin={{ bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ngoName" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Students" fill={NGO_BAR_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
