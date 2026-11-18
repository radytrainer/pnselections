"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Link2, Loader2, MapPin, Megaphone, MonitorPlay, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listProvinces, type Province } from "@/services/lookupService";
import { listStudentExamCenters, type StudentExamCenter } from "@/services/studentService";
import {
  createInformationSession,
  deleteInformationSession,
  linkState,
  listInformationSessions,
  listRegistrations,
  subscribeToRegistrations,
  updateInformationSession,
  type InformationSession,
  type IsRegistration,
} from "@/services/informationSessionService";
import { SessionDialog } from "@/components/info-sessions/SessionDialog";
import { RegistrationLinkCard } from "@/components/info-sessions/RegistrationLinkCard";
import { RegistrationsTable } from "@/components/info-sessions/RegistrationsTable";
import { cn } from "@/lib/utils";

function fmtDate(d: string | null) {
  return d ? new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : null;
}

function StateDot({ s }: { s: InformationSession }) {
  const st = linkState(s);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        st === "open" ? "text-emerald-700 dark:text-emerald-400" : st === "expired" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", st === "open" ? "bg-emerald-500" : st === "expired" ? "bg-amber-500" : "bg-slate-400")} />
      {st === "open" ? "Open" : st === "expired" ? "Expired" : "Closed"}
    </span>
  );
}

function Tile({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function InformationSessionsPage() {
  const { role, loading: roleLoading } = useRole();
  const { cycles, cycleId, setCycleId, loading: cyclesLoading } = useCycleFilter();
  const [sessions, setSessions] = useState<InformationSession[] | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [centers, setCenters] = useState<StudentExamCenter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<null | { session: InformationSession | null }>(null);
  const [deleting, setDeleting] = useState<InformationSession | null>(null);
  const [regs, setRegs] = useState<IsRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!cycleId) return;
    try {
      const list = await listInformationSessions(cycleId);
      setSessions(list);
      setSelectedId((cur) => (cur && list.some((s) => s.id === cur) ? cur : (list[0]?.id ?? null)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load information sessions");
      setSessions([]);
    }
  }, [cycleId]);

  useEffect(() => {
    setSessions(null);
    setSelectedId(null);
    load();
    if (cycleId) listStudentExamCenters(cycleId).then(setCenters).catch(() => setCenters([]));
  }, [cycleId, load]);

  useEffect(() => {
    listProvinces().then(setProvinces).catch(() => setProvinces([]));
  }, []);

  const loadRegs = useCallback(async () => {
    if (!selectedId) return setRegs([]);
    setRegsLoading(true);
    try {
      setRegs(await listRegistrations(selectedId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load registrations");
    } finally {
      setRegsLoading(false);
    }
  }, [selectedId]);
  useEffect(() => {
    loadRegs();
  }, [loadRegs]);

  // Live: new registrations for the open session appear without reloading.
  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    load();
    loadRegs();
  };
  useEffect(() => {
    if (!selectedId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToRegistrations(selectedId, () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refreshRef.current();
      }, 500);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [selectedId]);

  const selected = sessions?.find((s) => s.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (sessions ?? []).filter((x) => !s || [x.name, x.venue, x.province_name].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [sessions, q]);

  const totals = useMemo(() => {
    const list = sessions ?? [];
    return {
      sessions: list.length,
      open: list.filter((s) => linkState(s) === "open").length,
      regs: list.reduce((n, s) => n + s.registrations, 0),
      girls: list.reduce((n, s) => n + s.girls, 0),
      boys: list.reduce((n, s) => n + s.boys, 0),
      added: list.reduce((n, s) => n + s.added, 0),
    };
  }, [sessions]);

  const refreshAll = async () => {
    await Promise.all([load(), loadRegs()]);
  };

  if (roleLoading || cyclesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!can(role, "enterExamScores")) return <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Information sessions</h1>
          <p className="text-sm text-muted-foreground">Share a link or QR code at each session so students register online — no login needed.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <CycleSelect cycles={cycles} value={cycleId} onChange={setCycleId} />
          <Button onClick={() => setDialog({ session: null })} disabled={!cycleId}>
            <Plus /> New session
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile icon={<Megaphone className="size-3.5" />} label="Sessions" value={totals.sessions} />
        <Tile icon={<Link2 className="size-3.5" />} label="Links open" value={totals.open} note={`of ${totals.sessions}`} />
        <Tile icon={<Users className="size-3.5" />} label="Registrations" value={totals.regs} note={`${totals.girls} girls · ${totals.boys} boys`} />
        <Tile icon={<Users className="size-3.5" />} label="Added to candidates" value={totals.added} note={`${totals.regs - totals.added} waiting`} />
      </div>

      {sessions === null ? (
        <Skeleton className="h-72 w-full" />
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Megaphone className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">No information sessions yet</p>
          <p className="text-sm text-muted-foreground">Create one to get a registration link and QR code for students.</p>
          <Button className="mt-4" onClick={() => setDialog({ session: null })}>
            <Plus /> New session
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* List */}
          <div className={cn("space-y-2 xl:sticky xl:top-4 xl:self-start", mobileDetail && "hidden xl:block")}>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search sessions" placeholder="Search sessions" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <ul aria-label="Information sessions" className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-0.5 xl:max-h-[calc(100vh-16rem)]">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id);
                      setMobileDetail(true);
                      if (window.matchMedia("(max-width: 1279px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      s.id === selectedId ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">{s.name}</p>
                      <StateDot s={s} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{[fmtDate(s.session_date), s.venue || s.province_name].filter(Boolean).join(" · ") || "No date"}</p>
                    <p className="mt-1 text-xs">
                      <span className="font-medium tabular-nums">{s.registrations}</span> registered
                      {s.registrations > s.added && <span className="text-amber-700 dark:text-amber-400"> · {s.registrations - s.added} to add</span>}
                    </p>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-2 py-4 text-center text-sm text-muted-foreground">No sessions match.</li>}
            </ul>
          </div>

          {/* Detail */}
          {selected && (
            <div key={selected.id} className={cn("min-w-0 space-y-4 rounded-xl border bg-card p-4 animate-in duration-200 fade-in sm:p-5", !mobileDetail && "hidden xl:block")}>
              <button type="button" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground xl:hidden" onClick={() => setMobileDetail(false)}>
                <ArrowLeft className="size-4" /> All sessions
              </button>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {selected.session_date && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-4" /> {fmtDate(selected.session_date)}
                      </span>
                    )}
                    {(selected.venue || selected.province_name) && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-4" /> {[selected.venue, selected.province_name].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {selected.default_exam_center_name && <Badge variant="outline">Exam center: {selected.default_exam_center_name}</Badge>}
                  </div>
                  {selected.notes && <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{selected.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <a href={`/live/info-sessions/${selected.id}`} target="_blank" rel="noreferrer" className="inline-flex" title="Full-screen live display for a projector or TV">
                    <Button size="sm" tabIndex={-1}>
                      <MonitorPlay /> Live display
                    </Button>
                  </a>
                  <Button variant="outline" size="sm" onClick={() => setDialog({ session: selected })}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete session" className="text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10" onClick={() => setDeleting(selected)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <RegistrationLinkCard session={selected} onChanged={load} />

              <div className="space-y-2">
                <h3 className="font-medium">
                  Registrations <span className="font-normal text-muted-foreground">({selected.registrations} · {selected.girls} girls · {selected.boys} boys)</span>
                </h3>
                <RegistrationsTable session={selected} rows={regs} centers={centers} loading={regsLoading} reload={refreshAll} />
              </div>
            </div>
          )}
        </div>
      )}

      {dialog && (
        <SessionDialog
          session={dialog.session}
          provinces={provinces}
          centers={centers}
          onClose={() => setDialog(null)}
          onSave={async (input) => {
            if (dialog.session) {
              await updateInformationSession(dialog.session.id, input);
              toast.success("Session updated");
            } else {
              const created = await createInformationSession(cycleId, input);
              toast.success("Session created — share its link or QR code");
              setSelectedId(created.id);
              setMobileDetail(true);
            }
            setDialog(null);
            await load();
          }}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Its link stops working and its {deleting?.registrations ?? 0} registration{deleting?.registrations === 1 ? "" : "s"} are deleted. Exam candidates already created from them are
              kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <DeleteButton
              onDelete={async () => {
                if (!deleting) return;
                await deleteInformationSession(deleting.id);
                toast.success("Session deleted");
                setDeleting(null);
                await load();
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="destructive"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onDelete();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't delete");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="animate-spin" />}
      Delete
    </Button>
  );
}
