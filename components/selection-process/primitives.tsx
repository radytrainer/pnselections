"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const nf = new Intl.NumberFormat("en-US");
export const formatNumber = (n: number) => nf.format(n);

/** Small uppercase heading for a block inside a stage card ("Sessions", "Attendance"...). */
export function BlockHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h4>
      {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

/** One number with its caption. `tone` colours numbers that need follow-up. */
export function Metric({
  value,
  label,
  tone = "default",
  emphasis = false,
}: {
  value: number;
  label: string;
  tone?: "default" | "warning" | "danger" | "success";
  /** The block's headline number: drawn larger. */
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2.5",
        tone === "default" && "bg-muted/30",
        tone === "warning" && "border-amber-200 bg-amber-50/70",
        tone === "danger" && "border-red-200 bg-red-50/70",
        tone === "success" && "border-emerald-200 bg-emerald-50/70",
      )}
    >
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold tabular-nums leading-tight",
          emphasis ? "text-2xl" : "text-lg",
          tone === "warning" && "text-amber-700",
          tone === "danger" && "text-red-700",
          tone === "success" && "text-emerald-700",
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

/** Girls / boys split as one proportional bar with a legend. */
export function GenderSplit({ girls, boys }: { girls: number; boys: number }) {
  const total = girls + boys;
  if (total === 0) return <p className="text-xs text-muted-foreground">No gender breakdown yet</p>;
  const girlsPct = (girls / total) * 100;

  return (
    <div className="space-y-1.5">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${girls} girls and ${boys} boys`}
      >
        <div className="h-full bg-pink-400" style={{ width: `${girlsPct}%` }} />
        <div className="h-full bg-blue-400" style={{ width: `${100 - girlsPct}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-pink-400" />
          Girls <span className="font-medium text-foreground tabular-nums">{formatNumber(girls)}</span> (
          {Math.round(girlsPct)}%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-blue-400" />
          Boys <span className="font-medium text-foreground tabular-nums">{formatNumber(boys)}</span> (
          {100 - Math.round(girlsPct)}%)
        </span>
      </div>
    </div>
  );
}

/** "x of y" rate with a bar, e.g. pass rate or attendance turnout. */
export function RateBar({ label, value, total }: { label: string; value: number; total: number }) {
  if (total <= 0) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">Not recorded yet</span>
      </div>
    );
  }
  const p = pct(value, total);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>
          <span className="text-sm font-semibold tabular-nums">{p}%</span>
          <span className="text-muted-foreground tabular-nums">
            {" "}
            · {formatNumber(value)} of {formatNumber(total)}
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, p)}%` }} />
      </div>
    </div>
  );
}

export type CheckItem = { count: number; missingLabel: string; okLabel: string };

/** A short checklist: amber line per open issue, green line when it's done. */
export function Checklist({ items }: { items: CheckItem[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item.missingLabel}
          className={cn(
            "flex items-start gap-2 text-xs",
            item.count > 0 ? "text-amber-800" : "text-emerald-700",
          )}
        >
          {item.count > 0 ? (
            <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-500" />
          )}
          <span>
            {item.count > 0 ? (
              <>
                <span className="font-semibold tabular-nums">{formatNumber(item.count)}</span> {item.missingLabel}
              </>
            ) : (
              item.okLabel
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
