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
import type { VisitorStat } from "@/services/dashboardService";

export function VisitorStatsChart({ stats }: { stats: VisitorStat[] }) {
  if (stats.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No social forms recorded yet.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stats} margin={{ bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="visitorName"
            tick={{ fontSize: 12 }}
            angle={-25}
            textAnchor="end"
            interval={0}
            height={50}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="studentCount" name="Students Visited" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
