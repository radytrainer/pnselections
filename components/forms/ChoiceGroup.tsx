"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ChoiceGroupLayout = "list" | "grid" | "segmented";

const LAYOUT_CLASSES: Record<ChoiceGroupLayout, string> = {
  list: "flex flex-col gap-2",
  grid: "grid grid-cols-2 gap-2",
  segmented: "grid gap-1.5",
};

/**
 * Large tap-target single-select picker — easier to use than a native
 * <select> on a phone in the field. "segmented" is for short numeric/word
 * scales (e.g. an 0-3 rating); "grid" is for short option labels that don't
 * need full-width rows; "list" (default) is for longer, descriptive labels.
 */
export function ChoiceGroup<T extends string | number>({
  value,
  onChange,
  options,
  layout = "list",
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: { value: T; label: string; points: number }[];
  layout?: ChoiceGroupLayout;
}) {
  const isSegmented = layout === "segmented";

  return (
    <div
      className={cn(LAYOUT_CLASSES[layout])}
      style={isSegmented ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={cn(
              "flex items-center rounded-xl border-2 text-left text-sm transition-all active:scale-[0.98]",
              isSegmented ? "flex-col justify-center gap-0.5 px-2 py-3 text-center" : "justify-between gap-2 px-3.5 py-3",
              selected
                ? "border-primary bg-primary/10 font-medium shadow-sm"
                : "border-border bg-background hover:border-primary/40 hover:bg-muted",
            )}
          >
            {isSegmented ? (
              <>
                <span className="text-base font-semibold">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {opt.points} pt{opt.points === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                    )}
                  >
                    {selected && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span>{opt.label}</span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {opt.points} pt{opt.points === 1 ? "" : "s"}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
