"use client";

import { useCallback, useEffect, useState } from "react";
import { getAnnualReport, type ReportSource } from "@/services/annualReportService";
import { listInformationSessions, type InformationSession } from "@/services/informationSessionService";
import { getExamData } from "@/services/writtenExamService";
import type { ExamData } from "@/features/written-exam/scoring";

export type ReportData = { source: ReportSource; sessions: InformationSession[]; exam: ExamData | null };

/** Everything the Annual Report needs for one cycle (null cycleId = nothing to load). */
export function useReportData(cycleId: string | null, enabled = true) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    setError(null);
    try {
      const [source, sessions, exam] = await Promise.all([
        getAnnualReport(cycleId),
        listInformationSessions(cycleId).catch(() => [] as InformationSession[]),
        getExamData(cycleId).catch(() => null),
      ]);
      setData({ source, sessions, exam });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the report");
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    if (!enabled) return;
    setData(null);
    void load();
  }, [load, enabled]);

  return { data, error, loading, reload: load };
}
