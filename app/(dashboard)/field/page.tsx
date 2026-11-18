"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CloudDownload, CloudOff, ClipboardList, Loader2, MessageSquare, Search, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useRole } from "@/hooks/useRole";
import { displayStudentStatus, isOutOfProcess, STUDENT_STATUS_BADGE_CLASSES, type StudentStatus } from "@/lib/constants";
import { downloadForOffline, getBundleInfo, getDownloadedStudents, type BundleInfo } from "@/lib/offline/bundle";
import type { OfflineStudent } from "@/lib/offline/fallback";
import { takeFlash } from "@/lib/offline/store";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
/** Select value for students with no province set. */
const NO_PROVINCE = "__none__";

const provinceOf = (s: OfflineStudent) => (s.provinces as { name_en?: string } | null)?.name_en ?? "";

/**
 * Field Mode: the offline entry point for home-visit and interview teams.
 * (Exam scores need a connection — they're entered on the student's page.)
 * Download while online, then fill forms without internet; changes
 * are kept on the device and synced automatically when the connection
 * returns (see lib/offline/).
 */
export default function FieldModePage() {
  const { user } = useAuth();
  const { role } = useRole();
  const { online, pending, failed } = useOfflineStatus();
  const [info, setInfo] = useState<BundleInfo | null>(null);
  const [students, setStudents] = useState<OfflineStudent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [showOut, setShowOut] = useState(false);

  const load = useCallback(async () => {
    const [bundleInfo, list] = await Promise.all([getBundleInfo(), getDownloadedStudents()]);
    setInfo(bundleInfo ?? null);
    setStudents(list ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const flash = takeFlash();
    if (flash) toast.success(flash);
  }, [load]);

  async function handleDownload() {
    setDownloading("Starting…");
    try {
      const result = await downloadForOffline(setDownloading, user?.uid);
      toast.success(`${result.studentCount} students are now available offline on this device`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  const pendingByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of [...pending, ...failed]) {
      if (item.studentId) map.set(item.studentId, (map.get(item.studentId) ?? 0) + 1);
    }
    return map;
  }, [pending, failed]);

  // Provinces present in the downloaded students (works offline — no lookup needed), with counts.
  const provinceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      const name = provinceOf(s) || NO_PROVINCE;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name === NO_PROVINCE ? 1 : b.name === NO_PROVINCE ? -1 : a.name.localeCompare(b.name)));
  }, [students]);

  // Students who failed the written exam or the interview are out of the process: hidden unless asked for.
  const outCount = useMemo(() => students.filter((s) => isOutOfProcess(s.status as string, s.elimination_reason as string | null)).length, [students]);
  const filtered = useMemo(() => {
    const q = search.trim().replace(/\s+/g, " ").toLowerCase();
    return students.filter((s) => {
      if (!showOut && isOutOfProcess(s.status as string, s.elimination_reason as string | null)) return false;
      const p = provinceOf(s);
      if (province && (province === NO_PROVINCE ? p !== "" : p !== province)) return false;
      if (!q) return true;
      // Full name either way round, code, or province.
      return `${s.first_name} ${s.last_name}\n${s.last_name} ${s.first_name}\n${s.student_code}\n${p}`
        .toLowerCase()
        .includes(q);
    });
  }, [students, search, province, showOut]);

  const canSocial = can(role, "enterHomeVisitData");
  const canInterview = can(role, "enterInterviewScores");
  const downloadedAt = info ? new Date(info.downloadedAt) : null;
  const stale = downloadedAt ? Date.now() - downloadedAt.getTime() > 3 * 24 * 60 * 60 * 1000 : false;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Field Mode</h1>
        <p className="text-sm text-muted-foreground">
          Fill social forms and interviews without internet. Changes are saved on this device and sync
          automatically when you&apos;re back online.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {online ? <Wifi className="size-4 text-green-600" /> : <CloudOff className="size-4 text-amber-600" />}
              {online ? "Online" : "Offline"}
            </CardTitle>
            <CardDescription>
              {downloadedAt
                ? `${info?.studentCount} students downloaded ${downloadedAt.toLocaleString()}`
                : "Nothing downloaded on this device yet."}
              {stale && " — download again to get the latest data."}
            </CardDescription>
            {(pending.length > 0 || failed.length > 0) && (
              <p className="text-sm">
                {pending.length > 0 && <span className="text-sky-700">{pending.length} change(s) waiting to sync. </span>}
                {failed.length > 0 && (
                  <span className="text-red-600">{failed.length} change(s) rejected — see the sync menu at the top.</span>
                )}
              </p>
            )}
          </div>
          <Button onClick={handleDownload} disabled={!online || downloading !== null}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
            {downloading ?? (info ? "Download again" : "Download for offline")}
          </Button>
        </CardHeader>
        {!online && !info && loaded && (
          <CardContent className="text-sm text-amber-700">
            Connect to the internet once and press &quot;Download for offline&quot; before going to the field.
          </CardContent>
        )}
      </Card>

      {students.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name or code"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
              />
            </div>
            <Select
              value={province}
              onValueChange={(value) => {
                setProvince(value ?? "");
                setLimit(PAGE_SIZE);
              }}
            >
              <SelectTrigger className={cn("w-full sm:w-56", province && "border-primary/40 bg-primary/5")} aria-label="Filter by province">
                <SelectValue placeholder="All provinces">
                  {(value: string) =>
                    !value ? "All provinces" : value === NO_PROVINCE ? "No province" : value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All provinces ({students.length})</SelectItem>
                {provinceOptions.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name === NO_PROVINCE ? "No province" : p.name} ({p.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || province) && (
              <span className="text-sm text-muted-foreground sm:ml-1">
                {filtered.length} of {students.length}
              </span>
            )}
          </div>
          {outCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {showOut
                ? `Showing ${outCount} student${outCount === 1 ? "" : "s"} who failed the written exam or the interview.`
                : `${outCount} student${outCount === 1 ? "" : "s"} who failed the written exam or the interview ${outCount === 1 ? "is" : "are"} hidden.`}{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setShowOut((v) => !v)}>
                {showOut ? "Hide them" : "Show"}
              </button>
            </p>
          )}

          <ul className="divide-y rounded-lg border">
            {filtered.slice(0, limit).map((s) => {
              const status = displayStudentStatus(s.status as StudentStatus, (s.elimination_reason as string | null) ?? null);
              const waiting = pendingByStudent.get(s.id);
              const rowProvince = provinceOf(s);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {s.first_name} {s.last_name}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", STUDENT_STATUS_BADGE_CLASSES[status])}>
                        {status.replace(/_/g, " ")}
                      </span>
                      {waiting && (
                        <Badge variant="outline" className="border-sky-300 text-sky-700">
                          {waiting} unsynced
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.student_code}
                      {rowProvince ? ` · ${rowProvince}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {canSocial && (
                      <Link href={`/field/social-form?studentId=${s.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                        <ClipboardList className="size-3.5" /> Social form
                      </Link>
                    )}
                    {canInterview && (
                      <Link href={`/field/interview?studentId=${s.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                        <MessageSquare className="size-3.5" /> Interview
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="p-4 text-sm text-muted-foreground">No students match.</li>}
          </ul>
          {filtered.length > limit && (
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Show more ({filtered.length - limit} more)
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Student data downloaded here stays on this device until you sign out. Don&apos;t use Field Mode on a shared
        computer.
      </p>
    </div>
  );
}
