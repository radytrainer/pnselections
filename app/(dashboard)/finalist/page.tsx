"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AlertTriangle, Award, BarChart3, Building2, Clock, Download, GraduationCap, Undo2, Users } from "lucide-react";
import { listFinalists, type StudentListItem } from "@/services/studentService";
import { recordCommitteeDecision, sendToCommittee } from "@/services/committeeService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { RoleGate } from "@/components/layout/RoleGate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FinalistReport } from "@/components/finalist/FinalistReport";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { MAX_ELIGIBLE_AGE, MIN_ELIGIBLE_AGE, POOR_LEVELS, POOR_LEVEL_BADGE_CLASSES } from "@/lib/constants";
import { getAge, getLatestVisit, getMajor, isAgeOutOfRange } from "@/features/social-form/derived";
import { cn } from "@/lib/utils";

const POOR_LEVEL_BAR_CLASSES: Record<string, string> = {
  "A+": "bg-green-500",
  A: "bg-green-400",
  "A-": "bg-green-300",
  "B+": "bg-orange-500",
  B: "bg-orange-400",
  "B-": "bg-orange-300",
};

const EXPORT_HEADER = ["Code", "Name", "Gender", "Age", "Province", "School", "NGO", "Poor Level"];
const EXPORT_COLUMN_WIDTHS = [
  { wch: 12 },
  { wch: 24 },
  { wch: 10 },
  { wch: 8 },
  { wch: 18 },
  { wch: 24 },
  { wch: 24 },
  { wch: 12 },
];

function buildExportSheet(data: StudentListItem[]) {
  const rows = data.map((student) => [
    student.student_code,
    `${student.first_name} ${student.last_name}`,
    student.gender,
    getAge(student) ?? "",
    student.provinces?.name_en ?? "",
    student.school_partners?.school_name ?? "",
    student.ngo_partners?.organization_name ?? "",
    student.committee_decisions?.poor_level ?? "",
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADER, ...rows]);
  sheet["!cols"] = EXPORT_COLUMN_WIDTHS;
  return sheet;
}

function exportFinalistsToExcel(selected: StudentListItem[], waitlisted: StudentListItem[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildExportSheet(selected), "Main List");
  XLSX.utils.book_append_sheet(workbook, buildExportSheet(waitlisted), "Waiting List");
  XLSX.writeFile(workbook, `finalists-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function emptyGenderCounts() {
  return { male: 0, female: 0, "lgbtqia+": 0 };
}

function summarize(data: StudentListItem[]) {
  const gender = emptyGenderCounts();
  const genderByNgo = { ngo: emptyGenderCounts(), none: emptyGenderCounts() };
  let withNgo = 0;
  let withoutNgo = 0;
  let outOfAgeRange = 0;
  let scienceMajor = 0;
  let socialScienceMajor = 0;
  const poorLevels = Object.fromEntries(POOR_LEVELS.map((level) => [level, 0])) as Record<
    (typeof POOR_LEVELS)[number],
    number
  >;

  for (const student of data) {
    gender[student.gender] += 1;
    if (student.ngo_partners) {
      withNgo += 1;
      genderByNgo.ngo[student.gender] += 1;
    } else {
      withoutNgo += 1;
      genderByNgo.none[student.gender] += 1;
    }
    const level = student.committee_decisions?.poor_level;
    if (level && level in poorLevels) poorLevels[level as (typeof POOR_LEVELS)[number]] += 1;
    if (isAgeOutOfRange(getAge(student))) outOfAgeRange += 1;
    const major = getLatestVisit(student)?.major;
    if (major === "science") scienceMajor += 1;
    else if (major === "social_science") socialScienceMajor += 1;
  }

  return { gender, genderByNgo, withNgo, withoutNgo, poorLevels, outOfAgeRange, scienceMajor, socialScienceMajor };
}

function SplitBar({
  leftLabel,
  leftValue,
  leftClass,
  rightLabel,
  rightValue,
  rightClass,
}: {
  leftLabel: string;
  leftValue: number;
  leftClass: string;
  rightLabel: string;
  rightValue: number;
  rightClass: string;
}) {
  const total = leftValue + rightValue;
  const leftPct = total > 0 ? Math.round((leftValue / total) * 100) : 50;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>
          {leftLabel} <span className="font-semibold">{leftValue}</span>
        </span>
        <span>
          {rightLabel} <span className="font-semibold">{rightValue}</span>
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {total > 0 ? (
          <>
            <div className={cn("h-full", leftClass)} style={{ width: `${leftPct}%` }} />
            <div className={cn("h-full", rightClass)} style={{ width: `${100 - leftPct}%` }} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function FinalistSummary({ data }: { data: StudentListItem[] }) {
  const summary = useMemo(() => summarize(data), [data]);
  const maxPoorLevel = Math.max(1, ...POOR_LEVELS.map((level) => summary.poorLevels[level]));

  return (
    <div className="space-y-3">
      {summary.outOfAgeRange > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {summary.outOfAgeRange} student{summary.outOfAgeRange === 1 ? "" : "s"} outside the eligible age range
            ({MIN_ELIGIBLE_AGE}–{MAX_ELIGIBLE_AGE}) — check the Age column below.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" />
                <CardDescription>Gender</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">{data.length} total</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const gTotal = summary.gender.male + summary.gender.female + summary.gender["lgbtqia+"];
              const malePct = gTotal > 0 ? (summary.gender.male / gTotal) * 100 : 0;
              const femalePct = gTotal > 0 ? (summary.gender.female / gTotal) * 100 : 0;
              const lgbtPct = gTotal > 0 ? (summary.gender["lgbtqia+"] / gTotal) * 100 : 0;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm flex-wrap gap-x-3 gap-y-1">
                    <span>Male <span className="font-semibold">{summary.gender.male}</span></span>
                    <span>Female <span className="font-semibold">{summary.gender.female}</span></span>
                    <span>LGBTQIA+ <span className="font-semibold">{summary.gender["lgbtqia+"]}</span></span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    {gTotal > 0 && (
                      <>
                        <div className="h-full bg-blue-500" style={{ width: `${malePct}%` }} />
                        <div className="h-full bg-rose-400" style={{ width: `${femalePct}%` }} />
                        <div className="h-full bg-purple-500" style={{ width: `${lgbtPct}%` }} />
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 border-t pt-3 text-xs">
              <span></span>
              <span className="text-right font-medium text-muted-foreground">Male</span>
              <span className="text-right font-medium text-muted-foreground">Female</span>
              <span className="text-right font-medium text-muted-foreground">LGBT+</span>
              <span className="text-muted-foreground">NGO</span>
              <span className="text-right font-semibold">{summary.genderByNgo.ngo.male}</span>
              <span className="text-right font-semibold">{summary.genderByNgo.ngo.female}</span>
              <span className="text-right font-semibold">{summary.genderByNgo.ngo["lgbtqia+"]}</span>
              <span className="text-muted-foreground">None NGO</span>
              <span className="text-right font-semibold">{summary.genderByNgo.none.male}</span>
              <span className="text-right font-semibold">{summary.genderByNgo.none.female}</span>
              <span className="text-right font-semibold">{summary.genderByNgo.none["lgbtqia+"]}</span>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="size-4 text-muted-foreground" />
                <CardDescription>NGO</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">{data.length} total</span>
            </div>
          </CardHeader>
          <CardContent>
            <SplitBar
              leftLabel="NGO"
              leftValue={summary.withNgo}
              leftClass="bg-indigo-500"
              rightLabel="None"
              rightValue={summary.withoutNgo}
              rightClass="bg-slate-300"
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <GraduationCap className="size-4 text-muted-foreground" />
                <CardDescription>Major</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">{data.length} total</span>
            </div>
          </CardHeader>
          <CardContent>
            <SplitBar
              leftLabel="Science"
              leftValue={summary.scienceMajor}
              leftClass="bg-cyan-500"
              rightLabel="Social Science"
              rightValue={summary.socialScienceMajor}
              rightClass="bg-fuchsia-500"
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Award className="size-4 text-muted-foreground" />
                <CardDescription>Poor Levels</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">{data.length} total</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {POOR_LEVELS.map((level) => {
              const value = summary.poorLevels[level];
              return (
                <div key={level} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 font-medium text-muted-foreground">{level}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    {value > 0 && (
                      <div
                        className={cn("h-full rounded-full", POOR_LEVEL_BAR_CLASSES[level])}
                        style={{ width: `${(value / maxPoorLevel) * 100}%` }}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "w-4 shrink-0 text-right font-semibold",
                      value === 0 && "text-muted-foreground/50",
                    )}
                  >
                    {value}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const MOVE_TARGET_META: Record<"selected" | "waitlisted", { label: string; icon: typeof Award; verb: string }> = {
  selected: { label: "Move to Main List", icon: Award, verb: "the main list" },
  waitlisted: { label: "Move to Waiting List", icon: Clock, verb: "the waiting list" },
};

function FinalistTable({
  data,
  emptyLabel,
  onChanged,
  moveTarget,
}: {
  data: StudentListItem[];
  emptyLabel: string;
  onChanged: () => void;
  /** The other outcome this table's students can be reclassified straight to, without a full committee re-review. */
  moveTarget?: "selected" | "waitlisted";
}) {
  const handleSendBack = async (student: StudentListItem) => {
    if (
      !window.confirm(
        `Send ${student.first_name} ${student.last_name} back to the committee? This clears their decision and poor level.`,
      )
    ) {
      return;
    }
    try {
      await sendToCommittee(student.id);
      toast.success("Sent back to committee");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send back to committee");
    }
  };

  const handleMoveTo = async (student: StudentListItem, target: "selected" | "waitlisted") => {
    if (!window.confirm(`Move ${student.first_name} ${student.last_name} to ${MOVE_TARGET_META[target].verb}?`)) {
      return;
    }
    try {
      await recordCommitteeDecision({
        studentId: student.id,
        cycleId: student.cycle_id,
        decision: target,
        poorLevel: (student.committee_decisions?.poor_level ?? undefined) as (typeof POOR_LEVELS)[number] | undefined,
      });
      toast.success(`Moved to ${MOVE_TARGET_META[target].verb}`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move student");
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Major</TableHead>
            <TableHead>Province</TableHead>
            <TableHead>NGO</TableHead>
            <TableHead>Poor Level</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length ? (
            data.map((student) => {
              const age = getAge(student);
              const flagged = isAgeOutOfRange(age);
              return (
                <TableRow key={student.id}>
                  <TableCell>
                    <Link href={`/students/${student.id}`} className="font-medium hover:underline">
                      {student.first_name} {student.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{student.gender}</TableCell>
                  <TableCell>
                    {age != null ? (
                      <span
                        className={cn("inline-flex items-center gap-1", flagged && "font-semibold text-red-600")}
                        title={
                          flagged ? `Outside the ${MIN_ELIGIBLE_AGE}–${MAX_ELIGIBLE_AGE} eligible age range` : undefined
                        }
                      >
                        {flagged && <AlertTriangle className="size-3.5" />}
                        {age}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{getMajor(student) ?? "—"}</TableCell>
                  <TableCell>{student.provinces?.name_en ?? "—"}</TableCell>
                  <TableCell>{student.ngo_partners?.organization_name ?? "—"}</TableCell>
                  <TableCell>
                    {student.committee_decisions?.poor_level ? (
                      <Badge className={cn(POOR_LEVEL_BADGE_CLASSES[student.committee_decisions.poor_level])}>
                        {student.committee_decisions.poor_level}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleGate capability="recordCommitteeDecision">
                      <div className="flex items-center gap-1">
                        {moveTarget &&
                          (() => {
                            const { label, icon: MoveIcon } = MOVE_TARGET_META[moveTarget];
                            return (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => handleMoveTo(student, moveTarget)}
                                    />
                                  }
                                >
                                  <MoveIcon className="size-4" />
                                </TooltipTrigger>
                                <TooltipContent>{label}</TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" onClick={() => handleSendBack(student)} />
                            }
                          >
                            <Undo2 className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent>Send Back to Committee</TooltipContent>
                        </Tooltip>
                      </div>
                    </RoleGate>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function FinalistPage() {
  const { cycles, cycleId, setCycleId } = useCycleFilter();
  const [selected, setSelected] = useState<StudentListItem[]>([]);
  const [waitlisted, setWaitlisted] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [selectedList, waitlistedList] = await Promise.all([
        listFinalists("selected", cycleId || undefined),
        listFinalists("waitlisted", cycleId || undefined),
      ]);
      setSelected(selectedList);
      setWaitlisted(waitlistedList);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load finalists");
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Finalists</h1>
          <p className="text-sm text-muted-foreground">
            Students the committee has decided on, grouped by outcome.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CycleSelect cycles={cycles} value={cycleId} allowAll onChange={setCycleId} className="w-48" />
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => exportFinalistsToExcel(selected, waitlisted)}
          >
            <Download className="size-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading finalists...</p>
      ) : (
        <Tabs defaultValue="final">
          <TabsList>
            <TabsTrigger value="final" className="gap-1.5">
              <Award className="size-4" />
              Main List ({selected.length})
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1.5">
              <BarChart3 className="size-4" />
              Report
            </TabsTrigger>
            <TabsTrigger value="waiting" className="gap-1.5">
              <Clock className="size-4" />
              Waiting List ({waitlisted.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="final" className="mt-4 space-y-4">
            <FinalistTable
              data={selected}
              emptyLabel="No students selected yet."
              onChanged={fetchData}
              moveTarget="waitlisted"
            />
          </TabsContent>
          <TabsContent value="report" className="mt-4 space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Main List</h2>
              <FinalistSummary data={selected} />
            </div>
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Waiting List</h2>
              <FinalistSummary data={waitlisted} />
            </div>
            <FinalistReport selected={selected} waitlisted={waitlisted} />
          </TabsContent>
          <TabsContent value="waiting" className="mt-4 space-y-4">
            <FinalistTable
              data={waitlisted}
              emptyLabel="No students on the waiting list."
              onChanged={fetchData}
              moveTarget="selected"
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
