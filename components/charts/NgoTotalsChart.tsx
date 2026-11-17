"use client";

import { RankedBarChart } from "@/components/charts/RankedBarChart";
import type { NgoTotalStat } from "@/services/dashboardService";

export function NgoTotalsChart({ stats }: { stats: NgoTotalStat[] }) {
  return (
    <RankedBarChart
      data={stats}
      categoryKey="ngoName"
      valueKey="studentCount"
      valueName="Students"
      empty="No NGO referral data yet."
      labelWidth={150}
    />
  );
}
