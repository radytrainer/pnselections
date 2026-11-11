"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CloudDownload, CloudOff, ClipboardList, Loader2, MessageSquare, PencilLine, Search, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useRole } from "@/hooks/useRole";
import { displayStudentStatus, STUDENT_STATUS_BADGE_CLASSES, type StudentStatus } from "@/lib/constants";
import { downloadForOffline, getBundleInfo, getDownloadedStudents, type BundleInfo } from "@/lib/offline/bundle";
import type { OfflineStudent } from "@/lib/offline/fallback";
import { takeFlash } from "@/lib/offline/store";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

/**
 * Field Mode: the offline entry point for home-visit, exam and interview
 * teams. Download while online, then fill forms without internet; changes
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
  const [limit, setLimit] = useState(PAGE_SIZE);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const province = (s.provinces as { name_en?: string } | null)?.name_en ?? "";
      return `${s.first_name} ${s.last_name} ${s.student_code} ${province}`.toLowerCase().includes(q);
    });
  }, [students, search]);

  const canSocial = can(role, "enterHomeVisitData");
  const canExam = can(role, "enterExamScores");
  const canInterview = can(role, "enterInterviewScores");
  const downloadedAt = info ? new Date(info.downloadedAt) : null;
  const stale = downloadedAt ? Date.now() - downloadedAt.getTime() > 3 * 24 * 60 * 60 * 1000 : false;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Field Mode</h1>
        <p className="text-sm text-muted-foreground">
          Fill home-visit, exam and interview forms without internet. Changes are saved on this device and sync
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
          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name, code or province"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
          </div>

          <ul className="divide-y rounded-lg border">
            {filtered.slice(0, limit).map((s) => {
              const status = displayStudentStatus(s.status as StudentStatus, (s.elimination_reason as string | null) ?? null);
              const waiting = pendingByStudent.get(s.id);
              const province = (s.provinces as { name_en?: string } | null)?.name_en;
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
                      {province ? ` · ${province}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {canSocial && (
                      <Link href={`/field/social-form?studentId=${s.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                        <ClipboardList className="size-3.5" /> Social form
                      </Link>
                    )}
                    {canExam && (
                      <Link href={`/field/exam?studentId=${s.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                        <PencilLine className="size-3.5" /> Exam
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
