"use client";

import { cn } from "@/lib/utils";

/** Plain buttons instead of a Select/listbox — no portal, no popup
 * positioning, nothing for the Leaflet map underneath to ever contend with.
 * Each option is its own native <button onClick>. */
export function MapFilterGroup<T extends string>({
  value,
  options,
  labels,
  onChange,
  vertical = false,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  vertical?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm",
        vertical ? "flex-col items-stretch" : "items-center",
      )}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            vertical && "block w-full text-left",
            value === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
