"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty, ChartTooltip, VIZ, axisProps, cursorProps, gridPropsHorizontalBars } from "@/components/charts/theme";

/** One-line category label, shortened to fit the label column (full name in the tooltip / <title>). */
function CategoryTick({ x, y, payload, maxChars }: { x?: number; y?: number; payload?: { value: string }; maxChars: number }) {
  const full = String(payload?.value ?? "");
  const text = full.length > maxChars ? `${full.slice(0, maxChars - 1).trimEnd()}…` : full;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--foreground)">
      <title>{full}</title>
      {text}
    </text>
  );
}

/**
 * Horizontal ranked bars — one series, long category names readable on the
 * left, value printed at the end of each bar. Height grows with the number
 * of rows so no label is ever dropped.
 */
export function RankedBarChart({
  data,
  categoryKey,
  valueKey,
  valueName,
  empty,
  color = VIZ.series1,
  labelWidth = 140,
}: {
  data: object[];
  categoryKey: string;
  valueKey: string;
  valueName: string;
  empty: string;
  color?: string;
  labelWidth?: number;
}) {
  if (data.length === 0) return <ChartEmpty>{empty}</ChartEmpty>;
  const height = Math.max(200, data.length * 30 + 24);
  const maxChars = Math.floor(labelWidth / 7);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }} barCategoryGap={6}>
          <CartesianGrid {...gridPropsHorizontalBars} />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis
            type="category"
            dataKey={categoryKey}
            width={labelWidth}
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={<CategoryTick maxChars={maxChars} />}
          />
          <Tooltip cursor={cursorProps} content={<ChartTooltip />} />
          <Bar dataKey={valueKey} name={valueName} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
            <LabelList dataKey={valueKey} position="right" offset={6} fontSize={11} fill="var(--muted-foreground)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
