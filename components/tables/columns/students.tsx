"use client";

import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Gavel, HeartHandshake, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
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
  POOR_LEVEL_BADGE_CLASSES,
  STUDENT_STATUS_BADGE_CLASSES,
  type AppRole,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { pickLatestPhotoPath } from "@/lib/storage";
import { softDeleteStudent, type StudentListItem } from "@/services/studentService";
import { sendToCommittee } from "@/services/committeeService";

/** Committee isn't relevant until the home visit (social form) is done — these statuses come before it. */
const PRE_HOME_VISIT_STATUSES = new Set(["registered", "exam_completed", "interview_completed"]);

/** Per-column cell/header classes (read by StudentsTable) — used to hide secondary columns on narrow screens. */
export type StudentColumnMeta = { className?: string };

const GENDER_LABEL: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };

const Empty = () => <span className="text-muted-foreground/60">—</span>;

export function getStudentColumns(
  onChanged: () => void,
  role: AppRole | null,
  currentUserId: string | null,
  photoUrls: Record<string, string> = {},
): ColumnDef<StudentListItem>[] {
  const canEdit = can(role, "createEditStudents");

  return [
    {
      id: "name",
      header: "Student",
      cell: ({ row }) => {
        const s = row.original;
        const photoPath = pickLatestPhotoPath(s.student_documents);
        const initials = `${s.first_name[0] ?? ""}${s.last_name[0] ?? ""}`.toUpperCase();
        return (
          <div className="flex min-w-48 items-center gap-3">
            <StudentAvatar
              photoPath={photoPath}
              signedUrl={photoPath ? photoUrls[photoPath] ?? null : null}
              initials={initials}
              size="size-9"
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
      },
    },
    {
      accessorKey: "gender",
      header: "Gender",
      meta: { className: "hidden sm:table-cell" } satisfies StudentColumnMeta,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{GENDER_LABEL[row.original.gender] ?? row.original.gender}</span>
      ),
    },
    {
      id: "location",
      header: "Province / School",
      meta: { className: "hidden md:table-cell" } satisfies StudentColumnMeta,
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
      meta: { className: "hidden lg:table-cell" } satisfies StudentColumnMeta,
      cell: ({ row }) => {
        const visits = row.original.social_assessments;
        if (visits.length === 0) return <Empty />;
        const latest = visits.reduce((a, b) => (b.visit_number > a.visit_number ? b : a));
        return latest.visitor_name ? <span className="truncate">{latest.visitor_name}</span> : <Empty />;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const displayStatus = displayStudentStatus(row.original.status, row.original.elimination_reason);
        const stillPending = displayStatus === "eliminated" && row.original.status !== "eliminated";
        // Raw status, not displayStatus: an eliminated-but-still-pending case
        // (displayStatus "eliminated") is just as much in the committee
        // queue as a plain "committee review" one — both have status
        // "committee_review" under the hood (see displayStudentStatus).
        const inCommitteeQueue = row.original.status === "committee_review";
        const badge = (
          <Badge
            className={cn(
              "capitalize",
              STUDENT_STATUS_BADGE_CLASSES[displayStatus] ?? "bg-muted text-muted-foreground",
            )}
          >
            <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
            {displayStatus.replace(/_/g, " ")}
            {inCommitteeQueue && <Gavel />}
          </Badge>
        );
        return (
          <div>
            {inCommitteeQueue ? (
              <Tooltip>
                <TooltipTrigger render={<Link href={`/committee/${row.original.id}`} />}>{badge}</TooltipTrigger>
                <TooltipContent>Open in Committee Queue</TooltipContent>
              </Tooltip>
            ) : (
              badge
            )}
            {stillPending && <p className="mt-1 text-xs text-muted-foreground">Awaiting committee decision</p>}
          </div>
        );
      },
    },
    {
      id: "poor_level",
      header: "Poor Level",
      meta: { className: "hidden sm:table-cell" } satisfies StudentColumnMeta,
      cell: ({ row }) => {
        const poorLevel = row.original.committee_decisions?.poor_level;
        if (!poorLevel) return <Empty />;
        return <Badge className={cn("min-w-8", POOR_LEVEL_BADGE_CLASSES[poorLevel])}>{poorLevel}</Badge>;
      },
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
      cell: ({ row }) => {
        const s = row.original;
        const fullName = `${s.first_name} ${s.last_name}`;
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
          if (
            !window.confirm(
              `Delete ${fullName} (${s.student_code})? This can be restored by an admin later.`,
            )
          ) {
            return;
          }
          try {
            await softDeleteStudent(s.id);
            toast.success("Student deleted");
            onChanged();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete student");
          }
        }

        return (
          <div className="flex items-center justify-end gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={`/students/${s.id}/social-form`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      "text-muted-foreground hover:text-pink-600",
                    )}
                    aria-label="Social form"
                  />
                }
              >
                <HeartHandshake className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Social Form</TooltipContent>
            </Tooltip>
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label={`More actions for ${fullName}`}
                  />
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
          </div>
        );
      },
    },
  ];
}
