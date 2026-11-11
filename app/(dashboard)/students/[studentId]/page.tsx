"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  Check,
  FileText,
  FolderOpen,
  GraduationCap,
  HeartHandshake,
  ImageIcon,
  Languages,
  Mic,
  Pencil,
  Send,
  User,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getStudent, type StudentDetail } from "@/services/studentService";
import { getInterviewSummary, type InterviewSummary } from "@/services/interviewService";
import { sendToCommittee } from "@/services/committeeService";
import { getMyProfile } from "@/services/userService";
import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS, isFailedHomeVisit } from "@/features/social-form/scoring";
import { displayStudentStatus, STUDENT_STATUSES, STUDENT_STATUS_BADGE_CLASSES } from "@/lib/constants";
import { StudentAvatar } from "@/components/students/StudentAvatar";
import { pickLatestPhotoPath } from "@/lib/storage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/components/layout/RoleGate";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { interviewResultLabel } from "@/features/interview/schema";


/** Interview categories are admin-managed now (no longer a fixed 3), so icons rotate through this list rather than being tied to specific category names. */
const CATEGORY_ICONS: LucideIcon[] = [GraduationCap, HeartHandshake, UsersRound, Award];

const PIPELINE_STAGES: { status: string; label: string }[] = [
  { status: "registered", label: "Registered" },
  { status: "exam_completed", label: "Exam" },
  { status: "interview_completed", label: "Interview" },
  { status: "home_visit_completed", label: "Home Visit" },
  { status: "committee_review", label: "Committee" },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium", value === "—" && "font-normal text-muted-foreground/70")}>
        {value}
      </span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">{children}</CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineStepper({ status }: { status: string }) {
  const statusIndex = STUDENT_STATUSES.indexOf(status as (typeof STUDENT_STATUSES)[number]);
  const committeeIndex = STUDENT_STATUSES.indexOf("committee_review");
  const isTerminal = statusIndex > committeeIndex;
  const reachedIndex = isTerminal ? committeeIndex : statusIndex;

  return (
    <div className="space-y-2">
      <div className="flex items-center overflow-x-auto pb-1">
        {PIPELINE_STAGES.map((stage, i) => {
          const isCompleted = i < reachedIndex || (i === reachedIndex && isTerminal);
          const isCurrent = i === reachedIndex && !isTerminal;
          return (
            <div key={stage.status} className="flex shrink-0 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 text-xs font-medium",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    !isCompleted && !isCurrent && "border-muted-foreground/25 text-muted-foreground/60",
                  )}
                >
                  {isCompleted ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </div>
                <span
                  className={cn(
                    "w-16 text-center text-[11px] leading-tight",
                    isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className={cn("mb-4 h-0.5 w-6 shrink-0 sm:w-12", isCompleted ? "bg-primary" : "bg-muted-foreground/20")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const { role } = useRole();
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [interviewSummary, setInterviewSummary] = useState<InterviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingToCommittee, setSendingToCommittee] = useState(false);

  const load = useCallback(() => {
    return getStudent(params.studentId)
      .then(setStudent)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load student"))
      .finally(() => setLoading(false));
  }, [params.studentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getInterviewSummary(params.studentId)
      .then(setInterviewSummary)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load interview summary"));
  }, [params.studentId]);

  useEffect(() => {
    if (!user) return;
    getMyProfile(user.uid).then((profile) => setMyUserId(profile?.id ?? null));
  }, [user]);

  async function handleSendToCommittee() {
    if (!student) return;
    setSendingToCommittee(true);
    try {
      await sendToCommittee(student.id);
      toast.success("Case sent to the committee");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send to committee");
    } finally {
      setSendingToCommittee(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!student) {
    return <p className="text-sm text-muted-foreground">Student not found.</p>;
  }

  const initials = `${student.first_name?.[0] ?? ""}${student.last_name?.[0] ?? ""}`.toUpperCase();
  const latestAssessment = student.social_assessments[student.social_assessments.length - 1] ?? null;
  const photoPath = pickLatestPhotoPath(student.student_documents);
  // home_visit_team only gets this button on cases where they're the one
  // who recorded the social form (see migration 0026).
  const canSendToCommittee =
    can(role, "sendToCommittee") &&
    (role !== "home_visit_team" || student.social_assessments.some((sa) => sa.visitor_id === myUserId));

  return (
    <div className="space-y-5">
      <Link
        href="/students"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2.5" })}
      >
        <ArrowLeft className="size-4" />
        Back to Students
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <StudentAvatar
            photoPath={photoPath}
            initials={initials}
            shape="square"
            size="size-24 sm:size-28"
            className="text-2xl"
            zoomable
            alt={`${student.first_name} ${student.last_name}`}
          />
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">{student.student_code}</p>
            {(() => {
              const displayStatus = displayStudentStatus(student.status, student.elimination_reason);
              const stillPending = displayStatus === "eliminated" && student.status !== "eliminated";
              return (
                <>
                  <Badge
                    className={cn(
                      "mt-1.5",
                      STUDENT_STATUS_BADGE_CLASSES[displayStatus] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {displayStatus.replace(/_/g, " ")}
                  </Badge>
                  {stillPending && (
                    <p className="mt-1 text-xs text-muted-foreground">Awaiting committee decision</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {student.status !== "registered" && canSendToCommittee && (
            <Button disabled={sendingToCommittee} onClick={handleSendToCommittee} className="gap-1.5">
              <Send className="size-4" />
              {sendingToCommittee ? "Sending..." : "Send to Committee"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <PipelineStepper status={student.status} />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <div className="scrollbar-hide -mx-1 overflow-x-auto px-1">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5">
              <User className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="exam" className="gap-1.5">
              <FileText className="size-4" />
              Exam
            </TabsTrigger>
            <TabsTrigger value="interview" className="gap-1.5">
              <Mic className="size-4" />
              Interview
            </TabsTrigger>
            <TabsTrigger value="social-form" className="gap-1.5">
              <HeartHandshake className="size-4" />
              Social Form
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FolderOpen className="size-4" />
              Documents
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard icon={User} title="Personal" description="Demographics and contact">
            <Field label="Gender" value={student.gender ? student.gender[0].toUpperCase() + student.gender.slice(1) : "—"} />
            <Field label="Date of Birth" value={student.dob ?? "—"} />
            <Field label="Phone" value={student.phone ?? "—"} />
            <Field
              label="Location"
              value={
                [student.village_name, student.commune_name, student.district_name, student.provinces?.name_en]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
          </SectionCard>

          <SectionCard icon={GraduationCap} title="Academic" description="School and performance">
            <Field label="School" value={student.school_partners?.school_name ?? "—"} />
            <Field label="Grade" value={student.grade ?? "—"} />
            <Field label="GPA" value={student.gpa != null ? String(student.gpa) : "—"} />
            <Field label="English Level" value={student.english_level ?? "—"} />
          </SectionCard>

          <SectionCard icon={UsersRound} title="Family" description="Household context">
            <Field label="Father" value={student.father_name ?? "—"} />
            <Field label="Mother" value={student.mother_name ?? "—"} />
            <Field label="Occupation" value={student.parent_occupation ?? "—"} />
            <Field
              label="Monthly Income"
              value={student.family_income_monthly != null ? `$${student.family_income_monthly}` : "—"}
            />
            <Field label="Siblings" value={student.siblings_count != null ? String(student.siblings_count) : "—"} />
          </SectionCard>

          <SectionCard icon={HeartHandshake} title="Social Assessment" description="Latest home visit result">
            {latestAssessment ? (
              <>
                <div className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isFailedHomeVisit(latestAssessment.final_score, latestAssessment.manual_failed)
                        ? "bg-red-100 text-red-700"
                        : CATEGORY_BADGE_CLASSES[latestAssessment.category],
                    )}
                  >
                    {isFailedHomeVisit(latestAssessment.final_score, latestAssessment.manual_failed)
                      ? "Failed Home Visit"
                      : CATEGORY_LABELS[latestAssessment.category]}
                  </span>
                </div>
                <Field label="Final Score" value={String(latestAssessment.final_score)} />
                <Field label="Poverty Certificate" value={latestAssessment.poverty_certificate || "—"} />
              </>
            ) : (
              <p className="py-1.5 text-sm text-muted-foreground">No social form recorded yet.</p>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="exam" className="mt-4 space-y-4">
          {student.exam_results ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Award} label="Math" value={String(student.exam_results.math_score)} />
                <StatCard icon={Languages} label="English" value={String(student.exam_results.english_score)} />
                <StatCard icon={GraduationCap} label="Logic" value={String(student.exam_results.logic_score)} />
                <StatCard icon={FileText} label="Computer" value={String(student.exam_results.computer_score)} />
              </div>
              <SectionCard icon={FileText} title="Result" description="Overall exam outcome">
                <Field label="Total Score" value={`${student.exam_results.total_score} / 400`} />
                <Field
                  label="Result"
                  value={
                    student.exam_results.pass_status
                      ? student.exam_results.pass_status[0].toUpperCase() + student.exam_results.pass_status.slice(1)
                      : "—"
                  }
                />
                <Field label="Rank in Cycle" value={student.exam_results.rank_in_cycle != null ? String(student.exam_results.rank_in_cycle) : "—"} />
              </SectionCard>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No exam scores entered yet.</p>
          )}
          <RoleGate capability="enterExamScores">
            <Link href={`/students/${student.id}/exam`} className={buttonVariants({ className: "w-full gap-1.5 sm:w-auto" })}>
              <Pencil className="size-4" />
              {student.exam_results ? "Edit Exam Scores" : "Enter Exam Scores"}
            </Link>
          </RoleGate>
        </TabsContent>

        <TabsContent value="interview" className="mt-4 space-y-4">
          {interviewSummary ? (
            <>
              {interviewSummary.recommendation && (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm font-semibold text-center",
                    interviewSummary.recommendation === "not_recommended"
                      ? "text-red-700 bg-red-50 border-red-200"
                      : "text-green-700 bg-green-50 border-green-200",
                  )}
                >
                  {interviewResultLabel(interviewSummary.recommendation)} Interview
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Mic} label="Total Score" value={`${interviewSummary.total} / ${interviewSummary.maxScore}`} />
                {interviewSummary.categoryTotals.map(({ label, total, max }, idx) => (
                  <StatCard
                    key={label}
                    icon={CATEGORY_ICONS[idx % CATEGORY_ICONS.length]}
                    label={label}
                    value={`${total} / ${max}`}
                  />
                ))}
              </div>
              <SectionCard icon={Mic} title="Result" description="Pass mark: 50% of the total score">
                <Field label="Result" value={interviewResultLabel(interviewSummary.recommendation) ?? "—"} />
                {interviewSummary.comments && (
                  <div className="py-1.5 text-sm">
                    <p className="text-muted-foreground">Comments</p>
                    <p className="mt-1">{interviewSummary.comments}</p>
                  </div>
                )}
              </SectionCard>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No interview recorded yet.</p>
          )}
          <RoleGate capability="enterInterviewScores">
            <Link href={`/students/${student.id}/interview`} className={buttonVariants({ className: "w-full gap-1.5 sm:w-auto" })}>
              <Pencil className="size-4" />
              {student.interviews ? "Edit Interview" : "Enter Interview"}
            </Link>
          </RoleGate>
        </TabsContent>

        <TabsContent value="social-form" className="mt-4 space-y-4">
          {student.social_assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No social form recorded yet.</p>
          ) : (
            student.social_assessments.map((assessment) => (
              <SectionCard
                key={assessment.id}
                icon={HeartHandshake}
                title={`Visit #${assessment.visit_number}`}
                description="Home visit social assessment"
              >
                <div className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isFailedHomeVisit(assessment.final_score, assessment.manual_failed)
                        ? "bg-red-100 text-red-700"
                        : CATEGORY_BADGE_CLASSES[assessment.category],
                    )}
                  >
                    {isFailedHomeVisit(assessment.final_score, assessment.manual_failed)
                      ? "Failed Home Visit"
                      : CATEGORY_LABELS[assessment.category]}
                  </span>
                </div>
                <Field label="Final Score" value={String(assessment.final_score)} />
                <Field label="Housing" value={assessment.housing_type_band?.replace(/_/g, " ") ?? "—"} />
                <Field label="Monthly Income Band" value={assessment.income_band?.replace(/_/g, "-") ?? "—"} />
                <Field label="Poverty Certificate" value={assessment.poverty_certificate || "—"} />
                {assessment.visitor_comments && (
                  <div className="py-1.5 text-sm">
                    <p className="text-muted-foreground">Comments</p>
                    <p className="mt-1">{assessment.visitor_comments}</p>
                  </div>
                )}
              </SectionCard>
            ))
          )}
          <RoleGate capability="enterHomeVisitData">
            <Link
              href={`/students/${student.id}/social-form`}
              className={buttonVariants({ className: "w-full gap-1.5 sm:w-auto" })}
            >
              <Pencil className="size-4" />
              {student.social_assessments.length === 0 ? "Enter Social Form" : "Edit Social Form"}
            </Link>
          </RoleGate>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No documents yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Document upload/preview — see docs/07-ui-pages.md §4.1 (next implementation pass).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
