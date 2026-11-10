"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertOctagon,
  CheckCircle2,
  ImageIcon,
  Mars,
  Rainbow,
  RotateCcw,
  Users,
  Venus,
  type LucideIcon,
} from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  isFailedHomeVisit,
  type SocialFormCategory,
} from "@/features/social-form/scoring";
import { StudentAvatar } from "@/components/students/StudentAvatar";
import { getSignedStudentDocumentUrls, pickLatestPhotoPath } from "@/lib/storage";
import { CARD_COLOR_STYLES, type CardColor } from "@/lib/cardColors";
import { cn } from "@/lib/utils";

/** Tints each card by gender so a mixed grid is scannable at a glance. */
const GENDER_META: Record<string, { icon: LucideIcon; color: CardColor }> = {
  male: { icon: Mars, color: "blue" },
  female: { icon: Venus, color: "pink" },
  "lgbtqia+": { icon: Rainbow, color: "violet" },
};

function genderStyle(gender: string) {
  const meta = GENDER_META[gender] ?? { icon: Users, color: "slate" as CardColor };
  return { icon: meta.icon, ...CARD_COLOR_STYLES[meta.color] };
}

/** Eliminated cases sent to committee anyway still need to stand out from the gender tint. */
function cardStyle(student: { gender: string; elimination_reason: string | null }) {
  if (student.elimination_reason) return { icon: AlertOctagon, ...CARD_COLOR_STYLES.orange };
  return genderStyle(student.gender);
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  strongly_recommend: "Strongly recommends",
  recommend: "Recommends",
  neutral: "Neutral",
  not_recommend: "Does not recommend",
};

function ratingSummary(student: CommitteeQueueItem) {
  if (student.committee_ratings.length === 0) return "No ratings yet";
  const raters = new Set(student.committee_ratings.map((r) => r.rated_by)).size;
  const avg = student.committee_ratings.reduce((sum, r) => sum + r.score, 0) / student.committee_ratings.length;
  return `${avg.toFixed(1)}★ avg · ${raters} member${raters === 1 ? "" : "s"} rated`;
}

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
  const { cycles, cycleId, setCycleId } = useCycleFilter();
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
    listHomeVisitors(cycleId || undefined)
      .then(setHomeVisitors)
      .catch(() => {});
  }, [cycleId]);

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
    setLoading(true);
    return Promise.all([listCommitteeQueue(cycleId || undefined), listPendingApprovals(cycleId || undefined)])
      .then(async ([q, a]) => {
        setQueue(q);
        setApprovals(a);
        const photoPaths = q.map((s) => pickLatestPhotoPath(s.student_documents)).filter((p): p is string => !!p);
        setPhotoUrls(await getSignedStudentDocumentUrls(photoPaths));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load committee queue"))
      .finally(() => setLoading(false));
  }, [cycleId]);

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeQueue.map((student) => {
                const socialAssessment = student.social_assessments[0] ?? null;
                const photoPath = pickLatestPhotoPath(student.student_documents);
                const initials = `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase();
                const canFinishThis = isHomeVisit && isOwnStudent(student);
                const isEliminated = !!student.elimination_reason;
                const { icon: GenderIcon, bg, ring, iconBg, iconText } = cardStyle(student);

                return (
                  <Link key={student.id} href={`/committee/${student.id}`} className="block">
                    <Card
                      className={cn(
                        "relative h-full border-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                        bg,
                        isEliminated ? "ring-2" : "ring-1",
                        ring,
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-3 right-3 flex size-6 items-center justify-center rounded-full",
                          iconBg,
                          iconText,
                        )}
                      >
                        <GenderIcon className="size-3.5" />
                      </div>
                      <CardHeader className="flex flex-row items-start gap-3">
                        <StudentAvatar
                          photoPath={photoPath}
                          signedUrl={photoPath ? photoUrls[photoPath] ?? null : null}
                          initials={initials}
                          size="size-10"
                        />
                        <div>
                          <CardTitle className="text-base hover:underline">
                            {student.first_name} {student.last_name}
                          </CardTitle>
                          <CardDescription>
                            {student.student_code} · {student.provinces?.name_en ?? "No province"} ·{" "}
                            {student.school_partners?.school_name ?? "No school"}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs text-muted-foreground">
                        {isEliminated && (
                          <div className="flex items-start gap-1.5 rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                            <AlertOctagon className="mt-0.5 size-3.5 shrink-0" />
                            <span>Eliminated: {student.elimination_reason}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {socialAssessment ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                isFailedHomeVisit(socialAssessment.final_score, socialAssessment.manual_failed)
                                  ? "bg-red-100 text-red-700"
                                  : CATEGORY_BADGE_CLASSES[socialAssessment.category as SocialFormCategory],
                              )}
                            >
                              {isFailedHomeVisit(socialAssessment.final_score, socialAssessment.manual_failed)
                                ? "Failed Home Visit"
                                : CATEGORY_LABELS[socialAssessment.category as SocialFormCategory]}{" "}
                              · {socialAssessment.final_score}
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">No social form</span>
                          )}
                          <span>GPA: <span className="text-foreground">{student.gpa ?? "—"}</span></span>
                        </div>
                        <p>
                          Exam:{" "}
                          <span className="text-foreground">
                            {student.exam_results ? student.exam_results.total_score : "Pending"}
                          </span>{" "}
                          · Interview:{" "}
                          <span className="text-foreground">
                            {student.interviews?.recommendation
                              ? RECOMMENDATION_LABELS[student.interviews.recommendation]
                              : "Pending"}
                          </span>
                        </p>
                        <p className="font-medium text-foreground">{ratingSummary(student)}</p>
                      </CardContent>
                      {(student.photo_drive_url || canFinishThis) && (
                        <CardContent className="flex gap-2 pt-0">
                          {student.photo_drive_url && (
                            <a
                              href={student.photo_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={buttonVariants({ size: "sm", variant: "outline", className: "flex-1 gap-1.5" })}
                            >
                              <ImageIcon className="size-3.5" />
                              View Photos
                            </a>
                          )}
                          {canFinishThis && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1.5"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleFinish(student.id);
                              }}
                            >
                              <CheckCircle2 className="size-3.5" />
                              Finished
                            </Button>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isHomeVisit && finishedQueue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-muted-foreground">Finished Cases ({finishedQueue.length})</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {finishedQueue.map((student) => {
              const socialAssessment = student.social_assessments[0] ?? null;
              const photoPath = pickLatestPhotoPath(student.student_documents);
              const initials = `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase();
              const isEliminated = !!student.elimination_reason;
              const { icon: GenderIcon, bg, ring, iconBg, iconText } = cardStyle(student);

              return (
                <Link key={student.id} href={`/committee/${student.id}`} className="block opacity-60">
                  <Card className={cn("relative h-full border-0 shadow-sm", isEliminated ? "ring-2" : "ring-1", bg, ring)}>
                    <div
                      className={cn(
                        "absolute top-3 right-3 flex size-6 items-center justify-center rounded-full",
                        iconBg,
                        iconText,
                      )}
                    >
                      <GenderIcon className="size-3.5" />
                    </div>
                    <CardHeader className="flex flex-row items-start gap-3">
                      <StudentAvatar
                        photoPath={photoPath}
                        signedUrl={photoPath ? photoUrls[photoPath] ?? null : null}
                        initials={initials}
                        size="size-10"
                      />
                      <div>
                        <CardTitle className="text-base hover:underline">
                          {student.first_name} {student.last_name}
                        </CardTitle>
                        <CardDescription>
                          {student.student_code} · {student.provinces?.name_en ?? "No province"} ·{" "}
                          {student.school_partners?.school_name ?? "No school"}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      {isEliminated && (
                        <div className="flex items-start gap-1.5 rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                          <AlertOctagon className="mt-0.5 size-3.5 shrink-0" />
                          <span>Eliminated: {student.elimination_reason}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {socialAssessment ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              isFailedHomeVisit(socialAssessment.final_score, socialAssessment.manual_failed)
                                ? "bg-red-100 text-red-700"
                                : CATEGORY_BADGE_CLASSES[socialAssessment.category as SocialFormCategory],
                            )}
                          >
                            {isFailedHomeVisit(socialAssessment.final_score, socialAssessment.manual_failed)
                              ? "Failed Home Visit"
                              : CATEGORY_LABELS[socialAssessment.category as SocialFormCategory]}{" "}
                            · {socialAssessment.final_score}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">No social form</span>
                        )}
                        <span>GPA: <span className="text-foreground">{student.gpa ?? "—"}</span></span>
                      </div>
                      <p className="font-medium text-foreground">{ratingSummary(student)}</p>
                    </CardContent>
                    <CardContent className="flex gap-2 pt-0">
                      {student.photo_drive_url && (
                        <a
                          href={student.photo_drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={buttonVariants({ size: "sm", variant: "outline", className: "flex-1 gap-1.5" })}
                        >
                          <ImageIcon className="size-3.5" />
                          View Photos
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 gap-1.5"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnfinish(student.id);
                        }}
                      >
                        <RotateCcw className="size-3.5" />
                        Undo Finish
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
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
