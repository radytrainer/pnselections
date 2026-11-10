"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Cycle } from "@/services/lookupService";

/** Shared cycle-filter dropdown for every page scoped by useCycleFilter. */
export function CycleSelect({
  cycles,
  value,
  onChange,
  allowAll = false,
  className = "w-full sm:w-56",
}: {
  cycles: Cycle[];
  value: string;
  onChange: (cycleId: string) => void;
  /** Adds an "All Cycles" option (empty string) for pages where viewing every year at once is a real use case (comparisons/reports). */
  allowAll?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select cycle">
          {(v: string) => (v ? cycles.find((c) => c.id === v)?.name ?? "Select cycle" : "All Cycles")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="">All Cycles</SelectItem>}
        {cycles.map((cycle) => (
          <SelectItem key={cycle.id} value={cycle.id}>
            {cycle.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
