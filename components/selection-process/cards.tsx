"use client";

import { useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  GraduationCap,
  Mic,
  type LucideIcon,
  ClipboardCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { StatsEditDialog, type StatsFieldGroup } from "@/components/selection-process/StatsEditDialog";
import { GenderSplit, MetricTile, ProgressBar, StatusChip } from "@/components/selection-process/primitives";
import {
  saveExamCenterStats,
  saveExamResultStats,
  saveInformationSessionStats,
  saveInterviewCenterStats,
  saveInterviewResultStats,
  type ExamCenterStats,
  type ExamResultStats,
  type InformationSessionStats,
  type InterviewCenterStats,
  type InterviewResultStats,
} from "@/services/selectionProcessService";

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const ACCENTS = {
  indigo: "bg-indigo-100 text-indigo-600",
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  violet: "bg-violet-100 text-violet-600",
  amber: "bg-amber-100 text-amber-600",
} as const;

/** Section heading inside a card body, e.g. "Attendance" / "Applicants". */
function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>;
}

function SectionCardShell({
  icon: Icon,
  accent,
  title,
  description,
  canEdit,
  groups,
  values,
  onSave,
  children,
}: {
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  title: string;
  description: string;
  canEdit: boolean;
  groups: StatsFieldGroup[];
  values: Record<string, unknown>;
  onSave: (values: Record<string, number>) => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className={cn("pb-4", open && "border-b")}>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:opacity-80",
              ACCENTS[accent],
            )}
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
          >
            <Icon className="size-5" />
          </button>
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setOpen((v) => !v)}
          >
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <StatsEditDialog title={title} groups={groups} values={values} onSave={onSave} />
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
              aria-expanded={open}
            >
              <ChevronDown className={cn("size-4 transition-transform duration-200", !open && "-rotate-90")} />
            </button>
          </div>
        </div>
      </CardHeader>
      {open && <CardContent className="space-y-5 pt-5">{children}</CardContent>}
    </Card>
  );
}

export function InformationSessionsCard({
  stats,
  cycleId,
  canEdit,
  onSaved,
}: {
  stats: InformationSessionStats | null;
  cycleId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const s = stats ?? {
    sessions_done: 0,
    sessions_planned: 0,
    sessions_without_date: 0,
    sessions_without_hosting_partner: 0,
    attendees_expected_boys: 0,
    attendees_expected_girls: 0,
    attendees_actual_boys: 0,
    attendees_actual_girls: 0,
    additional_expected_boys: 0,
    additional_expected_girls: 0,
    sessions_without_expected_number: 0,
    applicants_total: 0,
    applicants_girls: 0,
    applicants_boys: 0,
  };
  const sessionsTotal = s.sessions_done + s.sessions_planned + s.sessions_without_date;
  const expectedTotal = s.attendees_expected_boys + s.attendees_expected_girls;
  const actualTotal = s.attendees_actual_boys + s.attendees_actual_girls;
  const additionalTotal = s.additional_expected_boys + s.additional_expected_girls;

  const groups: StatsFieldGroup[] = [
    {
      title: "Sessions",
      fields: [
        { key: "sessions_done", label: "Done" },
        { key: "sessions_planned", label: "Planned" },
        { key: "sessions_without_date", label: "Without date yet" },
        { key: "sessions_without_hosting_partner", label: "Without hosting partner" },
      ],
    },
    {
      title: "Attendance",
      fields: [
        { key: "attendees_expected_boys", label: "Expected — boys" },
        { key: "attendees_expected_girls", label: "Expected — girls" },
        { key: "attendees_actual_boys", label: "So far — boys" },
        { key: "attendees_actual_girls", label: "So far — girls" },
        { key: "additional_expected_boys", label: "Additional expected — boys" },
        { key: "additional_expected_girls", label: "Additional expected — girls" },
        { key: "sessions_without_expected_number", label: "Sessions without expected number" },
      ],
    },
    {
      title: "Applicants",
      fields: [
        { key: "applicants_total", label: "Total applicants" },
        { key: "applicants_girls", label: "Girls" },
        { key: "applicants_boys", label: "Boys" },
      ],
    },
  ];

  return (
    <SectionCardShell
      icon={CalendarDays}
      accent="indigo"
      title="Information Sessions"
      description="Outreach sessions held to recruit applicants"
      canEdit={canEdit}
      groups={groups}
      values={s}
      onSave={async (values) => {
        await saveInformationSessionStats(cycleId, values);
        onSaved();
      }}
    >
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <SubHeading>Sessions</SubHeading>
          <span className="text-2xl font-bold leading-none">{sessionsTotal}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MetricTile value={s.sessions_done} label="Done" />
          <MetricTile value={s.sessions_planned} label="Planned" />
          <MetricTile value={s.sessions_without_date} label="No Date" tone={s.sessions_without_date > 0 ? "warning" : "default"} />
        </div>
        <StatusChip
          count={s.sessions_without_hosting_partner}
          missingLabel="sessions without hosting partner"
          okLabel="All sessions have a hosting partner"
        />
      </div>

      <Separator />

      <div className="space-y-2.5">
        <SubHeading>Attendance</SubHeading>
        <div className="grid grid-cols-3 gap-2">
          <MetricTile value={expectedTotal} label="Expected" />
          <MetricTile value={actualTotal} label="So Far" />
          <MetricTile value={additionalTotal} label="Additional" />
        </div>
        {actualTotal > 0 && <GenderSplit girls={s.attendees_actual_girls} boys={s.attendees_actual_boys} />}
        <StatusChip
          count={s.sessions_without_expected_number}
          missingLabel="sessions without expected number"
          okLabel="All sessions have an expected number"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SubHeading>Applicants</SubHeading>
          <span className="text-sm font-medium text-muted-foreground">
            {pct(s.applicants_total, actualTotal)}% of attendance
          </span>
        </div>
        <p className="text-2xl font-bold leading-none">{s.applicants_total}</p>
        <GenderSplit girls={s.applicants_girls} boys={s.applicants_boys} />
      </div>
    </SectionCardShell>
  );
}

export function ExamCentersCard({
  stats,
  cycleId,
  canEdit,
  onSaved,
}: {
  stats: ExamCenterStats | null;
  cycleId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const s = stats ?? {
    centers_total: 0,
    sessions_done: 0,
    sessions_not_done: 0,
    info_sessions_not_linked: 0,
    applicants_total: 0,
    applicants_not_assigned: 0,
    applicants_without_schedule: 0,
  };

  const groups: StatsFieldGroup[] = [
    {
      title: "Exam Centers",
      fields: [
        { key: "centers_total", label: "Total centers" },
        { key: "sessions_done", label: "Sessions done" },
        { key: "sessions_not_done", label: "Sessions not done" },
      ],
    },
    {
      title: "Information Sessions",
      fields: [{ key: "info_sessions_not_linked", label: "Not linked to an exam center" }],
    },
    {
      title: "Applicants",
      fields: [
        { key: "applicants_total", label: "Total applicants" },
        { key: "applicants_not_assigned", label: "Not assigned to a center" },
        { key: "applicants_without_schedule", label: "Without a schedule" },
      ],
    },
  ];

  return (
    <SectionCardShell
      icon={Building2}
      accent="blue"
      title="Exam Centers"
      description="Venues hosting the entrance exam"
      canEdit={canEdit}
      groups={groups}
      values={s}
      onSave={async (values) => {
        await saveExamCenterStats(cycleId, values);
        onSaved();
      }}
    >
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <SubHeading>Centers</SubHeading>
          <span className="text-2xl font-bold leading-none">{s.centers_total}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricTile value={s.sessions_done} label="Sessions Done" />
          <MetricTile value={s.sessions_not_done} label="Not Done Yet" tone={s.sessions_not_done > 0 ? "warning" : "default"} />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <SubHeading>Information Sessions</SubHeading>
        <StatusChip
          count={s.info_sessions_not_linked}
          missingLabel="not linked to an exam center"
          okLabel="All information sessions are linked to an exam center"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SubHeading>Applicants</SubHeading>
          <span className="text-2xl font-bold leading-none">{s.applicants_total}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip
            count={s.applicants_not_assigned}
            missingLabel="not assigned to a center"
            okLabel="All assigned to an exam center"
          />
          <StatusChip
            count={s.applicants_without_schedule}
            missingLabel="without a schedule"
            okLabel="All have a schedule"
          />
        </div>
      </div>
    </SectionCardShell>
  );
}

export function ExamResultsCard({
  stats,
  cycleId,
  canEdit,
  onSaved,
}: {
  stats: ExamResultStats | null;
  cycleId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const s = stats ?? {
    attended: 0,
    absent: 0,
    partially_attended: 0,
    still_to_be_done: 0,
    passed: 0,
    passed_girls: 0,
    passed_boys: 0,
  };

  const groups: StatsFieldGroup[] = [
    {
      title: "Attendance",
      fields: [
        { key: "attended", label: "Attended" },
        { key: "absent", label: "Absent(s)" },
        { key: "partially_attended", label: "Partially attended" },
        { key: "still_to_be_done", label: "Still to be done" },
      ],
    },
    {
      title: "Passers",
      fields: [
        { key: "passed", label: "Passed" },
        { key: "passed_girls", label: "Passed — girls" },
        { key: "passed_boys", label: "Passed — boys" },
      ],
    },
  ];

  return (
    <SectionCardShell
      icon={GraduationCap}
      accent="emerald"
      title="Exam Results"
      description="Outcomes of the entrance exam"
      canEdit={canEdit}
      groups={groups}
      values={s}
      onSave={async (values) => {
        await saveExamResultStats(cycleId, values);
        onSaved();
      }}
    >
      <div className="space-y-2.5">
        <SubHeading>Attendance</SubHeading>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricTile value={s.attended} label="Attended" />
          <MetricTile value={s.absent} label="Absent" />
          <MetricTile value={s.partially_attended} label="Partial" />
          <MetricTile value={s.still_to_be_done} label="To Do" tone={s.still_to_be_done > 0 ? "danger" : "default"} />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SubHeading>Passers</SubHeading>
          <span className="text-sm font-medium text-muted-foreground">{pct(s.passed, s.attended)}% pass rate</span>
        </div>
        <p className="text-2xl font-bold leading-none">
          {s.passed}
          <span className="text-base font-medium text-muted-foreground">/{s.attended}</span>
        </p>
        <ProgressBar value={s.passed} total={s.attended} />
        <GenderSplit girls={s.passed_girls} boys={s.passed_boys} />
      </div>
    </SectionCardShell>
  );
}

export function InterviewCentersCard({
  stats,
  cycleId,
  canEdit,
  onSaved,
}: {
  stats: InterviewCenterStats | null;
  cycleId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const s = stats ?? {
    centers_total: 0,
    sessions_done: 0,
    sessions_not_done: 0,
    exam_centers_not_linked: 0,
    applicants_eligible: 0,
    applicants_not_assigned: 0,
    applicants_without_schedule: 0,
  };

  const groups: StatsFieldGroup[] = [
    {
      title: "Interview Centers",
      fields: [
        { key: "centers_total", label: "Total centers" },
        { key: "sessions_done", label: "Sessions done" },
        { key: "sessions_not_done", label: "Sessions not done" },
      ],
    },
    {
      title: "From Exam Centers",
      fields: [{ key: "exam_centers_not_linked", label: "Not linked to an interview center" }],
    },
    {
      title: "Applicants",
      fields: [
        { key: "applicants_eligible", label: "Eligible for interview" },
        { key: "applicants_not_assigned", label: "Not assigned to a center" },
        { key: "applicants_without_schedule", label: "Without a schedule" },
      ],
    },
  ];

  return (
    <SectionCardShell
      icon={Mic}
      accent="violet"
      title="Interview Centers"
      description="Venues hosting the interview round"
      canEdit={canEdit}
      groups={groups}
      values={s}
      onSave={async (values) => {
        await saveInterviewCenterStats(cycleId, values);
        onSaved();
      }}
    >
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <SubHeading>Centers</SubHeading>
          <span className="text-2xl font-bold leading-none">{s.centers_total}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricTile value={s.sessions_done} label="Sessions Done" />
          <MetricTile value={s.sessions_not_done} label="Not Done Yet" tone={s.sessions_not_done > 0 ? "warning" : "default"} />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <SubHeading>From Exam Centers</SubHeading>
        <StatusChip
          count={s.exam_centers_not_linked}
          missingLabel="not linked to an interview center"
          okLabel="All exam centers are linked to an interview center"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SubHeading>Applicants</SubHeading>
          <span className="text-2xl font-bold leading-none">{s.applicants_eligible}</span>
        </div>
        <p className="text-xs text-muted-foreground">eligible for interview</p>
        <div className="flex flex-wrap gap-2">
          <StatusChip
            count={s.applicants_not_assigned}
            missingLabel="not assigned to a center"
            okLabel="All assigned to an interview center"
          />
          <StatusChip
            count={s.applicants_without_schedule}
            missingLabel="without a schedule"
            okLabel="All assigned have a schedule"
          />
        </div>
      </div>
    </SectionCardShell>
  );
}

export function InterviewResultsCard({
  stats,
  cycleId,
  canEdit,
  onSaved,
}: {
  stats: InterviewResultStats | null;
  cycleId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const s = stats ?? {
    attended: 0,
    absent: 0,
    still_to_be_done: 0,
    passed: 0,
    passed_girls: 0,
    passed_boys: 0,
  };

  const groups: StatsFieldGroup[] = [
    {
      title: "Attendance",
      fields: [
        { key: "attended", label: "Attended" },
        { key: "absent", label: "Absent(s)" },
        { key: "still_to_be_done", label: "Still to be done" },
      ],
    },
    {
      title: "Passers",
      fields: [
        { key: "passed", label: "Passed" },
        { key: "passed_girls", label: "Passed — girls" },
        { key: "passed_boys", label: "Passed — boys" },
      ],
    },
  ];

  return (
    <SectionCardShell
      icon={ClipboardCheck}
      accent="amber"
      title="Interview Results"
      description="Outcomes of the interview round"
      canEdit={canEdit}
      groups={groups}
      values={s}
      onSave={async (values) => {
        await saveInterviewResultStats(cycleId, values);
        onSaved();
      }}
    >
      <div className="space-y-2.5">
        <SubHeading>Attendance</SubHeading>
        <div className="grid grid-cols-3 gap-2">
          <MetricTile value={s.attended} label="Attended" />
          <MetricTile value={s.absent} label="Absent" />
          <MetricTile value={s.still_to_be_done} label="To Do" tone={s.still_to_be_done > 0 ? "danger" : "default"} />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SubHeading>Passers</SubHeading>
          <span className="text-sm font-medium text-muted-foreground">{pct(s.passed, s.attended)}% pass rate</span>
        </div>
        <p className="text-2xl font-bold leading-none">
          {s.passed}
          <span className="text-base font-medium text-muted-foreground">/{s.attended}</span>
        </p>
        <ProgressBar value={s.passed} total={s.attended} />
        <GenderSplit girls={s.passed_girls} boys={s.passed_boys} />
      </div>
    </SectionCardShell>
  );
}
