"use client";

import { RankedBarChart } from "@/components/charts/RankedBarChart";
import type { ProvinceStat } from "@/services/dashboardService";

export function ProvinceChart({ stats }: { stats: ProvinceStat[] }) {
  return (
    <RankedBarChart
      data={stats}
      categoryKey="provinceName"
      valueKey="studentCount"
      valueName="Students"
      empty="No province data yet."
      labelWidth={120}
    />
  );
}
