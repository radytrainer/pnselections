"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NgoTotalStat } from "@/services/dashboardService";

export function NgoTotalsChart({ stats }: { stats: NgoTotalStat[] }) {
  if (stats.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No NGO referral data yet.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stats} margin={{ bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="ngoName"
            tick={{ fontSize: 11 }}
            angle={-25}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="studentCount" name="Students" fill="#0891b2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
