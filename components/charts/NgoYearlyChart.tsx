"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NgoYearlyStat } from "@/services/ngoService";
import { ChartEmpty, ChartTooltip, VIZ, axisProps, cursorProps, gridProps } from "@/components/charts/theme";

export function NgoYearlyChart({ stats }: { stats: NgoYearlyStat[] }) {
  const [yearFilter, setYearFilter] = useState<string>("");
  const [ngoFilter, setNgoFilter] = useState<string>("");

  const years = useMemo(
    () => Array.from(new Set(stats.map((s) => s.year))).sort((a, b) => a - b),
    [stats],
  );
  const ngoOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of stats) seen.set(s.ngoId, s.ngoName);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [stats]);

  const chartData = useMemo(() => {
    let rows = stats;
    if (ngoFilter) rows = rows.filter((r) => r.ngoId === ngoFilter);
    if (yearFilter) rows = rows.filter((r) => r.year === Number(yearFilter));

    if (ngoFilter && !yearFilter) {
      return rows.map((r) => ({ label: String(r.year), referred: r.referred, selected: r.selected }));
    }
    if (!ngoFilter && yearFilter) {
      return rows.map((r) => ({ label: r.ngoName, referred: r.referred, selected: r.selected }));
    }
    if (ngoFilter && yearFilter) {
      return rows.map((r) => ({
        label: `${r.ngoName} (${r.year})`,
        referred: r.referred,
        selected: r.selected,
      }));
    }

    const byYear = new Map<number, { referred: number; selected: number }>();
    for (const r of rows) {
      const acc = byYear.get(r.year) ?? { referred: 0, selected: 0 };
      acc.referred += r.referred;
      acc.selected += r.selected;
      byYear.set(r.year, acc);
    }
    return Array.from(byYear.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, v]) => ({ label: String(year), ...v }));
  }, [stats, ngoFilter, yearFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={yearFilter} onValueChange={(value) => setYearFilter(value ?? "")}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="All Years">{(value: string) => value || "All Years"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ngoFilter} onValueChange={(value) => setNgoFilter(value ?? "")}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="All NGOs">
              {(value: string) => (value ? ngoOptions.find((n) => n.id === value)?.name : "All NGOs")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All NGOs</SelectItem>
            {ngoOptions.map((ngo) => (
              <SelectItem key={ngo.id} value={ngo.id}>
                {ngo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length === 0 ? (
        <ChartEmpty>No referral data yet.</ChartEmpty>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={cursorProps} content={<ChartTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                height={28}
                wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
              />
              <Bar dataKey="referred" name="Referred" fill={VIZ.series1} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="selected" name="Selected" fill={VIZ.series2} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
