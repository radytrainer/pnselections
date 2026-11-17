"use client";

import type { TooltipContentProps } from "recharts";

/**
 * Shared look for every dashboard chart: recessive grid and axes, thin bars
 * with rounded data-ends, one tooltip style. Colors are CSS tokens from
 * globals.css (--viz-*), so light/dark each use their own validated steps.
 */
export const VIZ = {
  series1: "var(--viz-1)",
  series2: "var(--viz-2)",
  series3: "var(--viz-3)",
  good: "var(--viz-good)",
  warning: "var(--viz-warning)",
  critical: "var(--viz-critical)",
} as const;

export const gridProps = { stroke: "var(--border)", strokeDasharray: "0", vertical: false } as const;
export const gridPropsHorizontalBars = { stroke: "var(--border)", strokeDasharray: "0", horizontal: false } as const;

export const axisProps = {
  tick: { fontSize: 12, fill: "var(--muted-foreground)" },
  axisLine: false,
  tickLine: false,
} as const;

/** Hover band behind the bar under the pointer. */
export const cursorProps = { fill: "var(--muted)", opacity: 0.6 } as const;

export function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>;
}
