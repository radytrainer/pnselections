"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Info, Pencil, Plus } from "lucide-react";
import {
  activateCycle,
  createCycle,
  listCyclesForAdmin,
  updateCycle,
  type CycleDetail,
  type CycleStatus,
} from "@/services/lookupService";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<CycleStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  planning: { label: "Planning", className: "bg-sky-100 text-sky-800 hover:bg-sky-100" },
  closed: { label: "Closed", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-500 hover:bg-slate-100" },
};

type FormState = {
  year: string;
  name: string;
  start_date: string;
  end_date: string;
  exam_pass_threshold: string;
};

type DialogState = { mode: "create" } | { mode: "edit"; cycle: CycleDetail };

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function SelectionCyclesPage() {
  const { role, loading: roleLoading } = useRole();
  const [cycles, setCycles] = useState<CycleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [form, setForm] = useState<FormState>({ year: "", name: "", start_date: "", end_date: "", exam_pass_threshold: "50" });
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<CycleDetail | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return listCyclesForAdmin()
      .then(setCycles)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load selection cycles"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCycle = cycles.find((c) => c.status === "active") ?? null;

  function openCreate() {
    const nextYear = Math.max(new Date().getFullYear(), ...cycles.map((c) => c.year + 1));
    setForm({
      year: String(nextYear),
      name: `${nextYear} Selection Cycle`,
      start_date: `${nextYear}-01-01`,
      end_date: "",
      exam_pass_threshold: String(activeCycle?.exam_pass_threshold ?? 50),
    });
    setDialog({ mode: "create" });
  }

  function openEdit(cycle: CycleDetail) {
    setForm({
      year: String(cycle.year),
      name: cycle.name,
      start_date: cycle.start_date?.slice(0, 10) ?? "",
      end_date: cycle.end_date?.slice(0, 10) ?? "",
      exam_pass_threshold: String(cycle.exam_pass_threshold ?? 50),
    });
    setDialog({ mode: "edit", cycle });
  }

  function onYearChange(year: string) {
    // Keep the suggested name in step with the year while it's still the default.
    setForm((f) => ({
      ...f,
      year,
      name: f.name === `${f.year} Selection Cycle` ? `${year} Selection Cycle` : f.name,
    }));
  }

  async function handleSave() {
    if (!dialog) return;
    const year = Number(form.year);
    const threshold = Number(form.exam_pass_threshold);
    if (dialog.mode === "create" && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
      toast.error("Enter a valid year");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.start_date) {
      toast.error("Start date is required");
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      toast.error("Exam pass mark must be between 0 and 100");
      return;
    }
    const input = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      exam_pass_threshold: threshold,
    };
    setSaving(true);
    try {
      if (dialog.mode === "create") {
        await createCycle({ ...input, year });
        toast.success(`${input.name} created. Press "Make active" when this generation starts.`);
      } else {
        await updateCycle(dialog.cycle.id, input);
        toast.success("Cycle updated");
      }
      setDialog(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save cycle");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!activating) return;
    setIsActivating(true);
    try {
      await activateCycle(activating.id);
      toast.success(`${activating.name} is now the active cycle`);
      setActivating(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to activate cycle");
    } finally {
      setIsActivating(false);
    }
  }

  if (roleLoading || (loading && cycles.length === 0)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!can(role, "manageCycles")) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Selection Cycles</h1>
          <p className="text-sm text-muted-foreground">
            Each cycle is one generation of students. Pages show the active cycle by default.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          New Cycle
        </Button>
      </div>

      <Card size="sm">
        <CardContent className="flex gap-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-1 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Starting a new generation:</span> create its cycle, then
              press <span className="font-medium text-foreground">Make active</span>. New students are added to the
              active cycle, and Dashboard, Map, Students, Committee Queue, Finalists, Selection Process and Field Mode
              show it by default.
            </p>
            <p>
              The previous cycle is closed, not deleted. Its students and results stay unchanged and can be viewed any
              time by picking it in each page&apos;s cycle dropdown.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Exam pass mark</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.length ? (
              cycles.map((cycle) => {
                const status = STATUS_STYLES[cycle.status] ?? STATUS_STYLES.closed;
                return (
                  <TableRow key={cycle.id} className={cn(cycle.status === "active" && "bg-emerald-50/50")}>
                    <TableCell className="font-semibold">{cycle.year}</TableCell>
                    <TableCell>{cycle.name}</TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(cycle.start_date)}</TableCell>
                    <TableCell>{formatDate(cycle.end_date)}</TableCell>
                    <TableCell className="text-right">{Number(cycle.exam_pass_threshold ?? 0)}%</TableCell>
                    <TableCell className="text-right">{cycle.student_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {cycle.status !== "active" && (
                          <Button variant="outline" size="sm" onClick={() => setActivating(cycle)}>
                            <CheckCircle2 className="size-4" />
                            Make active
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${cycle.name}`} onClick={() => openEdit(cycle)}>
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No selection cycles yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Cycle" : "New Selection Cycle"}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit"
                ? "Changes apply to this cycle only."
                : "Creates the cycle in Planning. It won't affect any page until you make it active."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cycle-year">Year</Label>
                <Input
                  id="cycle-year"
                  type="number"
                  inputMode="numeric"
                  value={form.year}
                  disabled={dialog?.mode === "edit"}
                  onChange={(e) => onYearChange(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cycle-name">Name</Label>
                <Input
                  id="cycle-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cycle-start">Start date</Label>
                <Input
                  id="cycle-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cycle-end">End date (optional)</Label>
                <Input
                  id="cycle-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-threshold">Exam pass mark (%)</Label>
              <Input
                id="cycle-threshold"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.exam_pass_threshold}
                onChange={(e) => setForm((f) => ({ ...f, exam_pass_threshold: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : dialog?.mode === "edit" ? "Save changes" : "Create cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activating !== null} onOpenChange={(open) => !open && setActivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make {activating?.name} active?</DialogTitle>
            <DialogDescription>
              Switch the cycle that every page shows by default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  New students will be added to <span className="font-medium">{activating?.year}</span>, and every
                  page will show this cycle by default.
                </p>
                {activeCycle && (
                  <p>
                    <span className="font-medium">{activeCycle.name}</span> ({activeCycle.student_count} students)
                    will be closed. Nothing is deleted. It stays available in each page&apos;s cycle dropdown.
                  </p>
                )}
                <p>Anyone using the app should refresh the page after this change.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivating(null)} disabled={isActivating}>
              Cancel
            </Button>
            <Button onClick={handleActivate} disabled={isActivating}>
              {isActivating ? "Activating..." : "Make active"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
