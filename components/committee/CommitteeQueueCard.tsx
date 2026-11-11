"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowRight, ImageIcon, MapPin, Mars, Rainbow, School, Star, Venus, type LucideIcon } from "lucide-react";
import type { CommitteeQueueItem } from "@/services/committeeService";
import { StudentAvatar } from "@/components/students/StudentAvatar";
import { buttonVariants } from "@/components/ui/button";
import { interviewResultLabel } from "@/features/interview/schema";
import {
  CATEGORY_LABELS,
  isFailedHomeVisit,
  type SocialFormCategory,
} from "@/features/social-form/scoring";
import { pickLatestPhotoPath } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Coloured gender icon shown right after the name (same colours as the Dashboard). */
const GENDER_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  male: { label: "Male", icon: Mars, className: "bg-blue-100 text-blue-600" },
  female: { label: "Female", icon: Venus, className: "bg-pink-100 text-pink-600" },
  "lgbtqia+": { label: "LGBTQIA+", icon: Rainbow, className: "bg-violet-100 text-violet-600" },
};

/** Cards are ~200-260px wide in the grid; used to pick a sharp photo thumbnail. */
const PHOTO_WIDTH = 256;

/** Short forms so the stats row doesn't cut words off on a small card (full label on hover). */
const SHORT_CATEGORY: Partial<Record<SocialFormCategory, string>> = { very_poor: "Very Poor" };

type Tone = "good" | "bad" | "neutral" | "pending";

const TONE_CLASSES: Record<Tone, string> = {
  good: "text-emerald-700",
  bad: "text-red-600",
  neutral: "text-foreground",
  pending: "text-muted-foreground",
};

/** One column of the stats row: big value, small caption. */
function Stat({ value, caption, tone, title }: { value: ReactNode; caption: string; tone: Tone; title?: string }) {
  return (
    <div className="min-w-0 px-1 text-center" title={title}>
      <p className={cn("truncate text-sm leading-tight font-semibold", TONE_CLASSES[tone])}>{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

function homeVisitStat(student: CommitteeQueueItem) {
  const sa = student.social_assessments[0];
  if (!sa) return { value: "—", caption: "No home visit", tone: "pending" as Tone };
  if (isFailedHomeVisit(sa.final_score, sa.manual_failed)) {
    return { value: `${sa.final_score} pts`, caption: "Failed home visit", tone: "bad" as Tone };
  }
  const key = sa.category as SocialFormCategory;
  const category = CATEGORY_LABELS[key] ?? sa.category;
  return { value: `${sa.final_score} pts`, caption: SHORT_CATEGORY[key] ?? category, full: category, tone: "neutral" as Tone };
}

function interviewStat(student: CommitteeQueueItem) {
  const label = interviewResultLabel(student.interviews?.recommendation);
  if (!label) return { value: "Pending", tone: "pending" as Tone };
  return { value: label, tone: (label === "Passed" ? "good" : "bad") as Tone };
}

function ratingStat(student: CommitteeQueueItem) {
  const ratings = student.committee_ratings;
  if (ratings.length === 0) return { value: "—", caption: "No votes", tone: "pending" as Tone };
  const voters = new Set(ratings.map((r) => r.rated_by)).size;
  const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  return {
    value: (
      <span className="inline-flex items-center gap-1">
        {avg.toFixed(1)}
        <Star className="size-3.5 fill-amber-400 text-amber-400" />
      </span>
    ),
    caption: `${voters} vote${voters === 1 ? "" : "s"}`,
    tone: "neutral" as Tone,
  };
}

/**
 * Profile-style card for a student in the committee queue: large photo on
 * top (or initials when there's none), who they are, their home-visit /
 * interview / committee-vote results, and a button to open the case.
 */
export function CommitteeQueueCard({
  student,
  photoUrl,
  actions,
  muted = false,
}: {
  student: CommitteeQueueItem;
  /** Pre-resolved photo URL (bulk-loaded by the page); null when there's no photo. */
  photoUrl: string | null;
  /** Extra buttons next to "Open Case" (e.g. Finished / Undo). */
  actions?: ReactNode;
  /** Dimmed look for cases the user has already marked finished. */
  muted?: boolean;
}) {
  const href = `/committee/${student.id}`;
  const photoPath = pickLatestPhotoPath(student.student_documents);
  const initials = `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase();
  const fullName = `${student.first_name} ${student.last_name}`;
  const eliminated = !!student.elimination_reason;
  const homeVisit = homeVisitStat(student);
  const interview = interviewStat(student);
  const rating = ratingStat(student);
  const gender = GENDER_META[student.gender];

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-2.5 text-card-foreground shadow-sm transition-shadow duration-200 hover:shadow-md",
        eliminated && "border-orange-300",
        muted && "opacity-60",
      )}
    >
      {/* Photo */}
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
          <StudentAvatar
            photoPath={photoPath}
            signedUrl={photoPath ? photoUrl : null}
            initials={initials}
            shape="square"
            size="w-full aspect-[4/3]"
            displayWidth={PHOTO_WIDTH}
            className="object-top text-3xl"
            alt={fullName}
          />
        </Link>
        {eliminated && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            <AlertOctagon className="size-3" />
            Eliminated
          </span>
        )}
        {student.photo_drive_url && (
          <a
            href={student.photo_drive_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${fullName}'s photos`}
            title="View photos"
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
          >
            <ImageIcon className="size-3.5" />
          </a>
        )}
      </div>

      {/* Who */}
      <div className="space-y-1 px-1 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href={href} className="truncate text-sm font-semibold hover:underline" title={fullName}>
            {fullName}
          </Link>
          {gender && (
            <span
              className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", gender.className)}
              title={gender.label}
              aria-label={gender.label}
              role="img"
            >
              <gender.icon className="size-3" />
            </span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{student.provinces?.name_en ?? "No province"}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <School className="size-3 shrink-0" />
          <span className="truncate" title={student.school_partners?.school_name ?? undefined}>
            {student.school_partners?.school_name ?? "No school"}
          </span>
        </p>
        {eliminated && (
          <p className="line-clamp-2 text-xs text-orange-700" title={student.elimination_reason ?? undefined}>
            {student.elimination_reason}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="mt-3 grid grid-cols-3 divide-x">
        <Stat
          value={homeVisit.value}
          caption={homeVisit.caption}
          tone={homeVisit.tone}
          title={`Home visit: ${"full" in homeVisit ? homeVisit.full : homeVisit.caption}`}
        />
        <Stat value={interview.value} caption="Interview" tone={interview.tone} />
        <Stat value={rating.value} caption={rating.caption} tone={rating.tone} title="Committee rating" />
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-1.5 pt-3">
        <Link href={href} className={buttonVariants({ size: "sm", className: "h-8 flex-1 gap-1 rounded-lg" })}>
          Open Case
          <ArrowRight className="size-3.5" />
        </Link>
        {actions}
      </div>
    </div>
  );
}
