"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getActiveCycle, listCycles, type Cycle } from "@/services/lookupService";

/**
 * Defaults cycle-scoped list/report pages to the active selection cycle so
 * last year's students don't clutter this year's view, while still letting
 * staff pick a past cycle from the dropdown for comparison/reporting — the
 * data itself is never hidden or deleted, just filtered by default.
 */
export function useCycleFilter() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listCycles(), getActiveCycle()])
      .then(([allCycles, active]) => {
        setCycles(allCycles ?? []);
        setCycleId(active?.id ?? allCycles?.[0]?.id ?? "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load selection cycles"))
      .finally(() => setLoading(false));
  }, []);

  return { cycles, cycleId, setCycleId, loading };
}
