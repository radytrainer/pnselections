"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Maximize, Minimize, Users, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LogoMark } from "@/components/layout/Logo";
import {
  getLiveRegistrations,
  linkState,
  registrationUrl,
  subscribeToRegistrations,
  type LiveRegistrations,
} from "@/services/informationSessionService";
import { cn } from "@/lib/utils";

/**
 * Full-screen live display for an information session (projector / TV):
 * the registration QR code, live girl/boy counts and the names of students as
 * they register. Updates instantly through Server-Sent Events, with a 30 s
 * refresh as a safety net. Shows names only — no contact details.
 */
const FRESH_MS = 6000;

export default function LiveRegistrationsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<LiveRegistrations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const [latest, setLatest] = useState<{ name: string; at: number } | null>(null);
  const [isFull, setIsFull] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await getLiveRegistrations(id);
      const now = Date.now();
      if (known.current) {
        const added = d.recent.filter((r) => !known.current!.has(r.id));
        if (added.length) {
          setFresh((f) => ({ ...f, ...Object.fromEntries(added.map((r) => [r.id, now])) }));
          const newest = added[0];
          setLatest({ name: `${newest.first_name} ${newest.last_name}`, at: now });
        }
      }
      known.current = new Set(d.recent.map((r) => r.id));
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load registrations");
    }
  }, [id]);

  // Several students submitting at once → one refresh.
  const scheduleLoad = useCallback(() => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      load();
    }, 400);
  }, [load]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return setError("Please sign in to open the live display.");
    load();
    const unsubscribe = subscribeToRegistrations(id, scheduleLoad, setLive);
    const poll = setInterval(load, 30_000);
    return () => {
      unsubscribe();
      clearInterval(poll);
      if (pending.current) clearTimeout(pending.current);
    };
  }, [id, user, authLoading, load, scheduleLoad]);

  // Expire the "just registered" highlights.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setFresh((f) => {
        const next = Object.fromEntries(Object.entries(f).filter(([, at]) => now - at < FRESH_MS));
        return Object.keys(next).length === Object.keys(f).length ? f : next;
      });
      setLatest((l) => (l && now - l.at > FRESH_MS ? null : l));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const token = data?.session.reg_token;
  useEffect(() => {
    if (!token) return;
    import("qrcode")
      .then((QR) => QR.toDataURL(registrationUrl(token), { width: 600, margin: 1, errorCorrectionLevel: "M" }))
      .then(setQr)
      .catch(() => setQr(null));
  }, [token]);

  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  if (error && !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-6 text-center text-slate-200">
        <div>
          <p className="text-lg">{error}</p>
          <Link href="/info-sessions" className="mt-4 inline-block text-sm text-sky-300 underline">
            Back to Information sessions
          </Link>
        </div>
      </main>
    );
  }
  if (!data) return <main className="min-h-dvh bg-slate-950" />;

  const s = data.session;
  const state = linkState(s);
  const c = data.counts;
  const pct = (n: number) => (c.total ? Math.round((n / c.total) * 100) : 0);
  const names = data.recent;
  // Smaller names as the room fills up.
  const nameSize = names.length > 160 ? "text-sm" : names.length > 80 ? "text-base" : names.length > 30 ? "text-lg" : "text-2xl";

  return (
    <main className="flex min-h-dvh flex-col bg-slate-950 text-white">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-white/10 px-6 py-4">
        <LogoMark className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold lg:text-3xl">{s.name}</h1>
          <p className="truncate text-sm text-slate-400 lg:text-base">
            {[
              s.session_date ? new Date(s.session_date.slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : null,
              s.venue,
              s.province_name,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
            live ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300",
          )}
          title={live ? "Updates appear instantly" : "Reconnecting — refreshing every 30 seconds meanwhile"}
        >
          <span className={cn("size-2.5 rounded-full", live ? "animate-pulse bg-emerald-400" : "bg-amber-400")} />
          {live ? "LIVE" : "Reconnecting…"}
        </span>
        <button type="button" onClick={toggleFull} className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={isFull ? "Exit full screen" : "Full screen"} title={isFull ? "Exit full screen" : "Full screen"}>
          {isFull ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
        </button>
        {!isFull && (
          <Link href="/info-sessions" className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Close live display" title="Close">
            <X className="size-5" />
          </Link>
        )}
      </header>

      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* QR + counts */}
        <aside className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white p-5 text-center text-slate-900">
            {state === "open" ? (
              <>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Scan to register" className="mx-auto aspect-square w-full max-w-72" />
                ) : (
                  <div className="mx-auto aspect-square w-full max-w-72 animate-pulse rounded bg-slate-100" />
                )}
                <p className="mt-3 text-xl font-semibold">Scan to register</p>
                <p className="text-lg text-slate-600" style={{ fontFamily: "var(--font-battambang)" }}>
                  ស្កេនដើម្បីចុះឈ្មោះ
                </p>
              </>
            ) : (
              <div className="py-10">
                <p className="text-2xl font-semibold">Registration {state === "closed" ? "closed" : "expired"}</p>
                <p className="mt-1 text-lg text-slate-600" style={{ fontFamily: "var(--font-battambang)" }}>
                  ការចុះឈ្មោះត្រូវបានបិទ
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="flex items-center gap-2 text-sm tracking-wide text-slate-400 uppercase">
              <Users className="size-4" /> Registered
            </p>
            <p className="mt-1 text-7xl leading-none font-bold tabular-nums" aria-live="polite">
              {c.total}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-pink-500/15 p-3">
                <p className="text-sm text-pink-200">
                  Female · <span style={{ fontFamily: "var(--font-battambang)" }}>ស្រី</span>
                </p>
                <p className="text-4xl font-bold tabular-nums">{c.female}</p>
                <p className="text-sm text-pink-200/80 tabular-nums">{pct(c.female)}%</p>
              </div>
              <div className="rounded-xl bg-sky-500/15 p-3">
                <p className="text-sm text-sky-200">
                  Male · <span style={{ fontFamily: "var(--font-battambang)" }}>ប្រុស</span>
                </p>
                <p className="text-4xl font-bold tabular-nums">{c.male}</p>
                <p className="text-sm text-sky-200/80 tabular-nums">{pct(c.male)}%</p>
              </div>
            </div>
            {c.total > 0 && (
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div className="bg-pink-400 transition-all duration-700" style={{ width: `${pct(c.female)}%` }} />
                <div className="bg-sky-400 transition-all duration-700" style={{ width: `${pct(c.male)}%` }} />
              </div>
            )}
            {c.other > 0 && <p className="mt-3 text-sm text-slate-400">+ {c.other} LGBTQIA+</p>}
          </div>
        </aside>

        {/* Names */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="text-lg font-medium text-slate-300">Students registered</h2>
            {latest && (
              <p key={latest.at} className="animate-in truncate pl-4 text-lg font-semibold text-emerald-300 duration-500 fade-in slide-in-from-right-4">
                Welcome, {latest.name}! 🎉
              </p>
            )}
          </div>
          {names.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center">
              <div>
                <p className="text-2xl text-slate-300">Waiting for the first student…</p>
                <p className="mt-2 text-slate-500">Names appear here as soon as students submit the form.</p>
              </div>
            </div>
          ) : (
            <ol className={cn("grid flex-1 content-start gap-x-6 gap-y-1 overflow-y-auto p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", nameSize)}>
              {names.map((r, i) => (
                <li
                  key={r.id}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-1000",
                    fresh[r.id] ? "animate-in bg-emerald-500/20 duration-700 fade-in slide-in-from-top-2" : "bg-transparent",
                  )}
                >
                  <span className="w-10 shrink-0 text-right text-sm text-slate-500 tabular-nums">{c.total - i}</span>
                  <span className={cn("size-2.5 shrink-0 rounded-full", r.gender === "female" ? "bg-pink-400" : r.gender === "male" ? "bg-sky-400" : "bg-violet-400")} aria-hidden="true" />
                  <span className="truncate">
                    {r.first_name} {r.last_name}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
