"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Mic, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assignInterviewCenter,
  createInterviewCenter,
  deleteInterviewCenter,
  updateInterviewCenter,
  type InterviewCenter,
} from "@/services/interviewCenterService";
import { listStudents, type StudentListItem } from "@/services/studentService";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/**
 * Interview centers for one cycle: add / rename / delete them, and assign
 * students (usually the passers waiting for their interview) to a center.
 */
export function InterviewCentersDialog({
  open,
  onOpenChange,
  cycleId,
  cycleName,
  centers,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
  cycleName: string;
  centers: InterviewCenter[];
  onChanged: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InterviewCenter | null>(null);
  const [busy, setBusy] = useState(false);
  // Opens on "Assign students" when centers exist, else on "Centers" (to add the first one).
  const [tab, setTab] = useState<"centers" | "assign">("centers");
  useEffect(() => {
    if (open) setTab(centers.length ? "assign" : "centers");
    // Only when the dialog opens, not each time a center is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="size-4 text-primary" /> Interview centers · {cycleName}
          </DialogTitle>
          <DialogDescription>Where the Motivation Interviews take place. Assign students ahead of time, or pick the center when recording an interview.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "centers" | "assign")}>
          <TabsList>
            <TabsTrigger value="centers">Centers ({centers.length})</TabsTrigger>
            <TabsTrigger value="assign" disabled={!centers.length}>
              Assign students
            </TabsTrigger>
          </TabsList>

          <TabsContent value="centers" className="mt-3 space-y-3">
            {centers.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No interview centers yet. Add the first one below.</p>}
            <ul className="divide-y rounded-lg border">
              {centers.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  {editing?.id === c.id ? (
                    <>
                      <Input
                        aria-label="Center name"
                        value={editing.name}
                        onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                        className="h-8"
                        autoFocus
                      />
                      <Button
                        size="icon-sm"
                        aria-label="Save name"
                        disabled={busy || !editing.name.trim()}
                        onClick={async () => (await run(() => updateInterviewCenter(c.id, { name: editing.name.trim() }), "Center renamed")) && setEditing(null)}
                      >
                        <Check />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setEditing(null)}>
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {c.students ?? 0} student{c.students === 1 ? "" : "s"}
                      </span>
                      <Button variant="ghost" size="icon-sm" aria-label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => setConfirmDelete(c)}>
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {confirmDelete && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                <span>
                  Delete <strong>{confirmDelete.name}</strong>? {confirmDelete.students ? `${confirmDelete.students} students lose their interview center.` : ""}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={async () => (await run(() => deleteInterviewCenter(confirmDelete.id), "Center deleted")) && setConfirmDelete(null)}
                  >
                    Delete
                  </Button>
                </span>
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (name.trim() && (await run(() => createInterviewCenter(cycleId, { name: name.trim() }), "Interview center added"))) setName("");
              }}
            >
              <Input id="new-interview-center" placeholder="New center, e.g. PNC Phnom Penh" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              <Button type="submit" disabled={busy || !name.trim()}>
                <Plus /> Add
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="assign" className="mt-3">
            {open && centers.length > 0 && <AssignPanel cycleId={cycleId} centers={centers} run={run} busy={busy} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const WAITING = "exam_completed";

function AssignPanel({
  cycleId,
  centers,
  run,
  busy,
}: {
  cycleId: string;
  centers: InterviewCenter[];
  run: (fn: () => Promise<unknown>, ok: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [scope, setScope] = useState<"waiting" | "all">("waiting");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(centers[0]?.id ?? "");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setStudents(null);
    listStudents({ cycleId, status: scope === "waiting" ? WAITING : undefined, hideOut: true, page: 1, pageSize: 500 })
      .then((r) => alive && setStudents(r.data))
      .catch(() => alive && setStudents([]));
    return () => {
      alive = false;
    };
  }, [cycleId, scope, tick]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (students ?? []).filter(
      (s) =>
        (!onlyUnassigned || !s.interview_center_id) &&
        (!t || `${s.first_name} ${s.last_name} ${s.last_name} ${s.first_name} ${s.student_code}`.toLowerCase().includes(t)),
    );
  }, [students, q, onlyUnassigned]);
  const allShown = shown.length > 0 && shown.every((s) => picked.has(s.id));
  const targetName = target === NONE ? "no center" : (centers.find((c) => c.id === target)?.name ?? "");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search students" placeholder="Search name or code" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={scope} onValueChange={(v) => v && setScope(v as "waiting" | "all")}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Which students">
            <SelectValue>{(v: string) => (v === "waiting" ? "Waiting for interview" : "All students")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="waiting">Waiting for interview</SelectItem>
            <SelectItem value="all">All students</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={allShown} onCheckedChange={(v) => setPicked(v === true ? new Set([...picked, ...shown.map((s) => s.id)]) : new Set([...picked].filter((id) => !shown.some((s) => s.id === id))))} />
          Select all shown ({shown.length})
        </label>
        <label className="flex items-center gap-2 text-muted-foreground">
          <Checkbox checked={onlyUnassigned} onCheckedChange={(v) => setOnlyUnassigned(v === true)} />
          Only students without a center
        </label>
      </div>
      <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
        {students === null ? (
          <li className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading students…
          </li>
        ) : shown.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">No students to show.</li>
        ) : (
          shown.map((s) => (
            <li key={s.id}>
              <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50", picked.has(s.id) && "bg-primary/5")}>
                <Checkbox
                  checked={picked.has(s.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(picked);
                    if (v === true) next.add(s.id);
                    else next.delete(s.id);
                    setPicked(next);
                  }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {s.first_name} {s.last_name} <span className="font-mono text-xs text-muted-foreground">{s.student_code}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">{s.interview_center_name ?? "No center"}</span>
              </label>
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">{picked.size} selected</span>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={target} onValueChange={(v) => v && setTarget(v)}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Interview center">
              <SelectValue>{(v: string) => (v === NONE ? "Remove their center" : (centers.find((c) => c.id === v)?.name ?? "Center"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {centers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value={NONE}>Remove their center</SelectItem>
            </SelectContent>
          </Select>
          <Button
            disabled={busy || !picked.size || !target}
            onClick={async () => {
              const ok = await run(
                () => assignInterviewCenter([...picked], target === NONE ? null : target),
                target === NONE ? `${picked.size} students no longer have a center` : `${picked.size} students assigned to ${targetName}`,
              );
              if (ok) {
                setPicked(new Set());
                setTick((t) => t + 1);
              }
            }}
          >
            {target === NONE ? "Remove center" : `Assign ${picked.size || ""} to ${targetName}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
