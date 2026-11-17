"use client";

import { RankedBarChart } from "@/components/charts/RankedBarChart";
import type { VisitorStat } from "@/services/dashboardService";

export function VisitorStatsChart({ stats }: { stats: VisitorStat[] }) {
  const sorted = [...stats].sort((a, b) => b.studentCount - a.studentCount);
  return (
    <RankedBarChart
      data={sorted}
      categoryKey="visitorName"
      valueKey="studentCount"
      valueName="Students visited"
      empty="No social forms recorded yet."
      labelWidth={130}
    />
  );
}
