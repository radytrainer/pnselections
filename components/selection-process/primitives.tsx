"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small bordered number+caption tile used to break a count down (Done/Planned/etc.) without resorting to a wall of bullet text. */
export function MetricTile({
  value,
  label,
  tone = "default",
}: {
  value: number;
  label: string;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 px-3 py-2 text-center",
        tone === "warning" && "border-amber-200 bg-amber-50",
        tone === "danger" && "border-red-200 bg-red-50",
      )}
    >
      <p
        className={cn(
          "text-xl font-semibold leading-tight",
          tone === "warning" && "text-amber-700",
          tone === "danger" && "text-red-700",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/** Proportional boys/girls bar — communicates the split at a glance instead of two separate percentage lines. */
export function GenderSplit({ girls, boys }: { girls: number; boys: number }) {
  const total = girls + boys;
  const girlsPct = total > 0 ? (girls / total) * 100 : 50;
  const boysPct = total > 0 ? 100 - girlsPct : 50;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-pink-400" style={{ width: `${girlsPct}%` }} />
        <div className="h-full bg-blue-400" style={{ width: `${boysPct}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-pink-400" />
          {girls} girls{total > 0 && ` (${Math.round(girlsPct)}%)`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-blue-400" />
          {boys} boys{total > 0 && ` (${Math.round(boysPct)}%)`}
        </span>
      </div>
    </div>
  );
}

/** The "N still missing" (amber) vs "All done" (green) pattern repeated across every card — now an actual chip instead of plain colored text. */
export function StatusChip({
  count,
  missingLabel,
  okLabel,
}: {
  count: number;
  missingLabel: string;
  okLabel: string;
}) {
  if (count > 0) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <AlertTriangle className="size-3.5 shrink-0" />
        {count} {missingLabel}
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
      <CheckCircle2 className="size-3.5 shrink-0" />
      {okLabel}
    </div>
  );
}

/** Thin horizontal progress bar for pass-rate style ratios. */
export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
