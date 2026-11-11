"use client";

import type { ReactNode } from "react";
import { Building2, CalendarDays, ClipboardCheck, GraduationCap, Mic, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StatsEditDialog, type StatsFieldGroup } from "@/components/selection-process/StatsEditDialog";
import {
  BlockHeading,
  Checklist,
  GenderSplit,
  Metric,
  RateBar,
  formatNumber,
  type CheckItem,
} from "@/components/selection-process/primitives";
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

// ---------------------------------------------------------------------------
// Defaults: a section that was never edited has no row yet; treat it as zeros.
// ---------------------------------------------------------------------------
export function infoSessionValues(stats: InformationSessionStats | null) {
  return (
    stats ?? {
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
    }
  );
}

export function examCenterValues(stats: ExamCenterStats | null) {
  return (
    stats ?? {
      centers_total: 0,
      sessions_done: 0,
      sessions_not_done: 0,
      info_sessions_not_linked: 0,
      applicants_total: 0,
      applicants_not_assigned: 0,
      applicants_without_schedule: 0,
    }
  );
}

export function examResultValues(stats: ExamResultStats | null) {
  return (
    stats ?? {
      attended: 0,
      absent: 0,
      partially_attended: 0,
      still_to_be_done: 0,
      passed: 0,
      passed_girls: 0,
      passed_boys: 0,
    }
  );
}

export function interviewCenterValues(stats: InterviewCenterStats | null) {
  return (
    stats ?? {
      centers_total: 0,
      sessions_done: 0,
      sessions_not_done: 0,
      exam_centers_not_linked: 0,
      applicants_eligible: 0,
      applicants_not_assigned: 0,
      applicants_without_schedule: 0,
    }
  );
}

export function interviewResultValues(stats: InterviewResultStats | null) {
  return stats ?? { attended: 0, absent: 0, still_to_be_done: 0, passed: 0, passed_girls: 0, passed_boys: 0 };
}

// ---------------------------------------------------------------------------
// Open issues per stage, shared by each card's checklist and the page's
// "Needs attention" panel so the two can never disagree.
// ---------------------------------------------------------------------------
export function infoSessionChecks(stats: InformationSessionStats | null): CheckItem[] {
  const s = infoSessionValues(stats);
  return [
    { count: s.sessions_without_date, missingLabel: "sessions without a date", okLabel: "All sessions have a date" },
    {
      count: s.sessions_without_hosting_partner,
      missingLabel: "sessions without a hosting partner",
      okLabel: "All sessions have a hosting partner",
    },
    {
      count: s.sessions_without_expected_number,
      missingLabel: "sessions without an expected number",
      okLabel: "All sessions have an expected number",
    },
  ];
}

export function examCenterChecks(stats: ExamCenterStats | null): CheckItem[] {
  const s = examCenterValues(stats);
  return [
    {
      count: s.info_sessions_not_linked,
      missingLabel: "information sessions not linked to an exam center",
      okLabel: "All information sessions are linked to an exam center",
    },
    {
      count: s.applicants_not_assigned,
      missingLabel: "applicants not assigned to an exam center",
      okLabel: "All applicants are assigned to an exam center",
    },
    {
      count: s.applicants_without_schedule,
      missingLabel: "applicants without an exam schedule",
      okLabel: "All applicants have an exam schedule",
    },
  ];
}

export function examResultChecks(stats: ExamResultStats | null): CheckItem[] {
  const s = examResultValues(stats);
  return [{ count: s.still_to_be_done, missingLabel: "exams still to be done", okLabel: "All exams are done" }];
}

export function interviewCenterChecks(stats: InterviewCenterStats | null): CheckItem[] {
  const s = interviewCenterValues(stats);
  return [
    {
      count: s.exam_centers_not_linked,
      missingLabel: "exam centers not linked to an interview center",
      okLabel: "All exam centers are linked to an interview center",
    },
    {
      count: s.applicants_not_assigned,
      missingLabel: "eligible applicants not assigned to an interview center",
      okLabel: "All eligible applicants are assigned to an interview center",
    },
    {
      count: s.applicants_without_schedule,
      missingLabel: "applicants without an interview schedule",
      okLabel: "All assigned applicants have an interview schedule",
    },
  ];
}

export function interviewResultChecks(stats: InterviewResultStats | null): CheckItem[] {
  const s = interviewResultValues(stats);
  return [
    { count: s.still_to_be_done, missingLabel: "interviews still to be done", okLabel: "All interviews are done" },
  ];
}

// ---------------------------------------------------------------------------
// Shared card shell: numbered step, title, description, Edit.
// ---------------------------------------------------------------------------
export const STAGE_ACCENTS = {
  indigo: "bg-indigo-100 text-indigo-700",
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
} as const;

function StageCard({
  step,
  icon: Icon,
  accent,
  title,
  description,
  canEdit,
  groups,
  values,
  onSave,
  children,
  className,
}: {
  step: number;
  icon: LucideIcon;
  accent: keyof typeof STAGE_ACCENTS;
  title: string;
  description: string;
  canEdit: boolean;
  groups: StatsFieldGroup[];
  values: Record<string, unknown>;
  onSave: (values: Record<string, number>) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card id={`stage-${step}`} className={cn("scroll-mt-6", className)}>
      <CardHeader className="border-b pb-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", STAGE_ACCENTS[accent])}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {canEdit && <StatsEditDialog title={title} groups={groups} values={values} onSave={onSave} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">{children}</CardContent>
    </Card>
  );
}

type CardProps<T> = { stats: T | null; cycleId: string; canEdit: boolean; onSaved: () => void };

// ---------------------------------------------------------------------------
// 1. Information sessions
// ---------------------------------------------------------------------------
export function InformationSessionsCard({ stats, cycleId, canEdit, onSaved, className }: CardProps<InformationSessionStats> & { className?: string }) {
  const s = infoSessionValues(stats);
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
    <StageCard
      step={1}
      icon={CalendarDays}
      accent="indigo"
      title="Information Sessions"
      description="Outreach sessions held to recruit applicants"
      canEdit={canEdit}
      groups={groups}
      values={s}
      className={className}
      onSave={async (values) => {
        await saveInformationSessionStats(cycleId, values);
        onSaved();
      }}
    >
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-0 lg:divide-x">
        <section className="space-y-3 lg:pr-6">
          <BlockHeading aside={`${formatNumber(sessionsTotal)} total`}>Sessions</BlockHeading>
          <div className="grid grid-cols-3 gap-2">
            <Metric value={s.sessions_done} label="Done" tone={s.sessions_done > 0 ? "success" : "default"} />
            <Metric value={s.sessions_planned} label="Planned" />
            <Metric value={s.sessions_without_date} label="No date" tone={s.sessions_without_date > 0 ? "warning" : "default"} />
          </div>
          <RateBar label="Completed" value={s.sessions_done} total={sessionsTotal} />
        </section>

        <section className="space-y-3 lg:px-6">
          <BlockHeading>Attendance</BlockHeading>
          <div className="grid grid-cols-3 gap-2">
            <Metric value={expectedTotal} label="Expected" />
            <Metric value={actualTotal} label="So far" />
            <Metric value={additionalTotal} label="Additional" />
          </div>
          <RateBar label="Turnout vs expected" value={actualTotal} total={expectedTotal} />
          <GenderSplit girls={s.attendees_actual_girls} boys={s.attendees_actual_boys} />
        </section>

        <section className="space-y-3 lg:pl-6">
          <BlockHeading>Applicants</BlockHeading>
          <Metric value={s.applicants_total} label="Applied" emphasis />
          <RateBar label="Applied after attending" value={s.applicants_total} total={actualTotal} />
          <GenderSplit girls={s.applicants_girls} boys={s.applicants_boys} />
        </section>
      </div>
      <div className="border-t pt-4">
        <Checklist items={infoSessionChecks(stats)} />
      </div>
    </StageCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Exam centers
// ---------------------------------------------------------------------------
export function ExamCentersCard({ stats, cycleId, canEdit, onSaved }: CardProps<ExamCenterStats>) {
  const s = examCenterValues(stats);

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
    <StageCard
      step={2}
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
      <section className="space-y-3">
        <BlockHeading>Centers & sessions</BlockHeading>
        <div className="grid grid-cols-3 gap-2">
          <Metric value={s.centers_total} label="Centers" />
          <Metric value={s.sessions_done} label="Done" tone={s.sessions_done > 0 ? "success" : "default"} />
          <Metric value={s.sessions_not_done} label="Not done" tone={s.sessions_not_done > 0 ? "warning" : "default"} />
        </div>
        <RateBar label="Sessions completed" value={s.sessions_done} total={s.sessions_done + s.sessions_not_done} />
      </section>
      <section className="space-y-3">
        <BlockHeading aside={`${formatNumber(s.applicants_total)} applicants`}>Readiness</BlockHeading>
        <Checklist items={examCenterChecks(stats)} />
      </section>
    </StageCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Exam results
// ---------------------------------------------------------------------------
export function ExamResultsCard({ stats, cycleId, canEdit, onSaved }: CardProps<ExamResultStats>) {
  const s = examResultValues(stats);

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
    <StageCard
      step={3}
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
      <section className="space-y-3">
        <BlockHeading>Attendance</BlockHeading>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric value={s.attended} label="Attended" />
          <Metric value={s.absent} label="Absent" />
          <Metric value={s.partially_attended} label="Partial" />
          <Metric value={s.still_to_be_done} label="To do" tone={s.still_to_be_done > 0 ? "danger" : "default"} />
        </div>
      </section>
      <section className="space-y-3">
        <BlockHeading>Passed</BlockHeading>
        <Metric value={s.passed} label="Passed the exam" tone="success" emphasis />
        <RateBar label="Pass rate" value={s.passed} total={s.attended} />
        <GenderSplit girls={s.passed_girls} boys={s.passed_boys} />
      </section>
    </StageCard>
  );
}

// ---------------------------------------------------------------------------
// 4. Interview centers
// ---------------------------------------------------------------------------
export function InterviewCentersCard({ stats, cycleId, canEdit, onSaved }: CardProps<InterviewCenterStats>) {
  const s = interviewCenterValues(stats);

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
    <StageCard
      step={4}
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
      <section className="space-y-3">
        <BlockHeading>Centers & sessions</BlockHeading>
        <div className="grid grid-cols-3 gap-2">
          <Metric value={s.centers_total} label="Centers" />
          <Metric value={s.sessions_done} label="Done" tone={s.sessions_done > 0 ? "success" : "default"} />
          <Metric value={s.sessions_not_done} label="Not done" tone={s.sessions_not_done > 0 ? "warning" : "default"} />
        </div>
        <RateBar label="Sessions completed" value={s.sessions_done} total={s.sessions_done + s.sessions_not_done} />
      </section>
      <section className="space-y-3">
        <BlockHeading aside={`${formatNumber(s.applicants_eligible)} eligible`}>Readiness</BlockHeading>
        <Checklist items={interviewCenterChecks(stats)} />
      </section>
    </StageCard>
  );
}

// ---------------------------------------------------------------------------
// 5. Interview results
// ---------------------------------------------------------------------------
export function InterviewResultsCard({ stats, cycleId, canEdit, onSaved }: CardProps<InterviewResultStats>) {
  const s = interviewResultValues(stats);

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
    <StageCard
      step={5}
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
      <section className="space-y-3">
        <BlockHeading>Attendance</BlockHeading>
        <div className="grid grid-cols-3 gap-2">
          <Metric value={s.attended} label="Attended" />
          <Metric value={s.absent} label="Absent" />
          <Metric value={s.still_to_be_done} label="To do" tone={s.still_to_be_done > 0 ? "danger" : "default"} />
        </div>
      </section>
      <section className="space-y-3">
        <BlockHeading>Passed</BlockHeading>
        <Metric value={s.passed} label="Passed the interview" tone="success" emphasis />
        <RateBar label="Pass rate" value={s.passed} total={s.attended} />
        <GenderSplit girls={s.passed_girls} boys={s.passed_boys} />
      </section>
    </StageCard>
  );
}
