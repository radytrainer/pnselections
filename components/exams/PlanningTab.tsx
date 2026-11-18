"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, MonitorUp, Plus, Save, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listProvinces } from "@/services/lookupService";
import { type ExamCenter, type ExamData } from "@/features/written-exam/scoring";
import { createCenter, deleteCenter, saveRooms, saveSessions, updateCenter } from "@/services/writtenExamService";
import { cn } from "@/lib/utils";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type Province = { id: string; name_en: string };
const NONE = "__none__";

export function PlanningTab({ data, canEdit, reload }: TabProps) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [name, setName] = useState("");
  useEffect(() => {
    listProvinces().then(setProvinces).catch(() => {});
  }, []);

  const unassigned = data.candidates.filter((c) => !c.center_id).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {data.centers.length} exam center{data.centers.length === 1 ? "" : "s"} · {data.candidates.length - unassigned} of {data.candidates.length}{" "}
        candidates assigned. Assign candidates on the Candidates tab (select them, then “Assign to center…”).
      </p>
      {data.centers.map((c) => (
        <CenterCard
          key={`${c.id}|${c.name}|${c.province_id}|${c.address}|${c.rooms.map((r) => r.id + r.name + r.capacity).join()}|${c.sessions.map((s) => s.id + s.session_date + s.start_time + s.end_time + s.label).join()}`}
          center={c}
          data={data}
          provinces={provinces}
          canEdit={canEdit}
          reload={reload}
        />
      ))}
      {canEdit && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            try {
              await createCenter(data.cycle.id, { name: name.trim() });
              setName("");
              toast.success("Exam center added");
              await reload();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to add the center");
            }
          }}
        >
          <Input id="new-center-name" placeholder="New exam center, e.g. PNC Phnom Penh" value={name} onChange={(e) => setName(e.target.value)} className="sm:max-w-xs" />
          <Button type="submit" disabled={!name.trim()}>
            <Plus /> Add exam center
          </Button>
        </form>
      )}
    </div>
  );
}

type RoomDraft = { id?: string; name: string; capacity: string };
type SessionDraft = { id?: string; date: string; start: string; end: string; label: string };

function CenterCard({ center, data, provinces, canEdit, reload }: { center: ExamCenter; data: ExamData; provinces: Province[]; canEdit: boolean; reload: () => Promise<void> }) {
  const [title, setTitle] = useState(center.name);
  const [address, setAddress] = useState(center.address ?? "");
  const [rooms, setRooms] = useState<RoomDraft[]>(center.rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity ? String(r.capacity) : "" })));
  const [sessions, setSessions] = useState<SessionDraft[]>(
    center.sessions.map((s) => ({ id: s.id, date: s.session_date, start: s.start_time?.slice(0, 5) ?? "", end: s.end_time?.slice(0, 5) ?? "", label: s.label ?? "" })),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assigned = data.candidates.filter((c) => c.center_id === center.id);
  const roomsDirty = JSON.stringify(rooms) !== JSON.stringify(center.rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity ? String(r.capacity) : "" })));
  const sessionsDirty =
    JSON.stringify(sessions) !==
    JSON.stringify(center.sessions.map((s) => ({ id: s.id, date: s.session_date, start: s.start_time?.slice(0, 5) ?? "", end: s.end_time?.slice(0, 5) ?? "", label: s.label ?? "" })));
  const sessionProblem = sessions.find((s) => !s.date || (s.start && s.end && s.end <= s.start));
  const roomProblem = rooms.find((r) => !r.name.trim() || (r.capacity && !(Number(r.capacity) > 0)));

  async function save(action: () => Promise<unknown>, msg: string) {
    try {
      await action();
      toast.success(msg);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {canEdit ? (
            <Input
              id={`center-name-${center.id}`}
              aria-label="Center name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title.trim() !== center.name && save(() => updateCenter(center.id, { name: title.trim() }), "Center renamed")}
              className="h-8 max-w-sm border-transparent px-1 text-base font-semibold shadow-none hover:border-input focus-visible:border-input"
            />
          ) : (
            <CardTitle>{center.name}</CardTitle>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={center.province_id ?? NONE}
              disabled={!canEdit}
              onValueChange={(v) => save(() => updateCenter(center.id, { provinceId: !v || v === NONE ? null : v }), "Province saved")}
            >
              <SelectTrigger className="w-48" aria-label="Province">
                <SelectValue>{(v: string) => (v === NONE ? "Province not set" : (provinces.find((p) => p.id === v)?.name_en ?? center.province_name ?? "Province"))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Province not set</SelectItem>
                {provinces.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id={`center-address-${center.id}`}
              aria-label="Address"
              placeholder="Address (optional)"
              value={address}
              disabled={!canEdit}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => address !== (center.address ?? "") && save(() => updateCenter(center.id, { address: address.trim() || null }), "Address saved")}
              className="min-w-0 flex-1 sm:max-w-md"
            />
          </div>
          <CardDescription>{assigned.length} candidate{assigned.length === 1 ? "" : "s"} assigned</CardDescription>
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${center.name}`}>
            <Trash2 />
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {/* Sessions */}
        <section className="space-y-2">
          <p className="text-sm font-medium">Sessions</p>
          {sessions.length === 0 && <p className="text-xs text-muted-foreground">No sessions yet.</p>}
          {sessions.map((s, i) => {
            const saved = center.sessions.find((x) => x.id === s.id);
            const count = saved ? data.candidates.filter((c) => c.session_id === saved.id).length : 0;
            return (
              <div key={s.id ?? `new-${i}`} className="space-y-1.5 rounded-lg border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input id={`session-date-${center.id}-${i}`} aria-label="Date" type="date" value={s.date} disabled={!canEdit} onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="w-40" />
                  <Input id={`session-start-${center.id}-${i}`} aria-label="Start time" type="time" value={s.start} disabled={!canEdit} onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="w-28" />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input id={`session-end-${center.id}-${i}`} aria-label="End time" type="time" value={s.end} disabled={!canEdit} onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="w-28" />
                  <Input id={`session-label-${center.id}-${i}`} aria-label="Label" placeholder="Label (e.g. Morning)" value={s.label} disabled={!canEdit} onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="w-36" />
                  {canEdit && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setSessions((l) => l.filter((_, j) => j !== i))} aria-label="Remove session">
                      <X />
                    </Button>
                  )}
                </div>
                {saved && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{count} candidates</span>
                    <a
                      href={`/report/exam-lists?cycleId=${data.cycle.id}&sessionId=${saved.id}&type=wall&print=1`}
                      target="_blank"
                      rel="noopener"
                      className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                    >
                      <MonitorUp /> Display list
                    </a>
                    <a
                      href={`/report/exam-lists?cycleId=${data.cycle.id}&sessionId=${saved.id}&type=attendance&print=1`}
                      target="_blank"
                      rel="noopener"
                      className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                    >
                      <ClipboardList /> Attendance list
                    </a>
                  </div>
                )}
              </div>
            );
          })}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSessions((l) => [...l, { date: "", start: "07:00", end: "10:00", label: "" }])}>
                <Plus /> Add session
              </Button>
              {sessionsDirty && (
                <Button
                  size="sm"
                  disabled={!!sessionProblem}
                  onClick={() =>
                    save(
                      () => saveSessions(center.id, sessions.map((s) => ({ id: s.id, date: s.date, start: s.start || null, end: s.end || null, label: s.label.trim() || null }))),
                      "Sessions saved",
                    )
                  }
                >
                  <Save /> Save sessions
                </Button>
              )}
              {sessionsDirty && sessionProblem && <span className="text-xs text-rose-600">Each session needs a date, and the end must be after the start.</span>}
            </div>
          )}
        </section>

        {/* Rooms */}
        <section className="space-y-2">
          <p className="text-sm font-medium">Rooms</p>
          {rooms.length === 0 && <p className="text-xs text-muted-foreground">No rooms yet.</p>}
          {rooms.map((r, i) => {
            const saved = center.rooms.find((x) => x.id === r.id);
            const count = saved ? data.candidates.filter((c) => c.room_id === saved.id).length : 0;
            return (
              <div key={r.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
                <Input id={`room-name-${center.id}-${i}`} aria-label="Room name" placeholder="Room" value={r.name} disabled={!canEdit} onChange={(e) => setRooms((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="w-36" />
                <Input id={`room-cap-${center.id}-${i}`} aria-label="Seats" inputMode="numeric" placeholder="Seats" value={r.capacity} disabled={!canEdit} onChange={(e) => setRooms((l) => l.map((x, j) => (j === i ? { ...x, capacity: e.target.value.replace(/\D/g, "") } : x)))} className="w-24" />
                {saved && (
                  <span className={cn("text-xs tabular-nums", saved.capacity && count > saved.capacity ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    {count}
                    {saved.capacity ? ` / ${saved.capacity}` : ""} assigned
                  </span>
                )}
                {canEdit && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setRooms((l) => l.filter((_, j) => j !== i))} aria-label="Remove room">
                    <X />
                  </Button>
                )}
              </div>
            );
          })}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setRooms((l) => [...l, { name: `Room ${l.length + 1}`, capacity: "" }])}>
                <Plus /> Add room
              </Button>
              {roomsDirty && (
                <Button
                  size="sm"
                  disabled={!!roomProblem}
                  onClick={() => save(() => saveRooms(center.id, rooms.map((r) => ({ id: r.id, name: r.name.trim(), capacity: r.capacity ? Number(r.capacity) : null }))), "Rooms saved")}
                >
                  <Save /> Save rooms
                </Button>
              )}
            </div>
          )}
        </section>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{center.name}”?</DialogTitle>
            <DialogDescription>
              Its rooms and sessions are deleted and {assigned.length} candidate{assigned.length === 1 ? "" : "s"} become unassigned. Exam results aren&apos;t affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setConfirmDelete(false);
                await save(() => deleteCenter(center.id), "Exam center deleted");
              }}
            >
              Delete center
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

