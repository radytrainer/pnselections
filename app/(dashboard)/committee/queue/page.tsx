"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw } from "lucide-react";
import {
  approveCommitteeDecision,
  listCommitteeQueue,
  listPendingApprovals,
  type CommitteeQueueItem,
  type PendingApproval,
} from "@/services/committeeService";
import { getMyProfile } from "@/services/userService";
import { listHomeVisitors } from "@/services/studentService";
import { listProvinces } from "@/services/lookupService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/components/layout/RoleGate";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { CommitteeQueueCard } from "@/components/committee/CommitteeQueueCard";
import { getSignedStudentDocumentUrls, pickLatestPhotoPath } from "@/lib/storage";

// home_visit_team doesn't decide — "Finished" clears their own cases from
// the active queue once they've seen the committee's ratings. Local-only
// (per browser); doesn't affect what selection_team/super_admin see.
const FINISHED_STORAGE_KEY = "committee-queue-finished-cases";

// Filters are lost on remount — e.g. opening a student card and going back —
// because Next.js remounts this page from scratch rather than restoring it
// from cache. Persisting to sessionStorage means "back" lands on the same filters.
const FILTER_STATE_KEY = "committee-queue-filter-state";

type StoredFilterState = {
  provinceId: string;
  visitorFilter: string;
  eliminatedFilter: string;
  search: string;
};

export default function CommitteeQueuePage() {
  const { user } = useAuth();
  const { role } = useRole();
  const { cycles, cycleId, setCycleId, loading: cyclesLoading } = useCycleFilter();
  // Only the newest request may update the list (switching cycles quickly must not show an older answer).
  const loadSeq = useRef(0);
  const canSeeQueue = can(role, "viewCommitteeRatings") || can(role, "rateCommitteeCandidate");
  const isHomeVisit = role === "home_visit_team";
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [queue, setQueue] = useState<CommitteeQueueItem[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finishedIds, setFinishedIds] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<{ id: string; name_en: string }[]>([]);
  const [homeVisitors, setHomeVisitors] = useState<string[]>([]);
  const [provinceId, setProvinceId] = useState<string>("");
  const [visitorFilter, setVisitorFilter] = useState<string>("");
  const [eliminatedFilter, setEliminatedFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filtersRestored, setFiltersRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTER_STATE_KEY);
      if (raw) {
        const saved: Partial<StoredFilterState> = JSON.parse(raw);
        if (saved.provinceId) setProvinceId(saved.provinceId);
        if (saved.visitorFilter) setVisitorFilter(saved.visitorFilter);
        if (saved.eliminatedFilter) setEliminatedFilter(saved.eliminatedFilter);
        if (saved.search) setSearch(saved.search);
      }
    } catch {
      // ignore malformed/inaccessible storage — falls back to defaults
    }
    setFiltersRestored(true);
  }, []);

  useEffect(() => {
    if (!filtersRestored) return;
    const state: StoredFilterState = { provinceId, visitorFilter, eliminatedFilter, search };
    sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
  }, [filtersRestored, provinceId, visitorFilter, eliminatedFilter, search]);

  useEffect(() => {
    if (!user) return;
    getMyProfile(user.uid).then((profile) => setMyUserId(profile?.id ?? null));
  }, [user]);

  useEffect(() => {
    listProvinces().then(setProvinces).catch(() => toast.error("Failed to load provinces"));
  }, []);

  useEffect(() => {
    if (cyclesLoading) return;
    let cancelled = false;
    listHomeVisitors(cycleId || undefined)
      .then((names) => {
        if (!cancelled) setHomeVisitors(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cycleId, cyclesLoading]);

  useEffect(() => {
    if (!isHomeVisit) return;
    try {
      setFinishedIds(JSON.parse(localStorage.getItem(FINISHED_STORAGE_KEY) ?? "[]"));
    } catch {
      setFinishedIds([]);
    }
  }, [isHomeVisit]);

  function isOwnStudent(student: CommitteeQueueItem) {
    return myUserId != null && student.social_assessments.some((sa) => sa.visitor_id === myUserId);
  }

  function handleFinish(studentId: string) {
    const next = [...finishedIds, studentId];
    setFinishedIds(next);
    localStorage.setItem(FINISHED_STORAGE_KEY, JSON.stringify(next));
    toast.success("Case marked as finished");
  }

  function handleUnfinish(studentId: string) {
    const next = finishedIds.filter((id) => id !== studentId);
    setFinishedIds(next);
    localStorage.setItem(FINISHED_STORAGE_KEY, JSON.stringify(next));
    toast.success("Case returned to queue");
  }

  const filteredQueue = queue.filter((s) => {
    if (provinceId === "__none__" && s.province_id) return false;
    if (provinceId && provinceId !== "__none__" && s.province_id !== provinceId) return false;
    if (visitorFilter && !s.social_assessments.some((sa) => sa.visitor_name === visitorFilter)) return false;
    if (eliminatedFilter === "only" && !s.elimination_reason) return false;
    if (eliminatedFilter === "hide" && s.elimination_reason) return false;
    if (search) {
      const query = search.trim().toLowerCase();
      const name = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (!name.includes(query) && !s.student_code.toLowerCase().includes(query)) return false;
    }
    return true;
  });
  const activeQueue = isHomeVisit ? filteredQueue.filter((s) => !finishedIds.includes(s.id)) : filteredQueue;
  const finishedQueue = isHomeVisit ? filteredQueue.filter((s) => finishedIds.includes(s.id)) : [];

  const load = useCallback(() => {
    if (cyclesLoading) return Promise.resolve();
    const seq = ++loadSeq.current;
    setLoading(true);
    return Promise.all([listCommitteeQueue(cycleId || undefined), listPendingApprovals(cycleId || undefined)])
      .then(async ([q, a]) => {
        if (seq !== loadSeq.current) return;
        setQueue(q);
        setApprovals(a);
        const photoPaths = q.map((s) => pickLatestPhotoPath(s.student_documents)).filter((p): p is string => !!p);
        setPhotoUrls(await getSignedStudentDocumentUrls(photoPaths));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load committee queue"))
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false);
      });
  }, [cycleId, cyclesLoading]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApproval(decisionId: string, approve: boolean) {
    setBusyId(decisionId);
    try {
      await approveCommitteeDecision(decisionId, approve);
      toast.success(approve ? "Decision approved" : "Decision sent back");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update approval");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Committee Queue</h1>
          <p className="text-sm text-muted-foreground">
            Students ready for a final decision, and decisions awaiting sign-off.
          </p>
        </div>
        <CycleSelect cycles={cycles} value={cycleId} allowAll onChange={setCycleId} className="w-48" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search student name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={provinceId} onValueChange={(value) => setProvinceId(value ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All provinces">
              {(value: string) => {
                if (!value) return "All provinces";
                if (value === "__none__") return "No province set";
                return provinces.find((p) => p.id === value)?.name_en ?? "All provinces";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All provinces</SelectItem>
            <SelectItem value="__none__">No province set</SelectItem>
            {provinces.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={visitorFilter} onValueChange={(value) => setVisitorFilter(value ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All visitors">
              {(value: string) => value || "All visitors"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All visitors</SelectItem>
            {homeVisitors.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eliminatedFilter} onValueChange={(value) => setEliminatedFilter(value ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All students">
              {(value: string) => {
                if (value === "only") return "Eliminated only";
                if (value === "hide") return "Hide eliminated";
                return "All students";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All students</SelectItem>
            <SelectItem value="only">Eliminated only</SelectItem>
            <SelectItem value="hide">Hide eliminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {canSeeQueue && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Awaiting Decision ({activeQueue.length})</h2>
          {activeQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students waiting on a committee decision.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {activeQueue.map((student) => {
                const photoPath = pickLatestPhotoPath(student.student_documents);
                const canFinishThis = isHomeVisit && isOwnStudent(student);
                return (
                  <CommitteeQueueCard
                    key={student.id}
                    student={student}
                    photoUrl={photoPath ? photoUrls[photoPath] ?? null : null}
                    actions={
                      canFinishThis && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 rounded-lg"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleFinish(student.id);
                          }}
                        >
                          <CheckCircle2 className="size-3.5" />
                          Finished
                        </Button>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {isHomeVisit && finishedQueue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-muted-foreground">Finished Cases ({finishedQueue.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {finishedQueue.map((student) => {
              const photoPath = pickLatestPhotoPath(student.student_documents);
              return (
                <CommitteeQueueCard
                  key={student.id}
                  student={student}
                  photoUrl={photoPath ? photoUrls[photoPath] ?? null : null}
                  muted
                  actions={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 rounded-lg"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnfinish(student.id);
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Undo
                    </Button>
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      <RoleGate capability="approveCommitteeDecision">
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Awaiting Approval ({approvals.length})</h2>
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions waiting on approval.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {approvals.map((approval) => (
                <Card key={approval.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {approval.students ? (
                        <Link href={`/committee/${approval.students.id}`} className="hover:underline">
                          {approval.students.first_name} {approval.students.last_name}
                        </Link>
                      ) : (
                        "Unknown student"
                      )}
                    </CardTitle>
                    <CardDescription className="capitalize">
                      Decision: {approval.decision ?? "—"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === approval.id}
                      onClick={() => handleApproval(approval.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === approval.id}
                      onClick={() => handleApproval(approval.id, false)}
                    >
                      Send Back
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </RoleGate>
    </div>
  );
}
