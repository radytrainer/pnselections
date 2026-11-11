"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AlertTriangle, Award, BarChart3, Clock, Download, Undo2 } from "lucide-react";
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
import { CycleSelect } from "@/components/forms/CycleSelect";
import { SearchInput, matchesSearch } from "@/components/forms/SearchInput";
import { RoleGate } from "@/components/layout/RoleGate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FinalistReportView } from "@/components/finalist/FinalistReportView";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { MAX_ELIGIBLE_AGE, MIN_ELIGIBLE_AGE, POOR_LEVELS, POOR_LEVEL_BADGE_CLASSES } from "@/lib/constants";
import {
  getAge,
  getLatestVisit,
  getMajor,
  isAgeOutOfRange,
} from "@/features/social-form/derived";
import { cn } from "@/lib/utils";

const EXPORT_HEADER = ["Code", "Name", "Gender", "Age", "Province", "School", "NGO", "Poor Level", "Poverty Certificate"];
const EXPORT_COLUMN_WIDTHS = [
  { wch: 12 },
  { wch: 24 },
  { wch: 10 },
  { wch: 8 },
  { wch: 18 },
  { wch: 24 },
  { wch: 24 },
  { wch: 12 },
  { wch: 20 },
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
    getLatestVisit(student)?.poverty_certificate ?? "",
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

/** Fields the finalist search looks in. */
function finalistSearchFields(s: StudentListItem) {
  return [
    `${s.first_name} ${s.last_name}`,
    s.student_code,
    s.provinces?.name_en,
    s.school_partners?.school_name,
    s.ngo_partners?.organization_name,
    s.gender,
    getMajor(s),
    s.committee_decisions?.poor_level,
  ];
}

function ListSearch({
  value,
  onChange,
  shown,
  total,
}: {
  value: string;
  onChange: (value: string) => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <SearchInput
        value={value}
        onChange={onChange}
        placeholder="Search name, code, province, school, NGO..."
        aria-label="Search finalists"
        className="sm:w-96"
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {value ? `${shown} of ${total} students` : `${total} students`}
      </p>
    </div>
  );
}

export default function FinalistPage() {
  const { cycles, cycleId, setCycleId, loading: cyclesLoading } = useCycleFilter();
  const fetchSeq = useRef(0);
  const [selected, setSelected] = useState<StudentListItem[]>([]);
  const [waitlisted, setWaitlisted] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  // One search for both lists, so switching tabs keeps what you typed.
  const [search, setSearch] = useState("");
  const shownSelected = useMemo(
    () => selected.filter((s) => matchesSearch(search, finalistSearchFields(s))),
    [selected, search],
  );
  const shownWaitlisted = useMemo(
    () => waitlisted.filter((s) => matchesSearch(search, finalistSearchFields(s))),
    [waitlisted, search],
  );

  const fetchData = useCallback(async () => {
    if (cyclesLoading) return;
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const [selectedList, waitlistedList] = await Promise.all([
        listFinalists("selected", cycleId || undefined),
        listFinalists("waitlisted", cycleId || undefined),
      ]);
      if (seq !== fetchSeq.current) return;
      setSelected(selectedList);
      setWaitlisted(waitlistedList);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load finalists");
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [cycleId, cyclesLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Finalists</h1>
          <p className="text-sm text-muted-foreground">
            Students the committee has decided on, grouped by outcome.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CycleSelect cycles={cycles} value={cycleId} allowAll onChange={setCycleId} className="min-w-0 flex-1 sm:w-48 sm:flex-none" />
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
            <TabsTrigger value="waiting" className="gap-1.5">
              <Clock className="size-4" />
              Waiting List ({waitlisted.length})
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1.5">
              <BarChart3 className="size-4" />
              Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="final" className="mt-4 space-y-4">
            <ListSearch value={search} onChange={setSearch} shown={shownSelected.length} total={selected.length} />
            <FinalistTable
              data={shownSelected}
              emptyLabel={selected.length === 0 ? "No students selected yet." : `No students match "${search}".`}
              onChanged={fetchData}
              moveTarget="waitlisted"
            />
          </TabsContent>
          <TabsContent value="report" className="mt-4">
            <FinalistReportView selected={selected} waitlisted={waitlisted} />
          </TabsContent>
          <TabsContent value="waiting" className="mt-4 space-y-4">
            <ListSearch value={search} onChange={setSearch} shown={shownWaitlisted.length} total={waitlisted.length} />
            <FinalistTable
              data={shownWaitlisted}
              emptyLabel={
                waitlisted.length === 0 ? "No students on the waiting list." : `No students match "${search}".`
              }
              onChanged={fetchData}
              moveTarget="selected"
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
