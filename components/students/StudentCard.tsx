"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  GENDER_LABEL,
  PoorLevelBadge,
  StudentActions,
  StudentIdentity,
  StudentStatusBadge,
  latestVisitorName,
} from "@/components/tables/columns/students";
import type { AppRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StudentListItem } from "@/services/studentService";

/**
 * Phone/tablet version of a Students table row: the essentials (photo, name,
 * code, status, province, poor level) always visible; everything else plus the
 * actions behind an expand toggle.
 */
export function StudentCard({
  student: s,
  photoUrls,
  role,
  currentUserId,
  onChanged,
  selectable,
  selected,
  onSelectedChange,
}: {
  student: StudentListItem;
  photoUrls: Record<string, string>;
  role: AppRole | null;
  currentUserId: string | null;
  onChanged: () => void;
  selectable: boolean;
  selected: boolean;
  onSelectedChange: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const province = s.provinces?.name_en;
  const school = s.school_partners?.school_name;
  const ngo = s.ngo_partners?.organization_name;
  const visitor = latestVisitorName(s);
  const hasPoorLevel = !!s.committee_decisions?.poor_level;

  return (
    <li
      className={cn(
        "rounded-xl border bg-card shadow-xs transition-colors",
        selected && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelectedChange(!!v)}
            aria-label={`Select ${s.first_name} ${s.last_name}`}
            className="mt-2.5"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <StudentIdentity student={s} photoUrls={photoUrls} size="size-10" />
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={detailsId}
              aria-label={open ? "Hide details" : "Show details"}
              className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
          </div>

          {/* Always visible: what you scan the list for */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <StudentStatusBadge student={s} />
            {hasPoorLevel && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Poor level <PoorLevelBadge student={s} />
              </span>
            )}
            {province && <span className="truncate text-xs text-muted-foreground">{province}</span>}
          </div>
        </div>
      </div>

      {open && (
        <div id={detailsId} className="border-t px-3 pt-3 pb-1">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <Detail label="Gender">{GENDER_LABEL[s.gender] ?? s.gender}</Detail>
            <Detail label="Province">{province ?? <Empty />}</Detail>
            <Detail label="School">{school ?? <Empty />}</Detail>
            <Detail label="Home visitor">{visitor ?? <Empty />}</Detail>
            <Detail label="Poor level">
              <PoorLevelBadge student={s} />
            </Detail>
            <Detail label="NGO">{ngo ?? <Empty />}</Detail>
          </dl>
          <Link
            href={`/students/${s.id}`}
            className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 h-auto px-0")}
          >
            View full profile →
          </Link>
        </div>
      )}

      {/* Always visible: the actions field teams use most */}
      <div className="border-t px-3 py-2">
        <StudentActions student={s} role={role} currentUserId={currentUserId} onChanged={onChanged} variant="labeled" />
      </div>
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate">{children}</dd>
    </div>
  );
}
