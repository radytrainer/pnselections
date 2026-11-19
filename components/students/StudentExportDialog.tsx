"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { buildStudentExport, exportUrl, fetchAllStudents, GROUP_OPTIONS, type GroupBy } from "@/features/student-export/model";
import type { StudentFilters } from "@/services/studentService";

/**
 * Students page → Export: the students matching the page's current filters
 * as a professional list (PN logo, summary, one section per center when
 * grouped), downloaded as PDF (print view → Save as PDF) or Word.
 */
export function StudentExportDialog({
  filters,
  filtersText,
  cycleName,
  count,
  hasExamCenters,
  hasInterviewCenters,
}: {
  filters: Omit<StudentFilters, "page" | "pageSize">;
  /** The active filters in words, printed on the list. */
  filtersText: string;
  cycleName: string;
  /** How many students match (shown on the button). */
  count: number | null;
  hasExamCenters: boolean;
  hasInterviewCenters: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>(hasExamCenters ? "exam" : "none");
  const [wordBusy, setWordBusy] = useState(false);

  const options = GROUP_OPTIONS.filter((o) => (o.value === "exam" ? hasExamCenters : o.value === "interview" ? hasInterviewCenters : true));
  const params = { ...filters, groupBy, cycleName, filtersText };

  function pdf() {
    window.open(exportUrl(params), "_blank", "noopener");
    setOpen(false);
  }

  async function word() {
    setWordBusy(true);
    try {
      const students = await fetchAllStudents(filters);
      const doc = buildStudentExport(students, { ...params, generatedBy: user?.displayName || user?.email || null });
      const { downloadStudentListDocx } = await import("@/features/student-export/docx");
      await downloadStudentListDocx(doc);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the Word file");
    } finally {
      setWordBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          if (!options.some((o) => o.value === groupBy)) setGroupBy("none");
          setOpen(true);
        }}
      >
        <FileDown />
        <span className="hidden sm:inline">Export</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export students</DialogTitle>
            <DialogDescription>
              {count != null ? (
                <>
                  <span className="font-medium text-foreground">{count.toLocaleString()}</span> student{count === 1 ? "" : "s"} matching the current filters
                </>
              ) : (
                "Students matching the current filters"
              )}
              {cycleName ? ` · ${cycleName}` : ""}. Pick one exam or interview center in the filters to export only that center.
            </DialogDescription>
          </DialogHeader>
          {filtersText && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Filters: </span>
              {filtersText}
            </p>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Layout</legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {options.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-md border px-3 py-2 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    groupBy === o.value ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                >
                  <input type="radio" name="export-group" value={o.value} checked={groupBy === o.value} onChange={() => setGroupBy(o.value)} className="sr-only" />
                  <span className="text-sm font-medium">{o.label}</span>
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-muted-foreground">
            A4 landscape with the PN logo, totals by gender and status, and student ID, name, gender, date of birth, age, phone, province, high school, NGO, centers and status.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={word} disabled={wordBusy || count === 0}>
              {wordBusy ? <Loader2 className="animate-spin" /> : <FileText />} Word
            </Button>
            <Button onClick={pdf} disabled={count === 0}>
              <Download /> PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
