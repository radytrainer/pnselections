"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Eye, FileDown, Gavel, HeartHandshake, Mic, School, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StudentAvatar } from "@/components/students/StudentAvatar";
import { can } from "@/lib/rbac";
import {
  displayStudentStatus,
  hasPassedInterview,
  POOR_LEVEL_BADGE_CLASSES,
  STUDENT_STATUS_BADGE_CLASSES,
  type AppRole,
  studentStatusLabel,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { pickLatestPhotoPath } from "@/lib/storage";
import { softDeleteStudent, type StudentListItem } from "@/services/studentService";
import { sendToCommittee } from "@/services/committeeService";
import { ApplicationLinkDialog } from "@/components/applications/ApplicationLinkDialog";

/** Committee isn't relevant until the home visit (social form) is done — these statuses come before it. */
const PRE_HOME_VISIT_STATUSES = new Set(["registered", "exam_completed", "interview_completed"]);

/** Per-column cell/header classes (read by StudentsTable) — used to hide secondary columns on narrow screens. */
export type StudentColumnMeta = { className?: string };

export const GENDER_LABEL: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };

export const Empty = () => <span className="text-muted-foreground/60">—</span>;

// ---------------------------------------------------------------------------
// Cell building blocks — shared by the desktop table (below) and the
// phone/tablet cards (StudentCard), so both always show the same thing.
// ---------------------------------------------------------------------------

/** Name of whoever recorded the most recent home visit, or null. */
export function latestVisitorName(s: StudentListItem): string | null {
  const visits = s.social_assessments;
  if (visits.length === 0) return null;
  return visits.reduce((a, b) => (b.visit_number > a.visit_number ? b : a)).visitor_name || null;
}

export function StudentIdentity({
  student: s,
  photoUrls,
  size = "size-9",
}: {
  student: StudentListItem;
  photoUrls: Record<string, string>;
  size?: string;
}) {
  const photoPath = pickLatestPhotoPath(s.student_documents);
  const initials = `${s.first_name[0] ?? ""}${s.last_name[0] ?? ""}`.toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <StudentAvatar
        photoPath={photoPath}
        signedUrl={photoPath ? photoUrls[photoPath] ?? null : null}
        initials={initials}
        size={size}
      />
      <div className="min-w-0 leading-tight">
        <Link
          href={`/students/${s.id}`}
          className="block truncate font-medium text-foreground hover:text-primary hover:underline"
        >
          {s.first_name} {s.last_name}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{s.student_code}</span>
      </div>
    </div>
  );
}

export function StudentStatusBadge({ student: s }: { student: StudentListItem }) {
  const displayStatus = displayStudentStatus(s.status, s.elimination_reason);
  const stillPending = displayStatus === "eliminated" && s.status !== "eliminated";
  // Raw status, not displayStatus: an eliminated-but-still-pending case
  // (displayStatus "eliminated") is just as much in the committee
  // queue as a plain "committee review" one — both have status
  // "committee_review" under the hood (see displayStudentStatus).
  const inCommitteeQueue = s.status === "committee_review";
  const badge = (
    <Badge className={cn("capitalize", STUDENT_STATUS_BADGE_CLASSES[displayStatus] ?? "bg-muted text-muted-foreground")}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {studentStatusLabel(displayStatus)}
      {inCommitteeQueue && <Gavel />}
    </Badge>
  );
  return (
    <div>
      {inCommitteeQueue ? (
        <Tooltip>
          <TooltipTrigger render={<Link href={`/committee/${s.id}`} />}>{badge}</TooltipTrigger>
          <TooltipContent>Open in Committee Queue</TooltipContent>
        </Tooltip>
      ) : (
        badge
      )}
      {stillPending && <p className="mt-1 text-xs text-muted-foreground">Awaiting committee decision</p>}
    </div>
  );
}

export function PoorLevelBadge({ student: s }: { student: StudentListItem }) {
  const poorLevel = s.committee_decisions?.poor_level;
  if (!poorLevel) return <Empty />;
  return <Badge className={cn("min-w-8", POOR_LEVEL_BADGE_CLASSES[poorLevel])}>{poorLevel}</Badge>;
}

/** Social form shortcut, Send to Committee (when allowed) and the ⋯ menu. */
export function StudentActions({
  student: s,
  role,
  currentUserId,
  onChanged,
  variant = "icons",
}: {
  student: StudentListItem;
  role: AppRole | null;
  currentUserId: string | null;
  onChanged: () => void;
  /** "icons": compact icon buttons (desktop table). "labeled": icon + text buttons with Edit shown, for cards on phones/tablets. */
  variant?: "icons" | "labeled";
}) {
  const canEdit = can(role, "createEditStudents");
  const fullName = `${s.first_name} ${s.last_name}`;
  // Scholarship application link/QR (0068) — once the interview is passed.
  const showApplication = can(role, "manageApplicationLinks") && hasPassedInterview(s.status, s.elimination_reason);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const applicationDialog = showApplication ? (
    <ApplicationLinkDialog student={s} open={applicationOpen} onOpenChange={setApplicationOpen} canManage />
  ) : null;
  const committeeRelevant = !PRE_HOME_VISIT_STATUSES.has(s.status);
  // home_visit_team only gets the button on cases where they're the
  // one who recorded the social form (see migration 0026) — other
  // roles with the capability can send any case.
  const canSendThisOne =
    s.status !== "registered" &&
    can(role, "sendToCommittee") &&
    (role !== "home_visit_team" || s.social_assessments.some((sa) => sa.visitor_id === currentUserId));

  async function handleSend() {
    if (!window.confirm(`Send ${fullName} to the committee?`)) return;
    try {
      await sendToCommittee(s.id);
      toast.success("Sent to committee");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send to committee");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${fullName} (${s.student_code})? This can be restored by an admin later.`)) return;
    try {
      await softDeleteStudent(s.id);
      toast.success("Student deleted");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete student");
    }
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`More actions for ${fullName}`} />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem render={<Link href={`/students/${s.id}`} />}>
          <Eye className="size-4" />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/students/${s.id}/social-form`} />}>
          <HeartHandshake className="size-4" />
          Social form
        </DropdownMenuItem>
        {committeeRelevant && (
          <DropdownMenuItem render={<Link href={`/committee/${s.id}`} />}>
            <Gavel className="size-4" />
            Committee
          </DropdownMenuItem>
        )}
        {s.social_assessments.length > 0 && (
          // New tab + ?print=1: the report opens the print dialog ("Save as PDF").
          <DropdownMenuItem render={<a href={`/report/students/${s.id}?print=1`} target="_blank" rel="noopener" />}>
            <FileDown className="size-4" />
            Download report
          </DropdownMenuItem>
        )}
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={`/students/${s.id}/edit`} />}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === "labeled") {
    // One row, buttons share the width; labels truncate rather than wrap.
    const btn = "h-8 min-w-0 flex-auto gap-1.5 px-2 sm:flex-none sm:px-2.5";
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href={`/students/${s.id}/social-form`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), btn, "text-pink-700 dark:text-pink-300")}
        >
          <HeartHandshake className="size-4" />
          <span className="truncate">Social form</span>
        </Link>
        {showApplication && (
          <Button type="button" variant="outline" size="sm" className={cn(btn, "text-emerald-700 dark:text-emerald-300")} onClick={() => setApplicationOpen(true)}>
            <ClipboardList className="size-4" />
            <span className="truncate">Application</span>
          </Button>
        )}
        {canSendThisOne && (
          <Button type="button" variant="outline" size="sm" className={btn} onClick={handleSend}>
            <Send className="size-4" />
            <span className="truncate">Committee</span>
          </Button>
        )}
        {canEdit && (
          <Link href={`/students/${s.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), btn)}>
            <Pencil className="size-4" />
            <span className="truncate">Edit</span>
          </Link>
        )}
        <div className="shrink-0 sm:ml-auto">{menu}</div>
        {applicationDialog}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={`/students/${s.id}/social-form`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-pink-600")}
              aria-label="Social form"
            />
          }
        >
          <HeartHandshake className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Social Form</TooltipContent>
      </Tooltip>
      {showApplication && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-emerald-600"
                onClick={() => setApplicationOpen(true)}
                aria-label="Application form link"
              />
            }
          >
            <ClipboardList className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Application Form (link &amp; QR)</TooltipContent>
        </Tooltip>
      )}
      {canSendThisOne && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-primary"
                onClick={handleSend}
                aria-label="Send to committee"
              />
            }
          >
            <Send className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Send to Committee</TooltipContent>
        </Tooltip>
      )}
      {menu}
      {applicationDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop table columns
// ---------------------------------------------------------------------------

export function getStudentColumns(
  onChanged: () => void,
  role: AppRole | null,
  currentUserId: string | null,
  photoUrls: Record<string, string> = {},
): ColumnDef<StudentListItem>[] {
  return [
    {
      id: "name",
      header: "Student",
      cell: ({ row }) => (
        <div className="min-w-48">
          <StudentIdentity student={row.original} photoUrls={photoUrls} />
        </div>
      ),
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{GENDER_LABEL[row.original.gender] ?? row.original.gender}</span>
      ),
    },
    {
      id: "location",
      header: "Province / School",
      cell: ({ row }) => {
        const province = row.original.provinces?.name_en;
        const school = row.original.school_partners?.school_name;
        if (!province && !school) return <Empty />;
        return (
          <div className="max-w-56 leading-tight">
            <div className="truncate">{province ?? <Empty />}</div>
            {school && <div className="truncate text-xs text-muted-foreground">{school}</div>}
          </div>
        );
      },
    },
    {
      id: "home_visitor",
      header: "Home Visitor",
      cell: ({ row }) => {
        const name = latestVisitorName(row.original);
        return name ? <span className="truncate">{name}</span> : <Empty />;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <StudentStatusBadge student={row.original} />
          {row.original.exam_center_name && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground" title="Exam center">
              <School className="size-3" /> {row.original.exam_center_name}
            </p>
          )}
          {row.original.interview_center_name && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground" title="Interview center">
              <Mic className="size-3" /> {row.original.interview_center_name}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "poor_level",
      header: "Poor Level",
      cell: ({ row }) => <PoorLevelBadge student={row.original} />,
    },
    {
      id: "ngo",
      header: "NGO",
      meta: { className: "hidden xl:table-cell" } satisfies StudentColumnMeta,
      cell: ({ row }) => {
        const ngo = row.original.ngo_partners?.organization_name;
        return ngo ? <span className="block max-w-40 truncate">{ngo}</span> : <Empty />;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: "w-px text-right" } satisfies StudentColumnMeta,
      cell: ({ row }) => (
        <StudentActions student={row.original} role={role} currentUserId={currentUserId} onChanged={onChanged} />
      ),
    },
  ];
}
