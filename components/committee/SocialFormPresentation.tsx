"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ListChecks,
  MessageSquareText,
  Minus,
  Plus,
  Presentation,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentAvatar } from "@/components/students/StudentAvatar";
import { buildNotes, buildSections, buildVac, type Need, type Row } from "@/components/committee/SocialFormSummary";

type FieldNote = ReturnType<typeof buildNotes>[number];
import {
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  FAILED_HOME_VISIT_THRESHOLD,
  isFailedHomeVisit,
  VAC_TIER_BADGE_CLASSES,
  VAC_TIER_LABELS,
  type SocialFormCategory,
} from "@/features/social-form/scoring";
import type { SocialAssessmentRow } from "@/services/committeeService";
import { cn } from "@/lib/utils";

export type PresentationStudent = {
  name: string;
  code?: string | null;
  photoPath: string | null;
  initials: string;
  facts: string[];
};

type SectionSlide = { kind: "section"; title: string; icon: LucideIcon; rows: Row[]; badge?: React.ReactNode };
type Slide =
  | { kind: "overview"; title: string; icon: LucideIcon }
  | SectionSlide
  | { kind: "notes"; title: string; icon: LucideIcon; rows: Row[]; comments: string | null; notes: FieldNote[] }
  | { kind: "summary"; title: string; icon: LucideIcon };

/** A row with where it lives, so summary/overview items can jump to it. */
type Located = Row & { section: string; slide: number; row: number };

/** Need → look. Status colors always come with an icon and a word (never color alone). */
const NEED: Record<Need, { label: string; icon: LucideIcon; tile: string; pill: string; bar: string }> = {
  high: {
    label: "Concern",
    icon: AlertTriangle,
    tile: "border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    bar: "bg-rose-500",
  },
  medium: {
    label: "Watch",
    icon: AlertCircle,
    tile: "border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  low: {
    label: "OK",
    icon: CheckCircle2,
    tile: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
};

/** Text-size steps for the A− / A+ buttons (multiplies the slide's base size). */
const SCALES = [0.85, 1, 1.15, 1.3, 1.5];
/** Smallest automatic shrink when a slide doesn't fit; below that the slide scrolls. */
const MIN_FIT = 0.6;
/** Base slide text size (everything on a slide is sized in em from this). */
const slideFont = (scale: number) => `calc(clamp(13px, 0.8vw + 0.45vh, 19px) * ${scale})`;

/**
 * Full-screen, step-by-step view of one home visit for the selection
 * committee (projector/TV): overview with score gauges and key concerns, one
 * Social Form section per slide as colour-coded tiles, and a closing summary
 * of concerns vs. strengths. Click a tile to spotlight it.
 */
export function SocialFormPresentation({
  assessment,
  student,
}: {
  assessment: SocialAssessmentRow;
  student: PresentationStudent;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Presentation />
        Present
      </Button>
      {open && <PresentationView assessment={assessment} student={student} onClose={() => setOpen(false)} />}
    </>
  );
}

function PresentationView({
  assessment,
  student,
  onClose,
}: {
  assessment: SocialAssessmentRow;
  student: PresentationStudent;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const touchX = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [scaleIdx, setScaleIdx] = useState(1);
  /** Spotlighted tile on the current slide (row index), or null. */
  const [spot, setSpot] = useState<number | null>(null);

  const category = assessment.category as SocialFormCategory;
  const failed = isFailedHomeVisit(assessment.final_score ?? 0, assessment.manual_failed);
  const scoreLabel = failed ? "Failed Home Visit" : CATEGORY_LABELS[category];
  const scoreClass = failed ? "bg-red-100 text-red-700" : CATEGORY_BADGE_CLASSES[category];
  const vac = useMemo(() => buildVac(assessment), [assessment]);

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [{ kind: "overview", title: "Overview", icon: UserRound }];
    if (vac.rows.length) {
      list.push({
        kind: "section",
        title: "Vulnerability Checklist",
        icon: ListChecks,
        rows: vac.rows,
        badge: vac.tier ? (
          <span className={cn("rounded-full px-[0.75em] py-[0.25em] text-[0.85em] font-medium", VAC_TIER_BADGE_CLASSES[vac.tier])}>
            {assessment.vac_total_score}/36 · {VAC_TIER_LABELS[vac.tier]}
            {vac.answered < vac.total ? ` · ${vac.answered}/${vac.total} answered` : ""}
          </span>
        ) : undefined,
      });
    }
    for (const sec of buildSections(assessment)) {
      if (sec.rows.length) list.push({ kind: "section", title: sec.title, icon: sec.icon, rows: sec.rows });
    }
    const noteRows = [
      { label: "Poverty Certificate", value: assessment.poverty_certificate ?? "" },
      { label: "Distance from Town", value: assessment.distance_from_town ?? "" },
    ].filter((r) => r.value);
    const fieldNotes = buildNotes(assessment);
    if (noteRows.length || assessment.visitor_comments?.trim() || fieldNotes.length) {
      list.push({
        kind: "notes",
        title: "Notes & comments",
        icon: MessageSquareText,
        rows: noteRows,
        comments: assessment.visitor_comments?.trim() || null,
        notes: fieldNotes,
      });
    }
    list.push({ kind: "summary", title: "Summary", icon: ClipboardCheck });
    return list;
  }, [assessment, vac]);

  /** Every need-tagged answer, with its slide/row, for the overview chips and the summary. */
  const located = useMemo<Located[]>(() => {
    const out: Located[] = [];
    slides.forEach((s, slide) => {
      if (s.kind !== "section") return;
      s.rows.forEach((r, row) => {
        if (r.need) out.push({ ...r, section: s.title, slide, row });
      });
    });
    return out;
  }, [slides]);
  const concerns = located.filter((l) => l.need === "high");
  const watch = located.filter((l) => l.need === "medium");
  const strengths = located.filter((l) => l.need === "low");

  const last = slides.length - 1;
  const go = useCallback(
    (i: number, spotlight: number | null = null) => {
      setIndex(Math.max(0, Math.min(last, i)));
      setSpot(spotlight);
    },
    [last],
  );

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);

  // Real full screen when the browser allows it (falls back to a fixed overlay).
  useEffect(() => {
    rootRef.current?.requestFullscreen?.().catch(() => {});
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onFs);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(last);
      else if (e.key === "Escape") {
        if (spot != null) setSpot(null); // first Esc clears the spotlight
        else close();
      } else if (e.key === "+" || e.key === "=") setScaleIdx((s) => Math.min(SCALES.length - 1, s + 1));
      else if (e.key === "-") setScaleIdx((s) => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last, spot, go, close]);

  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>("[aria-current=step]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index]);

  const slide = slides[index];
  const notesIndex = slides.findIndex((s) => s.kind === "notes");
  const notesSlide = notesIndex >= 0 ? (slides[notesIndex] as Extract<Slide, { kind: "notes" }>) : null;

  // ---- Fit to screen: shrink the text (everything is sized in em) until the slide fits without scrolling.
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState("");
  const [tick, setTick] = useState(0);
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const onResize = () => setViewport(`${window.innerWidth}x${window.innerHeight}`);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    // A photo finishing loading changes the slide's height: fit again.
    const c = contentRef.current;
    if (!c) return;
    const onLoad = () => setTick((t) => t + 1);
    c.addEventListener("load", onLoad, true);
    return () => c.removeEventListener("load", onLoad, true);
  }, [index]);
  useLayoutEffect(() => {
    // Largest size (≤ the chosen A size) that fits, found by trying sizes before paint.
    const m = mainRef.current;
    const c = contentRef.current;
    if (!m || !c) return;
    const cs = getComputedStyle(m);
    const avail = m.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fits = (f: number) => {
      c.style.fontSize = slideFont(SCALES[scaleIdx] * f);
      return c.offsetHeight <= avail;
    };
    let best = 1;
    if (!fits(1)) {
      let lo = MIN_FIT;
      let hi = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      best = lo;
    }
    c.style.fontSize = slideFont(SCALES[scaleIdx] * best);
    setFit(best);
  }, [index, scaleIdx, viewport, tick]);

  const view = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Social form presentation — ${student.name}`}
      className="fixed inset-0 z-[200] flex flex-col bg-slate-50 text-foreground dark:bg-background"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur sm:px-6">
        <StudentAvatar photoPath={student.photoPath} initials={student.initials} size="size-9" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{student.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            Home visit #{assessment.visit_number}
            {assessment.visit_date ? ` · ${assessment.visit_date}` : ""}
            {assessment.visitor_name ? ` · by ${assessment.visitor_name}` : ""}
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", scoreClass)}>
            {assessment.final_score} pts · {scoreLabel}
          </span>
          {concerns.length > 0 && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium", NEED.high.pill)}>
              <AlertTriangle className="size-3.5" /> {concerns.length} concern{concerns.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center rounded-lg border bg-background">
          <Button variant="ghost" size="icon-sm" onClick={() => setScaleIdx((s) => Math.max(0, s - 1))} disabled={scaleIdx === 0} aria-label="Smaller text">
            <Minus />
          </Button>
          <span className="px-1 text-xs text-muted-foreground select-none">A</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setScaleIdx((s) => Math.min(SCALES.length - 1, s + 1))}
            disabled={scaleIdx === SCALES.length - 1}
            aria-label="Larger text"
          >
            <Plus />
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close presentation (Esc)">
          <X />
        </Button>
      </header>

      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
      </div>

      {/* Slide */}
      <main
        ref={mainRef}
        className="relative flex min-h-0 flex-1 items-center gap-[2vw] overflow-y-auto px-4 py-5 sm:px-20"
        onClick={() => spot != null && setSpot(null)}
      >
        {/* The student's face on every slide (the overview already shows it large). */}
        {slide.kind !== "overview" && (
          <aside className="hidden w-[clamp(150px,14vw,260px)] shrink-0 self-center lg:block" aria-label="Student">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <StudentAvatar
                photoPath={student.photoPath}
                initials={student.initials}
                shape="square"
                size="w-full aspect-[4/5]"
                displayWidth={320}
                className="rounded-none text-[2.5rem] font-medium"
                zoomable
                alt={student.name}
              />
              <div className="space-y-1.5 p-3 text-center">
                <p className="text-[clamp(14px,1.05vw,18px)] leading-tight font-semibold">{student.name}</p>
                {student.code && <p className="font-mono text-xs text-muted-foreground">{student.code}</p>}
                {student.facts.length > 0 && <p className="text-xs leading-snug text-muted-foreground">{student.facts.join(" · ")}</p>}
                <p className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", scoreClass)}>
                  {assessment.final_score} pts · {scoreLabel}
                </p>
              </div>
            </div>
          </aside>
        )}
        <div
          key={index}
          ref={contentRef}
          className="m-auto w-full max-w-6xl min-w-0 animate-in duration-300 fade-in slide-in-from-right-4"
          // No font-size transition: the fit search must measure each size immediately.
          style={{ fontSize: slideFont(SCALES[scaleIdx] * fit), transition: "none" }}
        >
          {slide.kind === "overview" && (
            <OverviewSlide
              student={student}
              assessment={assessment}
              scoreLabel={scoreLabel}
              scoreClass={scoreClass}
              vac={vac}
              concerns={concerns}
              onJump={(l) => go(l.slide, l.row)}
              onSeeAll={() => go(last)}
              comments={notesSlide?.comments ?? null}
              noteCount={notesSlide?.notes.length ?? 0}
              onNotes={notesIndex >= 0 ? () => go(notesIndex) : undefined}
            />
          )}
          {slide.kind === "section" && <SectionSlideView slide={slide} spot={spot} onSpot={setSpot} />}
          {slide.kind === "notes" && <NotesSlide slide={slide} />}
          {slide.kind === "summary" && (
            <SummarySlide
              concerns={concerns}
              watch={watch}
              strengths={strengths}
              scoreLine={`${assessment.final_score} pts · ${scoreLabel}`}
              scoreClass={scoreClass}
              vacLine={vac.tier ? `${assessment.vac_total_score}/36 · ${VAC_TIER_LABELS[vac.tier]}` : null}
              vacClass={vac.tier ? VAC_TIER_BADGE_CLASSES[vac.tier] : ""}
              onJump={(l) => go(l.slide, l.row)}
              comments={notesSlide?.comments ?? null}
              noteCount={notesSlide?.notes.length ?? 0}
              onNotes={notesIndex >= 0 ? () => go(notesIndex) : undefined}
            />
          )}
        </div>

        <SideArrow side="left" disabled={index === 0} onClick={() => go(index - 1)} />
        <SideArrow side="right" disabled={index === last} onClick={() => go(index + 1)} />
      </main>

      {/* Section navigator */}
      <footer className="flex items-center gap-2 border-t bg-background/90 px-3 py-2 backdrop-blur sm:px-6">
        <Button variant="outline" size="sm" onClick={() => go(index - 1)} disabled={index === 0} className="sm:hidden" aria-label="Previous">
          <ChevronLeft />
        </Button>
        <nav ref={navRef} className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Sections">
          {slides.map((s, i) => {
            const count = s.kind === "section" ? s.rows.filter((r) => r.need === "high").length : 0;
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => go(i)}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                  i === index ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <s.icon className="size-3.5" />
                {s.title}
                {count > 0 && (
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                      i === index ? "bg-primary-foreground text-primary" : "bg-rose-500 text-white",
                    )}
                    aria-label={`${count} concerns`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {index + 1} / {slides.length}
        </span>
        <Button variant="outline" size="sm" onClick={() => go(index + 1)} disabled={index === last} className="sm:hidden" aria-label="Next">
          <ChevronRight />
        </Button>
      </footer>
    </div>
  );

  return createPortal(view, document.body);
}

function SideArrow({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "fixed top-1/2 hidden -translate-y-1/2 rounded-full border bg-background p-3 text-muted-foreground shadow-md transition hover:scale-105 hover:text-foreground disabled:pointer-events-none disabled:opacity-0 sm:block",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-6" />
    </button>
  );
}

function NeedPill({ need, className }: { need: Need; className?: string }) {
  const n = NEED[need];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-[0.3em] rounded-full px-[0.55em] py-[0.15em] text-[0.72em] font-medium", n.pill, className)}>
      <n.icon className="size-[1.05em]" />
      {n.label}
    </span>
  );
}

function SlideTitle({ icon: Icon, title, right }: { icon: LucideIcon; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-[1em] flex flex-wrap items-center justify-between gap-[0.6em]">
      <h2 className="flex items-center gap-[0.55em] text-[1.55em] font-semibold tracking-tight">
        <span className="flex size-[1.5em] items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="size-[0.85em]" />
        </span>
        {title}
      </h2>
      {right}
    </div>
  );
}

/** Section slide: one tile per answer, colour-coded by need; click to spotlight. */
function SectionSlideView({ slide, spot, onSpot }: { slide: SectionSlide; spot: number | null; onSpot: (i: number | null) => void }) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const r of slide.rows) if (r.need) counts[r.need] += 1;
  const many = slide.rows.length > 6;

  return (
    <section>
      <SlideTitle
        icon={slide.icon}
        title={slide.title}
        right={
          <div className="flex flex-wrap items-center gap-[0.4em] text-[0.95em]">
            {slide.badge}
            {(["high", "medium", "low"] as const).map((n) => {
              if (counts[n] === 0) return null;
              const I = NEED[n].icon;
              return (
                <span key={n} className={cn("inline-flex items-center gap-[0.3em] rounded-full px-[0.65em] py-[0.2em] text-[0.85em] font-medium", NEED[n].pill)}>
                  <I className="size-[1em]" />
                  {counts[n]} {NEED[n].label.toLowerCase()}
                </span>
              );
            })}
          </div>
        }
      />
      <div className={cn("grid", many ? "gap-[0.6em] md:grid-cols-2 xl:grid-cols-3" : "gap-[0.75em] md:grid-cols-2")}>
        {slide.rows.map((r, i) => {
          const n = r.need ? NEED[r.need] : null;
          const long = r.value.length + (r.note?.length ?? 0) > 60;
          const active = spot === i;
          const dimmed = spot != null && !active;
          return (
            <button
              key={r.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpot(active ? null : i);
              }}
              aria-pressed={active}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                many ? "p-[0.7em] pl-[1em]" : "p-[0.9em] pl-[1.15em]",
                n?.tile,
                long && "md:col-span-2",
                active && "z-10 scale-[1.03] shadow-xl ring-2 ring-primary",
                dimmed && "opacity-30",
              )}
            >
              <span className={cn("absolute inset-y-0 left-0 w-[0.3em]", n ? n.bar : "bg-border")} aria-hidden />
              <div className="flex items-start justify-between gap-[0.6em]">
                <p className="text-[0.75em] font-medium tracking-wide text-muted-foreground uppercase">{r.label}</p>
                {r.need && <NeedPill need={r.need} />}
              </div>
              <p
                className={cn(
                  "mt-[0.2em] leading-snug",
                  r.noteOnly ? "font-normal italic" : "font-medium",
                  active ? "text-[1.45em]" : many ? "text-[1.05em]" : "text-[1.15em]",
                )}
              >
                {r.noteOnly && <MessageSquareText className="mr-[0.35em] inline size-[0.85em] align-[-0.05em] text-muted-foreground" />}
                {r.value}
              </p>
              {r.note && (
                <p className={cn("mt-[0.4em] flex gap-[0.4em] border-t border-current/10 pt-[0.4em] leading-snug text-muted-foreground italic", active ? "text-[1.1em]" : "text-[0.88em]")}>
                  <MessageSquareText className="mt-[0.18em] size-[0.95em] shrink-0" aria-label="Visitor's note" />
                  {r.note}
                </p>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-[1em] text-center text-[0.8em] text-muted-foreground">Tip: click a card to spotlight it for discussion.</p>
    </section>
  );
}

/**
 * Every comment from the Social Form on one slide: the visitor's overall
 * comments first, then each note grouped by section, next to the answer it
 * explains.
 */
function NotesSlide({ slide }: { slide: Extract<Slide, { kind: "notes" }> }) {
  const groups = new Map<string, FieldNote[]>();
  for (const n of slide.notes) groups.set(n.section, [...(groups.get(n.section) ?? []), n]);
  return (
    <section className="space-y-[1em]">
      <SlideTitle
        icon={slide.icon}
        title={slide.title}
        right={
          <div className="flex flex-wrap gap-[0.4em]">
            {slide.rows.map((r) => (
              <span key={r.label} className="rounded-full border bg-card px-[0.8em] py-[0.25em] text-[0.85em]">
                <span className="text-muted-foreground">{r.label}:</span> <span className="font-medium">{r.value}</span>
              </span>
            ))}
          </div>
        }
      />
      {slide.comments && (
        <figure className="relative rounded-2xl border-l-[0.35em] border-primary bg-card p-[1.2em] pl-[1.4em] shadow-sm">
          <figcaption className="mb-[0.4em] text-[0.75em] font-medium tracking-wide text-muted-foreground uppercase">Home visitor&apos;s overall comments</figcaption>
          <blockquote className="text-[1.2em] leading-relaxed whitespace-pre-line">{slide.comments}</blockquote>
        </figure>
      )}
      {groups.size > 0 ? (
        <div className="columns-1 gap-[1em] md:columns-2 [&>*]:mb-[1em] [&>*]:break-inside-avoid">
          {[...groups.entries()].map(([section, notes]) => {
            const Icon = notes[0].icon;
            return (
              <div key={section} className="rounded-xl border bg-card shadow-sm">
                <p className="flex items-center gap-[0.45em] border-b px-[1em] py-[0.55em] text-[0.8em] font-semibold tracking-wide text-muted-foreground uppercase">
                  <Icon className="size-[1.1em] text-primary" /> {section}
                </p>
                <ul className="divide-y">
                  {notes.map((n) => (
                    <li key={n.label} className="px-[1em] py-[0.6em]">
                      <p className="flex flex-wrap items-baseline gap-x-[0.5em] text-[0.95em]">
                        <span className="font-medium">{n.label}</span>
                        {n.answer && <span className="text-muted-foreground">· {n.answer}</span>}
                      </p>
                      <p className="mt-[0.2em] flex gap-[0.4em] leading-snug">
                        <MessageSquareText className="mt-[0.2em] size-[0.95em] shrink-0 text-muted-foreground" aria-hidden />
                        <span className="italic">{n.note}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        !slide.comments && <p className="text-[0.95em] text-muted-foreground">No notes were written on this form.</p>
      )}
    </section>
  );
}

/** Horizontal scale with labelled bands and a marker for the value. */
function Gauge({
  value,
  min,
  max,
  bands,
}: {
  value: number;
  min: number;
  max: number;
  bands: { to: number; label: string; className: string }[];
}) {
  const span = max - min;
  const segments = bands.map((b, i) => {
    const from = i === 0 ? min : Math.min(bands[i - 1].to, max);
    return { ...b, width: ((Math.min(b.to, max) - from) / span) * 100 };
  });
  const left = `${((Math.min(Math.max(value, min), max) - min) / span) * 100}%`;
  return (
    <div className="pt-[2.1em]">
      <div className="relative">
        <div className="flex h-[0.7em] gap-[2px] overflow-hidden rounded-full">
          {segments.map((s) => (
            <div key={s.label} className={s.className} style={{ width: `${s.width}%` }} />
          ))}
        </div>
        <div className="absolute -top-[2.1em] -translate-x-1/2 text-center" style={{ left }}>
          <span className="rounded-md bg-foreground px-[0.5em] py-[0.15em] text-[0.85em] font-semibold whitespace-nowrap text-background">{value}</span>
          <div className="mx-auto h-[1.25em] w-[2px] bg-foreground" />
        </div>
      </div>
      <div className="mt-[0.4em] flex text-[0.72em] text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="truncate text-center" style={{ width: `${s.width}%` }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function OverviewSlide({
  student,
  assessment,
  scoreLabel,
  scoreClass,
  vac,
  concerns,
  onJump,
  onSeeAll,
  comments,
  noteCount,
  onNotes,
}: {
  student: PresentationStudent;
  assessment: SocialAssessmentRow;
  scoreLabel: string;
  scoreClass: string;
  vac: ReturnType<typeof buildVac>;
  concerns: Located[];
  onJump: (l: Located) => void;
  onSeeAll: () => void;
  comments: string | null;
  noteCount: number;
  onNotes?: () => void;
}) {
  const score = assessment.final_score ?? 0;
  return (
    <div className="grid items-start gap-[1.2em] lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
      {/* Who */}
      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
        <StudentAvatar
          photoPath={student.photoPath}
          initials={student.initials}
          shape="square"
          size="w-full aspect-[4/5] max-h-[58vh]"
          displayWidth={520}
          className="rounded-none text-[3.5em] font-medium"
          zoomable
          alt={student.name}
        />
        <div className="space-y-[0.5em] p-[1.1em] text-center">
          <div>
            <h2 className="text-[1.6em] leading-tight font-semibold tracking-tight">{student.name}</h2>
            {student.code && <p className="font-mono text-[0.85em] text-muted-foreground">{student.code}</p>}
          </div>
          {student.facts.length > 0 && (
            <p className="text-[0.95em] text-muted-foreground">{student.facts.join(" · ")}</p>
          )}
          <p className="text-[0.8em] text-muted-foreground">
            Home visit #{assessment.visit_number}
            {assessment.visit_date ? ` · ${assessment.visit_date}` : ""}
            {assessment.visitor_name ? ` · ${assessment.visitor_name}` : ""}
          </p>
        </div>
      </div>

      {/* At a glance */}
      <div className="space-y-[1em]">
        <div className="grid gap-[1em] sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-[1.1em] shadow-sm">
            <p className="text-[0.75em] font-medium tracking-wide text-muted-foreground uppercase">Poverty score</p>
            <div className="mt-[0.2em] flex flex-wrap items-baseline gap-[0.5em]">
              <span className="text-[2.2em] leading-none font-semibold tabular-nums">{score}</span>
              <span className={cn("rounded-full px-[0.7em] py-[0.2em] text-[0.85em] font-medium", scoreClass)}>{scoreLabel}</span>
            </div>
            <p className="mt-[0.3em] text-[0.75em] text-muted-foreground">Lower score = poorer household</p>
            <Gauge
              value={score}
              min={0}
              max={60}
              bands={[
                { to: 25, label: "Very poor", className: "bg-emerald-500" },
                { to: 40, label: "Poor", className: "bg-sky-500" },
                { to: FAILED_HOME_VISIT_THRESHOLD, label: "Medium", className: "bg-amber-400" },
                { to: 60, label: "Fail", className: "bg-rose-400" },
              ]}
            />
          </div>
          <div className="rounded-2xl border bg-card p-[1.1em] shadow-sm">
            <p className="text-[0.75em] font-medium tracking-wide text-muted-foreground uppercase">Vulnerability checklist</p>
            {vac.tier && assessment.vac_total_score != null ? (
              <>
                <div className="mt-[0.2em] flex flex-wrap items-baseline gap-[0.5em]">
                  <span className="text-[2.2em] leading-none font-semibold tabular-nums">
                    {assessment.vac_total_score}
                    <span className="text-[0.45em] font-medium text-muted-foreground">/36</span>
                  </span>
                  <span className={cn("rounded-full px-[0.7em] py-[0.2em] text-[0.85em] font-medium", VAC_TIER_BADGE_CLASSES[vac.tier])}>
                    {VAC_TIER_LABELS[vac.tier]}
                  </span>
                </div>
                <p className="mt-[0.3em] text-[0.75em] text-muted-foreground">Lower score = more vulnerable</p>
                {vac.answered < vac.total && (
                  <p className="mt-[0.3em] flex items-center gap-[0.3em] text-[0.75em] font-medium text-amber-700 dark:text-amber-300">
                    <AlertCircle className="size-[1em]" /> Only {vac.answered} of {vac.total} items answered — score not comparable
                  </p>
                )}
                <Gauge
                  value={assessment.vac_total_score}
                  min={12}
                  max={36}
                  bands={[
                    { to: 18, label: "High", className: "bg-rose-500" },
                    { to: 25, label: "Moderate", className: "bg-amber-400" },
                    { to: 36, label: "Low", className: "bg-emerald-500" },
                  ]}
                />
              </>
            ) : (
              <p className="mt-[0.5em] text-[1em] text-muted-foreground">Not recorded</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-[1.1em] shadow-sm">
          <div className="mb-[0.6em] flex items-center justify-between gap-2">
            <p className="flex items-center gap-[0.4em] text-[1em] font-medium">
              <AlertTriangle className="size-[1em] text-rose-600" /> Key concerns
            </p>
            <span className="text-[0.8em] text-muted-foreground">Click one to open it</span>
          </div>
          {concerns.length === 0 ? (
            <p className="text-[0.95em] text-muted-foreground">No high-need answers recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-[0.45em]">
              {concerns.slice(0, 6).map((c) => (
                <button
                  key={`${c.section}-${c.label}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJump(c);
                  }}
                  className={cn(
                    "inline-flex items-center gap-[0.35em] rounded-full border px-[0.7em] py-[0.25em] text-left text-[0.85em] transition hover:shadow-sm",
                    NEED.high.tile,
                  )}
                  title={`${c.section}: ${c.value}`}
                >
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground">· {c.value.length > 34 ? `${c.value.slice(0, 33)}…` : c.value}</span>
                </button>
              ))}
              {concerns.length > 6 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeeAll();
                  }}
                  className="self-center px-[0.4em] text-[0.9em] font-medium text-primary hover:underline"
                >
                  +{concerns.length - 6} more → Summary
                </button>
              )}
            </div>
          )}
        </div>

        {(comments || noteCount > 0) && (
          <div className="rounded-2xl border-l-[0.35em] border-primary bg-card p-[1.1em] pl-[1.2em] shadow-sm">
            <div className="mb-[0.4em] flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-[0.4em] text-[1em] font-medium">
                <MessageSquareText className="size-[1em] text-primary" /> Home visitor&apos;s comments
              </p>
              {noteCount > 0 && onNotes && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNotes();
                  }}
                  className="text-[0.85em] font-medium text-primary hover:underline"
                >
                  All {noteCount} note{noteCount === 1 ? "" : "s"} →
                </button>
              )}
            </div>
            {comments ? (
              <p className="line-clamp-4 text-[0.98em] leading-relaxed whitespace-pre-line">{comments}</p>
            ) : (
              <p className="text-[0.9em] text-muted-foreground">No overall comment; {noteCount} note{noteCount === 1 ? "" : "s"} on individual answers.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummarySlide({
  concerns,
  watch,
  strengths,
  scoreLine,
  scoreClass,
  vacLine,
  vacClass,
  onJump,
  comments,
  noteCount,
  onNotes,
}: {
  concerns: Located[];
  watch: Located[];
  strengths: Located[];
  scoreLine: string;
  scoreClass: string;
  vacLine: string | null;
  vacClass: string;
  onJump: (l: Located) => void;
  comments: string | null;
  noteCount: number;
  onNotes?: () => void;
}) {
  const column = (need: Need, title: string, items: Located[], split = false) => {
    const n = NEED[need];
    return (
      <div className="flex min-w-0 flex-col rounded-2xl border bg-card shadow-sm">
        <div className={cn("flex items-center justify-between gap-2 rounded-t-2xl px-[1em] py-[0.7em]", n.tile)}>
          <p className="flex items-center gap-[0.4em] text-[1em] font-medium">
            <n.icon className="size-[1em]" />
            {title}
          </p>
          <span className={cn("rounded-full px-[0.6em] py-[0.1em] text-[0.8em] font-medium tabular-nums", n.pill)}>{items.length}</span>
        </div>
        {items.length === 0 ? (
          <p className="p-[1em] text-[0.9em] text-muted-foreground">None</p>
        ) : (
          // No inner scrolling: the whole slide shrinks to fit the screen instead.
          <ul className={cn(split ? "gap-x-[1em] px-[0.4em] sm:columns-2" : "divide-y")}>
            {items.map((l) => (
              <li key={`${l.section}-${l.label}`} className={cn(split && "break-inside-avoid border-b border-border/60")}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJump(l);
                  }}
                  title={`${l.section}${l.note ? ` — note: ${l.note}` : ""} — click to open`}
                  className={cn(
                    "block w-full py-[0.4em] text-left text-[0.92em] leading-snug transition hover:bg-muted/60",
                    split ? "px-[0.6em]" : "px-[1em]",
                  )}
                >
                  <span className="font-medium">{l.label}</span>
                  <span className="text-muted-foreground"> · {l.value}</span>
                  {l.note && <MessageSquareText className="ml-[0.35em] inline size-[0.9em] align-[-0.1em] text-muted-foreground" aria-label="Has a note" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section>
      <SlideTitle
        icon={ClipboardCheck}
        title="Summary for the committee"
        right={
          <div className="flex flex-wrap gap-[0.4em] text-[0.95em]">
            <span className={cn("rounded-full px-[0.75em] py-[0.25em] text-[0.85em] font-medium", scoreClass)}>{scoreLine}</span>
            {vacLine && <span className={cn("rounded-full px-[0.75em] py-[0.25em] text-[0.85em] font-medium", vacClass)}>{vacLine}</span>}
          </div>
        }
      />
      {concerns.length > 8 ? (
        // Many concerns: give them two-thirds of the width in two columns; the shorter lists stack beside them.
        <div className="grid items-start gap-[1em] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {column("high", "Concerns", concerns, true)}
          <div className="grid gap-[1em]">
            {column("medium", "To watch", watch)}
            {column("low", "Strengths", strengths)}
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-[1em] md:grid-cols-3">
          {column("high", "Concerns", concerns)}
          {column("medium", "To watch", watch)}
          {column("low", "Strengths", strengths)}
        </div>
      )}
      {(comments || noteCount > 0) && (
        <div className="mt-[1em] rounded-2xl border-l-[0.35em] border-primary bg-card p-[1em] pl-[1.2em] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.75em] font-medium tracking-wide text-muted-foreground uppercase">Home visitor&apos;s overall comments</p>
            {noteCount > 0 && onNotes && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNotes();
                }}
                className="inline-flex items-center gap-[0.3em] text-[0.85em] font-medium text-primary hover:underline"
              >
                <MessageSquareText className="size-[1em]" /> All {noteCount} note{noteCount === 1 ? "" : "s"} →
              </button>
            )}
          </div>
          <p className="mt-[0.3em] text-[1.02em] leading-relaxed whitespace-pre-line">{comments || <span className="text-muted-foreground">No overall comment.</span>}</p>
        </div>
      )}
    </section>
  );
}
