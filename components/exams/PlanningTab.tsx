"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Building2,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  MapPin,
  MonitorUp,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { sessionLabel, type ExamCenter, type ExamData } from "@/features/written-exam/scoring";
import { createCenter, deleteCenter, saveRooms, saveSessions, updateCenter } from "@/services/writtenExamService";
import { cn } from "@/lib/utils";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type Province = { id: string; name_en: string };
type Sort = "name" | "candidates" | "province";
const NONE = "__none__";
const ALL = "__all__";

/** Per-center numbers used by the list, the summary and the warnings. */
function centerFacts(c: ExamCenter, data: ExamData) {
  const candidates = data.candidates.filter((x) => x.center_id === c.id);
  const seats = c.rooms.reduce((n, r) => n + (r.capacity ?? 0), 0);
  const overRooms = c.rooms.filter((r) => r.capacity && candidates.filter((x) => x.room_id === r.id).length > r.capacity).length;
  const issues: string[] = [];
  if (!c.sessions.length) issues.push("No session");
  if (!c.rooms.length) issues.push("No rooms");
  if (overRooms) issues.push(`${overRooms} room${overRooms === 1 ? "" : "s"} over capacity`);
  if (candidates.length && candidates.some((x) => !x.session_id)) issues.push("Candidates without a session");
  return { candidates: candidates.length, seats, issues };
}

/**
 * Exam centers for the cycle, built to stay usable with many centers: a
 * searchable, filterable list on the left and the selected center's editor
 * (details, sessions, rooms, printable lists) on the right.
 */
export function PlanningTab({ data, canEdit, reload }: TabProps) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState(ALL);
  const [sort, setSort] = useState<Sort>("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  /** The open editor has unsaved changes: ask before switching away. */
  const dirtyRef = useRef(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const confirmLeave = () => !dirtyRef.current || window.confirm("You have unsaved changes for this center. Discard them?");

  function openCenter(id: string) {
    if (id !== selected?.id && !confirmLeave()) return;
    dirtyRef.current = false;
    setSelectedId(id);
    setMobileDetail(true);
    // On phones the editor replaces the list: bring its top into view.
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1279px)").matches) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    listProvinces().then(setProvinces).catch(() => {});
  }, []);

  const facts = useMemo(() => new Map(data.centers.map((c) => [c.id, centerFacts(c, data)])), [data]);
  const provincesUsed = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data.centers) if (c.province_id) m.set(c.province_id, c.province_name ?? provinces.find((p) => p.id === c.province_id)?.name_en ?? "");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.centers, provinces]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.centers
      .filter((c) => {
        if (province === NONE && c.province_id) return false;
        if (province !== ALL && province !== NONE && c.province_id !== province) return false;
        return !q || `${c.name} ${c.province_name ?? ""} ${c.address ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) =>
        sort === "candidates"
          ? (facts.get(b.id)?.candidates ?? 0) - (facts.get(a.id)?.candidates ?? 0)
          : sort === "province"
            ? (a.province_name ?? "~").localeCompare(b.province_name ?? "~") || a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name),
      );
  }, [data.centers, search, province, sort, facts]);

  // Keep a valid selection: the chosen center, else the first one listed.
  const selected = data.centers.find((c) => c.id === selectedId) ?? list[0] ?? null;

  // Keep the selected center visible in the list (e.g. right after creating it).
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[aria-current=true]")?.scrollIntoView({ block: "nearest" });
  }, [selected?.id]);

  const unassigned = data.candidates.filter((c) => !c.center_id).length;
  const totalSessions = data.centers.reduce((n, c) => n + c.sessions.length, 0);
  const totalRooms = data.centers.reduce((n, c) => n + c.rooms.length, 0);
  const totalSeats = data.centers.reduce((n, c) => n + (facts.get(c.id)?.seats ?? 0), 0);
  const withIssues = data.centers.filter((c) => facts.get(c.id)?.issues.length).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Summary icon={Building2} label="Exam centers" value={data.centers.length} sub={withIssues ? `${withIssues} need attention` : "All set up"} warn={withIssues > 0} />
        <Summary icon={CalendarDays} label="Sessions" value={totalSessions} sub="across all centers" />
        <Summary icon={DoorOpen} label="Rooms" value={totalRooms} sub={totalSeats ? `${totalSeats} seats` : "No seats set"} />
        <Summary
          icon={Users}
          label="Candidates assigned"
          value={data.candidates.length - unassigned}
          sub={unassigned ? `${unassigned} not assigned yet` : `of ${data.candidates.length}`}
          warn={unassigned > 0}
        />
      </div>

      {data.centers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No exam centers yet</p>
              <p className="text-sm text-muted-foreground">Add the venues where candidates sit the written exam, with their sessions and rooms.</p>
            </div>
            {canEdit && (
              <Button onClick={() => confirmLeave() && setCreating(true)}>
                <Plus /> New exam center
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          {/* List */}
          {/* Desktop: the list stays in view while a long editor scrolls. */}
          <Card className={cn("overflow-hidden xl:sticky xl:top-4", mobileDetail && "hidden xl:block")}>
            <div className="space-y-2 border-b p-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Search exam centers" placeholder="Search centers" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                {canEdit && (
                  <Button onClick={() => confirmLeave() && setCreating(true)} aria-label="New exam center" title="New exam center">
                    <Plus /> <span className="hidden sm:inline">New</span>
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Select value={province} onValueChange={(v) => setProvince(v ?? ALL)}>
                  <SelectTrigger className="min-w-0 flex-1" aria-label="Province">
                    <SelectValue>
                      {(v: string) => (v === ALL ? "All provinces" : v === NONE ? "No province" : (provincesUsed.find(([id]) => id === v)?.[1] ?? "Province"))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All provinces</SelectItem>
                    {provincesUsed.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NONE}>No province</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
                  <SelectTrigger className="w-36" aria-label="Sort">
                    <SelectValue>{(v: string) => (v === "name" ? "Name A–Z" : v === "candidates" ? "Most candidates" : "Province")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name A–Z</SelectItem>
                    <SelectItem value="candidates">Most candidates</SelectItem>
                    <SelectItem value="province">Province</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {list.length === data.centers.length ? `${data.centers.length} centers` : `${list.length} of ${data.centers.length} centers`}
              </p>
            </div>
            <ul ref={listRef} className="max-h-[60vh] divide-y overflow-y-auto overscroll-contain xl:max-h-[calc(100vh-16rem)]" aria-label="Exam centers">
              {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No center matches.</li>}
              {list.map((c) => {
                const f = facts.get(c.id)!;
                const active = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openCenter(c.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                        active && "bg-primary/5 shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{c.name}</p>
                        {f.issues.length > 0 && (
                          <span title={f.issues.join(" · ")} className="shrink-0 text-amber-600">
                            <AlertTriangle className="size-4" aria-label={f.issues.join(", ")} />
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" /> {c.province_name ?? "Province not set"}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                        <span>
                          <span className="font-medium text-foreground">{f.candidates}</span> candidate{f.candidates === 1 ? "" : "s"}
                        </span>
                        <span>
                          {c.sessions.length} session{c.sessions.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          {c.rooms.length} room{c.rooms.length === 1 ? "" : "s"}
                          {f.seats ? ` · ${f.seats} seats` : ""}
                        </span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Detail */}
          <div ref={detailRef} className={cn("scroll-mt-4", !mobileDetail && "hidden xl:block")}>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 xl:hidden"
              onClick={() => {
                if (!confirmLeave()) return;
                dirtyRef.current = false;
                setMobileDetail(false);
              }}
            >
              <ArrowLeft /> All centers
            </Button>
            {selected && (
              <CenterEditor
                onDirtyChange={(d) => (dirtyRef.current = d)}
                key={selected.id}
                center={selected}
                data={data}
                provinces={provinces}
                issues={facts.get(selected.id)?.issues ?? []}
                canEdit={canEdit}
                reload={reload}
                onDeleted={() => {
                  setSelectedId(null);
                  setMobileDetail(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      {creating && (
        <NewCenterDialog
          data={data}
          provinces={provinces}
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await reload();
            setSearch("");
            setProvince(ALL);
            dirtyRef.current = false;
            setSelectedId(id);
            setMobileDetail(true);
          }}
        />
      )}
    </div>
  );
}

function Summary({ icon: Icon, label, value, sub, warn }: { icon: typeof Building2; label: string; value: number; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-xs">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className={cn("truncate text-xs", warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{sub}</p>
    </div>
  );
}

/**
 * Creates a center in one go: name, province, address, and optionally its
 * first session and rooms (e.g. 3 rooms × 30 seats).
 */
function NewCenterDialog({
  data,
  provinces,
  onClose,
  onCreated,
}: {
  data: ExamData;
  provinces: Province[];
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [provinceId, setProvinceId] = useState(NONE);
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("10:00");
  const [roomCount, setRoomCount] = useState("");
  const [seats, setSeats] = useState("");
  const [busy, setBusy] = useState(false);

  const duplicate = data.centers.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const badTime = !!date && !!start && !!end && end <= start;
  const rooms = Math.min(50, Number(roomCount) || 0);

  async function submit() {
    setBusy(true);
    try {
      const center = await createCenter(data.cycle.id, { name: name.trim(), provinceId: provinceId === NONE ? null : provinceId, address: address.trim() || null });
      if (date) await saveSessions(center.id, [{ date, start: start || null, end: end || null, label: null }]);
      if (rooms > 0) {
        await saveRooms(
          center.id,
          Array.from({ length: rooms }, (_, i) => ({ name: `Room ${i + 1}`, capacity: Number(seats) > 0 ? Number(seats) : null })),
        );
      }
      toast.success(`Exam center “${name.trim()}” added`);
      await onCreated(center.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add the center");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New exam center</DialogTitle>
          <DialogDescription>Sessions and rooms can also be added or changed afterwards.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && !duplicate && !badTime) submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2" error={duplicate ? "A center with this name already exists." : undefined}>
              <Input id="new-center-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PNC Phnom Penh" maxLength={120} autoFocus />
            </Field>
            <Field label="Province">
              <Select value={provinceId} onValueChange={(v) => setProvinceId(v ?? NONE)}>
                <SelectTrigger className="w-full" aria-label="Province">
                  <SelectValue>{(v: string) => (v === NONE ? "Not set" : (provinces.find((p) => p.id === v)?.name_en ?? "Province"))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Address (optional)">
              <Input id="new-center-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
            </Field>
          </div>

          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">First session (optional)</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Session date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
              <Input aria-label="Start time" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input aria-label="End time" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
            </div>
            {badTime && <p className="text-xs text-rose-600">The end must be after the start.</p>}
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Rooms (optional)</legend>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Input aria-label="Number of rooms" inputMode="numeric" placeholder="0" value={roomCount} onChange={(e) => setRoomCount(e.target.value.replace(/\D/g, "").slice(0, 2))} className="w-20" />
              <span className="text-muted-foreground">rooms ×</span>
              <Input aria-label="Seats per room" inputMode="numeric" placeholder="Seats" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-24" />
              <span className="text-muted-foreground">seats each</span>
            </div>
            {rooms > 0 && (
              <p className="text-xs text-muted-foreground">
                Creates Room 1 … Room {rooms}
                {Number(seats) > 0 ? ` · ${rooms * Number(seats)} seats in total` : ""}. You can rename them afterwards.
              </p>
            )}
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim() || duplicate || badTime}>
              <Plus /> Create center
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className, error }: { label: string; children: React.ReactNode; className?: string; error?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

type RoomDraft = { id?: string; name: string; capacity: string };
type SessionDraft = { id?: string; date: string; start: string; end: string; label: string };

function CenterEditor({
  center,
  data,
  provinces,
  issues,
  canEdit,
  reload,
  onDeleted,
  onDirtyChange,
}: {
  center: ExamCenter;
  data: ExamData;
  provinces: Province[];
  issues: string[];
  canEdit: boolean;
  reload: () => Promise<void>;
  onDeleted: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const initialRooms = center.rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity ? String(r.capacity) : "" }));
  const initialSessions = center.sessions.map((s) => ({ id: s.id, date: s.session_date, start: s.start_time?.slice(0, 5) ?? "", end: s.end_time?.slice(0, 5) ?? "", label: s.label ?? "" }));
  const [title, setTitle] = useState(center.name);
  const [provinceId, setProvinceId] = useState(center.province_id ?? NONE);
  const [address, setAddress] = useState(center.address ?? "");
  const [rooms, setRooms] = useState<RoomDraft[]>(initialRooms);
  const [sessions, setSessions] = useState<SessionDraft[]>(initialSessions);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const assigned = data.candidates.filter((c) => c.center_id === center.id);
  const detailsDirty = title.trim() !== center.name || provinceId !== (center.province_id ?? NONE) || address.trim() !== (center.address ?? "");
  const roomsDirty = JSON.stringify(rooms) !== JSON.stringify(initialRooms);
  const sessionsDirty = JSON.stringify(sessions) !== JSON.stringify(initialSessions);
  const sessionProblem = sessions.find((s) => !s.date || (s.start && s.end && s.end <= s.start));
  const roomProblem = rooms.find((r) => !r.name.trim() || (r.capacity && !(Number(r.capacity) > 0)));
  const duplicateName = detailsDirty && data.centers.some((c) => c.id !== center.id && c.name.trim().toLowerCase() === title.trim().toLowerCase());

  // When a part is saved (new data arrives), refresh only that part's draft; unsaved edits in the
  // other parts stay. No remount, so the panel doesn't flicker.
  const roomsKey = JSON.stringify(initialRooms);
  const sessionsKey = JSON.stringify(initialSessions);
  const detailsKey = `${center.name}|${center.province_id}|${center.address}`;
  useEffect(() => setRooms(JSON.parse(roomsKey)), [roomsKey]);
  useEffect(() => setSessions(JSON.parse(sessionsKey)), [sessionsKey]);
  useEffect(() => {
    setTitle(center.name);
    setProvinceId(center.province_id ?? NONE);
    setAddress(center.address ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsKey]);

  const dirty = detailsDirty || roomsDirty || sessionsDirty;
  useEffect(() => {
    onDirtyChange(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  async function save(action: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await action();
      toast.success(msg);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="animate-in duration-200 fade-in">
      <CardContent className="space-y-6 pt-6">
        {/* Details */}
        <section className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold">{center.name}</h3>
              <p className="text-sm text-muted-foreground">
                {assigned.length} candidate{assigned.length === 1 ? "" : "s"} assigned · {center.sessions.length} session{center.sessions.length === 1 ? "" : "s"} ·{" "}
                {center.rooms.length} room{center.rooms.length === 1 ? "" : "s"}
              </p>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-500/10"
                onClick={() => setConfirmDelete(true)}
                aria-label={`Delete ${center.name}`}
              >
                <Trash2 /> <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
          </div>
          {issues.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {issues.map((i) => (
                <li key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  <AlertTriangle className="size-3" /> {i}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2" error={duplicateName ? "Another center already has this name." : undefined}>
              <Input id={`center-name-${center.id}`} value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Province">
              <Select value={provinceId} disabled={!canEdit} onValueChange={(v) => setProvinceId(v ?? NONE)}>
                <SelectTrigger className="w-full" aria-label="Province">
                  <SelectValue>{(v: string) => (v === NONE ? "Not set" : (provinces.find((p) => p.id === v)?.name_en ?? center.province_name ?? "Province"))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Address">
              <Input id={`center-address-${center.id}`} placeholder="Optional" value={address} disabled={!canEdit} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
            </Field>
          </div>
          {canEdit && detailsDirty && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={busy || !title.trim() || duplicateName}
                onClick={() =>
                  save(
                    () => updateCenter(center.id, { name: title.trim(), provinceId: provinceId === NONE ? null : provinceId, address: address.trim() || null }),
                    "Center details saved",
                  )
                }
              >
                {busy ? <Loader2 className="animate-spin" /> : <Save />} Save details
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTitle(center.name);
                  setProvinceId(center.province_id ?? NONE);
                  setAddress(center.address ?? "");
                }}
              >
                Undo
              </Button>
            </div>
          )}
        </section>

        <div className="grid gap-6 border-t pt-5 xl:grid-cols-2">
          {/* Sessions */}
          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarDays className="size-4 text-primary" /> Sessions
            </p>
            {sessions.length === 0 && <p className="text-xs text-muted-foreground">No sessions yet.</p>}
            {sessions.map((s, i) => {
              const saved = center.sessions.find((x) => x.id === s.id);
              const count = saved ? data.candidates.filter((c) => c.session_id === saved.id).length : 0;
              return (
                <div key={s.id ?? `new-${i}`} className="space-y-1.5 rounded-lg border p-2">
                  {/* Phone: date + remove, then start–end, then label. Wider: one line. */}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:flex-wrap">
                    <Input aria-label="Date" type="date" value={s.date} disabled={!canEdit} onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="w-full sm:w-40" />
                    {canEdit ? (
                      <Button variant="ghost" size="icon-sm" className="sm:order-last" onClick={() => setSessions((l) => l.filter((_, j) => j !== i))} aria-label="Remove session">
                        <X />
                      </Button>
                    ) : (
                      <span />
                    )}
                    <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                      <Input aria-label="Start time" type="time" value={s.start} disabled={!canEdit} onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="min-w-0 flex-1 sm:w-28 sm:flex-none" />
                      <span className="text-sm text-muted-foreground">to</span>
                      <Input aria-label="End time" type="time" value={s.end} disabled={!canEdit} onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="min-w-0 flex-1 sm:w-28 sm:flex-none" />
                    </div>
                    <Input
                      aria-label="Label"
                      placeholder="Label (e.g. Morning)"
                      value={s.label}
                      disabled={!canEdit}
                      onChange={(e) => setSessions((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      className="col-span-2 w-full sm:col-span-1 sm:w-36"
                    />
                  </div>
                  {saved && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums" title={sessionLabel(saved)}>
                        {count} candidates
                      </span>
                      <a href={`/report/exam-lists?cycleId=${data.cycle.id}&sessionId=${saved.id}&type=wall&print=1`} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
                        <MonitorUp /> Display list
                      </a>
                      <a href={`/report/exam-lists?cycleId=${data.cycle.id}&sessionId=${saved.id}&type=attendance&print=1`} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
                        <ClipboardList /> Attendance list
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSessions((l) => [...l, { date: l[l.length - 1]?.date ?? "", start: "07:00", end: "10:00", label: "" }])}>
                  <Plus /> Add session
                </Button>
                {sessionsDirty && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy || !!sessionProblem}
                      onClick={() =>
                        save(() => saveSessions(center.id, sessions.map((s) => ({ id: s.id, date: s.date, start: s.start || null, end: s.end || null, label: s.label.trim() || null }))), "Sessions saved")
                      }
                    >
                      {busy ? <Loader2 className="animate-spin" /> : <Save />} Save sessions
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSessions(initialSessions)}>
                      Undo
                    </Button>
                  </>
                )}
                {sessionsDirty && sessionProblem && <span className="text-xs text-rose-600">Each session needs a date, and the end must be after the start.</span>}
              </div>
            )}
          </section>

          {/* Rooms */}
          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <DoorOpen className="size-4 text-primary" /> Rooms
            </p>
            {rooms.length === 0 && <p className="text-xs text-muted-foreground">No rooms yet.</p>}
            {rooms.map((r, i) => {
              const saved = center.rooms.find((x) => x.id === r.id);
              const count = saved ? data.candidates.filter((c) => c.room_id === saved.id).length : 0;
              return (
                <div key={r.id ?? `new-${i}`} className="flex items-center gap-2">
                  <Input aria-label="Room name" placeholder="Room" value={r.name} disabled={!canEdit} onChange={(e) => setRooms((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="min-w-0 flex-1" />
                  <Input aria-label="Seats" inputMode="numeric" placeholder="Seats" value={r.capacity} disabled={!canEdit} onChange={(e) => setRooms((l) => l.map((x, j) => (j === i ? { ...x, capacity: e.target.value.replace(/\D/g, "") } : x)))} className="w-20 shrink-0" />
                  {saved && (
                    <span className={cn("shrink-0 text-xs whitespace-nowrap tabular-nums", saved.capacity && count > saved.capacity ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
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
                <Button variant="outline" size="sm" onClick={() => setRooms((l) => [...l, { name: `Room ${l.length + 1}`, capacity: l[l.length - 1]?.capacity ?? "" }])}>
                  <Plus /> Add room
                </Button>
                {roomsDirty && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy || !!roomProblem}
                      onClick={() => save(() => saveRooms(center.id, rooms.map((r) => ({ id: r.id, name: r.name.trim(), capacity: r.capacity ? Number(r.capacity) : null }))), "Rooms saved")}
                    >
                      {busy ? <Loader2 className="animate-spin" /> : <Save />} Save rooms
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRooms(initialRooms)}>
                      Undo
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
        <p className="border-t pt-3 text-xs text-muted-foreground">
          To put candidates in this center, select them on the <strong>Candidates</strong> tab and use “Assign to center…”.
        </p>
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
                onDeleted();
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
