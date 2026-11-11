"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { differenceInYears } from "date-fns";
import {
  MapPin,
  Building2,
  HeartPulse,
  School,
  UserRound,
  Cake,
  GraduationCap,
  type LucideIcon,
  CheckCircle2,
  Clock,
  XCircle,
  AlertOctagon,
  UserX,
  ImageIcon,
} from "lucide-react";
import {
  getCommitteeDossier,
  recordCommitteeDecision,
  subscribeToCommitteeRatings,
  type CommitteeDossier,
} from "@/services/committeeService";
import { getMyProfile } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CommitteeRatingPanel } from "@/components/committee/CommitteeRatingPanel";
import { RatingAverageChart } from "@/components/committee/RatingAverageChart";
import { SocialFormSummary } from "@/components/committee/SocialFormSummary";
import {
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  isFailedHomeVisit,
  type SocialFormCategory,
} from "@/features/social-form/scoring";
import { HEALTH_OPTS, MAJOR_OPTS, labelFor } from "@/features/social-form/labels";
import { StudentAvatar } from "@/components/students/StudentAvatar";
import { pickLatestPhotoPath } from "@/lib/storage";
import { cn } from "@/lib/utils";

const POOR_LEVELS = ["A+", "A", "A-", "B+", "B", "B-"] as const;
type PoorLevel = (typeof POOR_LEVELS)[number];

const DECISION_BANNER: Record<string, { icon: typeof CheckCircle2; classes: string }> = {
  selected: { icon: CheckCircle2, classes: "bg-green-50 text-green-700 border-green-200" },
  waitlisted: { icon: Clock, classes: "bg-amber-50 text-amber-700 border-amber-200" },
  rejected: { icon: XCircle, classes: "bg-red-50 text-red-700 border-red-200" },
  eliminated: { icon: AlertOctagon, classes: "bg-red-50 text-red-700 border-red-200" },
  declined: { icon: UserX, classes: "bg-orange-50 text-orange-700 border-orange-200" },
};

const GENDER_LABELS: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };

/** One labelled fact in the student info card: small grey label, clear value, "—" when unknown. */
function InfoItem({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm font-medium break-words", empty && "text-muted-foreground/60")}>
        {empty ? "—" : value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function CommitteeDossierPage() {
  const params = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const { role } = useRole();
  const [student, setStudent] = useState<CommitteeDossier | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decidingDecision, setDecidingDecision] = useState<string | null>(null);
  const [poorLevel, setPoorLevel] = useState<PoorLevel | null>(null);

  const load = useCallback(() => {
    return getCommitteeDossier(params.studentId)
      .then((data) => {
        setStudent(data);
        setPoorLevel((data.committee_decisions?.poor_level as PoorLevel | null) ?? null);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load dossier"))
      .finally(() => setLoading(false));
  }, [params.studentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    getMyProfile(user.uid).then((profile) => setMyUserId(profile?.id ?? null));
  }, [user]);

  // Live vote updates: the API pushes a "ratings changed" event (Redis
  // pub/sub -> Server-Sent Events) and we refetch through the normal
  // RLS-checked endpoint, so committee_member still only ever sees their
  // own vote (see migration 0021/0022).
  useEffect(() => subscribeToCommitteeRatings(params.studentId, () => load()), [params.studentId, load]);

  async function handleDecision(decision: "selected" | "waitlisted" | "rejected" | "eliminated" | "declined") {
    if (!student) return;
    setDecidingDecision(decision);
    try {
      await recordCommitteeDecision({ studentId: student.id, cycleId: student.cycle_id, decision, poorLevel });
      toast.success(`${student.first_name} ${student.last_name} marked ${decision}`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record decision");
    } finally {
      setDecidingDecision(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!student) {
    return <p className="text-sm text-muted-foreground">Student not found.</p>;
  }

  const socialAssessment = student.social_assessments[0] ?? null;
  const photoPath = pickLatestPhotoPath(student.student_documents);
  const initials = `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase();
  const age = student.dob ? differenceInYears(new Date(), new Date(student.dob)) : null;
  // Village, commune, district; the province is shown in bold after it.
  const localAddress = [student.village_name, student.commune_name, student.district_name].filter(Boolean).join(", ");
  // dob gives the exact age; otherwise use the age the home visitor reported.
  const displayAge = age ?? socialAssessment?.age ?? null;

  const decision = student.committee_decisions?.decision ?? null;
  const banner = decision ? DECISION_BANNER[decision] : null;
  const canSeeDecision = can(role, "recordCommitteeDecision");
  const isOwnStudent = myUserId != null && student.social_assessments.some((sa) => sa.visitor_id === myUserId);
  // home_visit_team can vote on students whose social form they didn't record;
  // for their own students they remain observers (see rating chart only).
  const canRate = can(role, "rateCommitteeCandidate") || (role === "home_visit_team" && !isOwnStudent);
  const canSeeRatingChart = can(role, "viewCommitteeRatings");
  const hasSidePanel = canSeeDecision || canSeeRatingChart;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StudentAvatar photoPath={photoPath} initials={initials} size="size-12" />
          <div>
            <Link href="/committee/queue" className="text-sm text-muted-foreground hover:underline">
              ← Back to Committee Queue
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">
                {student.first_name} {student.last_name}
              </h1>
              {socialAssessment && (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-bold",
                    isFailedHomeVisit(socialAssessment.final_score, socialAssessment.manual_failed)
                      ? "bg-red-100 text-red-700"
                      : CATEGORY_BADGE_CLASSES[socialAssessment.category as SocialFormCategory],
                  )}
                >
                  {socialAssessment.final_score} pts ·{" "}
                  {isFailedHomeVisit(socialAssessment.final_score, socialAssessment.manual_failed)
                    ? "Failed Home Visit"
                    : CATEGORY_LABELS[socialAssessment.category as SocialFormCategory]}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {student.student_code} ·{" "}
              <Link href={`/students/${student.id}`} className="hover:underline">
                View full profile
              </Link>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge className="capitalize">{student.status.replace(/_/g, " ")}</Badge>
            {student.photo_drive_url && (
              <a
                href={student.photo_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1.5" })}
              >
                <ImageIcon className="size-3.5" />
                View Photos
              </a>
            )}
          </div>
          {canRate && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Your Vote</span>
              <CommitteeRatingPanel
                studentId={student.id}
                cycleId={student.cycle_id}
                ratings={student.committee_ratings}
                myUserId={myUserId}
                onRated={load}
              />
            </div>
          )}
        </div>
      </div>

      {student.elimination_reason && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-700">
          <AlertOctagon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Eliminated during home visit — sent to committee for review</p>
            <p className="mt-1 whitespace-pre-wrap text-orange-700/80">{student.elimination_reason}</p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <StudentAvatar
            photoPath={photoPath}
            initials={initials}
            shape="square"
            size="size-32 sm:size-36"
            className="text-3xl shrink-0"
            zoomable
            alt={`${student.first_name} ${student.last_name}`}
          />
          <div className="min-w-0 flex-1 space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <InfoItem icon={UserRound} label="Gender" value={GENDER_LABELS[student.gender] ?? student.gender} />
              <InfoItem
                icon={Cake}
                label="Age"
                value={displayAge != null ? `${displayAge} years` : null}
                hint={age == null && displayAge != null ? "Reported at home visit" : undefined}
              />
              <InfoItem icon={GraduationCap} label="Major" value={labelFor(MAJOR_OPTS, socialAssessment?.major)} />
            </dl>
            <div className="border-t" />
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              <InfoItem icon={School} label="School" value={student.school_partners?.school_name} />
              <InfoItem icon={Building2} label="Referred by NGO" value={student.ngo_partners?.organization_name ?? "None"} />
              <InfoItem
                icon={HeartPulse}
                label="Health"
                value={socialAssessment?.health_status ? labelFor(HEALTH_OPTS, socialAssessment.health_status) : null}
              />
            </dl>
            <div className="border-t" />
            <dl>
              <InfoItem
                icon={MapPin}
                label="Address"
                value={
                  localAddress || student.provinces?.name_en ? (
                    <>
                      {localAddress}
                      {localAddress && student.provinces?.name_en && ", "}
                      {student.provinces?.name_en && (
                        <span className="font-semibold">{student.provinces.name_en}</span>
                      )}
                    </>
                  ) : null
                }
              />
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className={cn("grid grid-cols-1 gap-6", hasSidePanel && "lg:grid-cols-3")}>
        <div className={cn("space-y-6", hasSidePanel && "lg:col-span-2")}>
          <Card>
            <CardHeader>
              <CardTitle>Social Form (Home Visit)</CardTitle>
              <CardDescription>
                {student.social_assessments.length === 0
                  ? "No visit recorded yet"
                  : `${student.social_assessments.length} visit(s) recorded`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {student.social_assessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No social form yet.</p>
              ) : (
                student.social_assessments.map((assessment, i) => (
                  <div key={assessment.id}>
                    {i > 0 && <div className="mb-6 border-t" />}
                    <SocialFormSummary assessment={assessment} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {hasSidePanel && (
          // Top right on wide screens and stays in view while scrolling the
          // social form (scrolls on its own if taller than the screen); on
          // phones it comes first, above the social form.
          <div className="order-first space-y-6 lg:order-none lg:sticky lg:top-6 lg:col-span-1 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
            {canSeeRatingChart && (
              <Card>
                <CardHeader>
                  <CardTitle>Committee Ratings</CardTitle>
                  <CardDescription>Vote distribution across the committee</CardDescription>
                </CardHeader>
                <CardContent>
                  <RatingAverageChart ratings={student.committee_ratings} />
                </CardContent>
              </Card>
            )}
            {canSeeDecision && (
              <Card>
                <CardHeader>
                  <CardTitle>Decision</CardTitle>
                </CardHeader>
                <CardContent>
                  {decision === null && student.status !== "committee_review" ? (
                    <p className="text-sm text-muted-foreground">
                      This case hasn&apos;t been sent to committee yet.{" "}
                      <Link
                        href={`/students/${student.id}`}
                        className={buttonVariants({
                          variant: "link",
                          className: "px-0",
                        })}
                      >
                        Continue the pipeline
                      </Link>
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {decision && banner && (
                        <div className={cn("space-y-1.5 rounded-lg border p-3 text-xs", banner.classes)}>
                          <div className="flex items-center gap-2 text-sm font-medium capitalize">
                            <banner.icon className="size-4 shrink-0" />
                            {decision}
                          </div>
                          <dl className="space-y-1">
                            <div className="flex justify-between gap-3">
                              <dt>Decided on</dt>
                              <dd className="font-medium">{student.committee_decisions?.decision_date}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt>Approval</dt>
                              <dd className="font-medium capitalize">{student.committee_decisions?.approval_status}</dd>
                            </div>
                          </dl>
                          <p className="pt-1 text-xs opacity-80">
                            Pick a different option below to change it — it&apos;ll go back to pending approval.
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-sm font-medium">
                          Poor Level <span className="font-normal text-muted-foreground">(A+ = very poor)</span>
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {POOR_LEVELS.map((level) => (
                            <button
                              key={level}
                              type="button"
                              aria-pressed={poorLevel === level}
                              onClick={() => setPoorLevel(poorLevel === level ? null : level)}
                              className={cn(
                                "flex h-10 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors",
                                poorLevel === level
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40",
                              )}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium">Decision</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              {
                                key: "selected",
                                label: "Select",
                                variant: "default",
                              },
                              {
                                key: "waitlisted",
                                label: "Waitlist",
                                variant: "outline",
                              },
                              {
                                key: "rejected",
                                label: "Reject",
                                variant: "outline",
                              },
                              {
                                key: "eliminated",
                                label: "Eliminated",
                                variant: "destructive",
                              },
                            ] as const
                          ).map((d) => (
                            <Button
                              key={d.key}
                              variant={d.variant}
                              disabled={decidingDecision !== null}
                              onClick={() => handleDecision(d.key)}
                              className={cn(
                                decision === d.key && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                              )}
                            >
                              {decidingDecision === d.key ? "Saving..." : d.label}
                              {decision === d.key && decidingDecision !== d.key && (
                                <CheckCircle2 className="size-3.5" />
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {(decision === "selected" || decision === "declined") && (
                        <div>
                          <Button
                            variant="outline"
                            disabled={decidingDecision !== null}
                            onClick={() => handleDecision("declined")}
                            className={cn(
                              "w-full",
                              decision === "declined" &&
                                "border-orange-300 bg-orange-50 text-orange-700 ring-2 ring-orange-300 ring-offset-2 ring-offset-background hover:bg-orange-50",
                            )}
                          >
                            <UserX className="size-4" />
                            {decidingDecision === "declined" ? "Saving..." : "Student Declined the Offer"}
                            {decision === "declined" && decidingDecision !== "declined" && (
                              <CheckCircle2 className="size-3.5" />
                            )}
                          </Button>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Use this when a selected student turns down the scholarship. Click &quot;Select&quot; above
                            to undo.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
