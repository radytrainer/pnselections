"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportDocument } from "@/components/annual-report/ReportDocument";
import { useReportData } from "@/components/annual-report/useReportData";
import {
  CHAPTERS,
  copyableContent,
  DEFAULT_BUDGET_ITEMS,
  FIGURES,
  MAX_PHOTOS,
  STAGES,
  TEXTS,
  type ChapterKey,
  type FigureKey,
  type PhotoKey,
  type ReportContent,
  type StageKey,
  type TextKey,
} from "@/features/annual-report/content";
import { buildReportModel, fmt, usd, type ReportModel } from "@/features/annual-report/model";
import { TEMPLATES, type TemplateKey } from "@/features/annual-report/templates";
import { getAnnualReport, reportPhotoUrl, saveAnnualReport, uploadReportPhoto } from "@/services/annualReportService";
import { listCycles, type Cycle } from "@/services/lookupService";
import { compressImageFile } from "@/lib/storage";
import { cn } from "@/lib/utils";

type Group = "cover" | ChapterKey;

const GROUPS: { key: Group; label: string }[] = [{ key: "cover", label: "Cover page" }, ...CHAPTERS.map((c) => ({ key: c.key as Group, label: c.label }))];

/** The Annual Report editor (role check is done by the page). */
export function AnnualReportEditor() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const { data, error, loading, reload } = useReportData(cycleId);
  const [content, setContent] = useState<ReportContent>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<Group>("cover");
  const [tab, setTab] = useState("edit");
  const [wordBusy, setWordBusy] = useState(false);

  useEffect(() => {
    listCycles()
      .then((cs) => {
        const sorted = [...cs].sort((a, b) => b.year - a.year);
        setCycles(sorted);
        setCycleId((cur) => cur ?? (sorted.find((c) => c.status === "active") ?? sorted[0])?.id ?? null);
      })
      .catch(() => toast.error("Couldn't load the selection cycles"));
  }, []);

  // Start editing from the saved version whenever a cycle loads.
  useEffect(() => {
    if (!data) return;
    setContent(data.source.content ?? {});
    setDirty(false);
  }, [data]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const model = useMemo(() => (data ? buildReportModel(data.source, content, data.sessions, data.exam) : null), [data, content]);
  /** The calculated figures, ignoring anything typed in (shown as placeholders). */
  const autoModel = useMemo(() => (data ? buildReportModel(data.source, { ...content, figures: {}, timeline: null }, data.sessions, data.exam) : null), [data, content]);

  function update(patch: (c: ReportContent) => ReportContent) {
    setContent((c) => patch(c));
    setDirty(true);
  }

  async function save(quiet = false) {
    if (!cycleId) return false;
    setSaving(true);
    try {
      await saveAnnualReport(cycleId, content);
      setDirty(false);
      if (!quiet) toast.success("Report saved");
      void reload();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the report");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function openPdf() {
    if (!cycleId) return;
    // Open the tab first (pop-up blockers allow it only straight after the click), then save.
    const win = window.open("about:blank", "_blank");
    if (dirty && !(await save(true))) {
      win?.close();
      return;
    }
    const url = `/report/annual/${cycleId}?print=1`;
    if (win) win.location.href = url;
    else window.location.href = url;
  }

  async function downloadWord() {
    if (!model) return;
    setWordBusy(true);
    try {
      const { downloadAnnualReportDocx } = await import("@/features/annual-report/docx");
      await downloadAnnualReportDocx(model);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the Word file");
    } finally {
      setWordBusy(false);
    }
  }

  async function copyFrom(otherId: string) {
    try {
      const other = await getAnnualReport(otherId);
      const copied = copyableContent(other.content ?? {});
      update((c) => ({ ...c, ...copied, figures: { ...c.figures, ...copied.figures } }));
      toast.success("Text copied — review it, then Save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't copy");
    }
  }

  const cycle = cycles.find((c) => c.id === cycleId);
  const others = cycles.filter((c) => c.id !== cycleId);
  const hidden = new Set(content.hidden ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Annual Report</h1>
          <p className="text-sm text-muted-foreground">
            The yearly selection report with the PN logo. The figures are counted from this cycle&apos;s data; add the story, challenges, budget and photos, then download it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={cycleId ?? ""} onValueChange={(v) => v && v !== cycleId && (!dirty || confirm("Discard unsaved changes?")) && setCycleId(v)}>
            <SelectTrigger className="w-52" aria-label="Selection cycle">
              <SelectValue>{() => cycle?.name ?? "Choose a cycle"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => save()} disabled={!dirty || saving || !data}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
          <Button variant="outline" onClick={downloadWord} disabled={!model || wordBusy}>
            {wordBusy ? <Loader2 className="animate-spin" /> : <FileText />} Word
          </Button>
          <Button onClick={openPdf} disabled={!model || saving}>
            <Download /> PDF
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : !data || !model || !autoModel || loading ? (
        <Skeleton className="h-[32rem] w-full" />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="edit">Edit content</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {dirty ? (
                <span className="font-medium text-amber-700">Unsaved changes</span>
              ) : data.source.updatedAt ? (
                <span>
                  Saved {formatDistanceToNow(new Date(data.source.updatedAt), { addSuffix: true })}
                  {data.source.updatedBy ? ` by ${data.source.updatedBy}` : ""}
                </span>
              ) : (
                <span>Not saved yet</span>
              )}
              {others.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                    <Copy /> Copy text from…
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {others.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => copyFrom(c.id)}>
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <TabsContent value="edit" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <nav className="h-fit rounded-lg border bg-card p-1.5 lg:sticky lg:top-4" aria-label="Report sections">
                {GROUPS.map((gr) => {
                  const off = gr.key !== "cover" && hidden.has(gr.key as ChapterKey);
                  return (
                    <button
                      key={gr.key}
                      type="button"
                      onClick={() => setGroup(gr.key)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        group === gr.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        off && "line-through opacity-60",
                      )}
                    >
                      <span className="flex-1 truncate">{gr.label}</span>
                      {off && <EyeOff className="size-3.5" />}
                    </button>
                  );
                })}
              </nav>
              <div className="min-w-0 space-y-4">
                {group === "cover" ? (
                  <CoverEditor content={content} auto={autoModel} update={update} />
                ) : (
                  <ChapterEditor key={group} chapter={group} content={content} auto={autoModel} model={model} update={update} />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4 space-y-4">
            <TemplatePicker value={model.theme.key} onChange={(key) => update((c) => ({ ...c, template: key }))} />
            <div className="overflow-x-auto rounded-lg bg-slate-100 py-6">
              <div className="min-w-[210mm]">
                <ReportDocument m={model} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------
type Update = (patch: (c: ReportContent) => ReportContent) => void;

/** Template cards with a small sketch of each cover and chapter page. */
function TemplatePicker({ value, onChange }: { value: TemplateKey; onChange: (key: TemplateKey) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Template</span>
        <span className="text-xs text-muted-foreground">Same content, different look — used for the PDF and the Word file.</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Report template">
        {Object.values(TEMPLATES).map((t) => {
          const on = t.key === value;
          const P = `#${t.primary}`;
          const A = `#${t.accent}`;
          const S = `#${t.second}`;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(t.key)}
              className={cn(
                "group flex flex-col gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                on ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted/50",
              )}
            >
              <div className="flex gap-2" aria-hidden>
                {/* Cover sketch */}
                <div className="relative h-24 w-[4.25rem] shrink-0 overflow-hidden rounded-sm border bg-white shadow-sm">
                  {t.cover === "band" && (
                    <>
                      <div className="h-10" style={{ background: `linear-gradient(135deg, ${P}, ${S})` }} />
                      <div className="h-0.5" style={{ background: A }} />
                      <div className="mx-1.5 mt-1.5 h-8 rounded-[1px] bg-slate-200" />
                    </>
                  )}
                  {t.cover === "photo" && (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, #94a3b8, ${P} 75%)` }}>
                      <div className="absolute bottom-2 left-1.5 space-y-0.5">
                        <div className="h-0.5 w-3" style={{ background: A }} />
                        <div className="h-1.5 w-10 bg-white/90" />
                        <div className="h-1 w-6" style={{ background: A }} />
                      </div>
                    </div>
                  )}
                  {t.cover === "formal" && (
                    <div className="absolute inset-1 flex flex-col items-center border p-1" style={{ borderColor: P }}>
                      <div className="h-1.5 w-4 rounded-full" style={{ background: P }} />
                      <div className="mt-2 h-px w-8" style={{ background: P }} />
                      <div className="mt-0.5 h-1.5 w-9" style={{ background: P }} />
                      <div className="mt-0.5 h-px w-8" style={{ background: P }} />
                      <div className="mt-1.5 h-6 w-9 bg-slate-200" />
                    </div>
                  )}
                </div>
                {/* Chapter page sketch */}
                <div className="h-24 flex-1 overflow-hidden rounded-sm border bg-white p-1.5 shadow-sm">
                  {t.head === "chip" && (
                    <div className="flex items-center gap-1 border-b-2 pb-0.5" style={{ borderColor: P }}>
                      <div className="h-2 w-2.5 rounded-[1px]" style={{ background: A }} />
                      <div className="h-1.5 w-12" style={{ background: P }} />
                    </div>
                  )}
                  {t.head === "number" && (
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] leading-none font-extrabold" style={{ color: A }}>
                        02
                      </span>
                      <div className="h-1.5 w-12" style={{ background: P }} />
                    </div>
                  )}
                  {t.head === "centered" && (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-0.5 w-6" style={{ background: A }} />
                      <div className="h-1.5 w-14" style={{ background: P }} />
                      <div className="h-[3px] w-8 border-y" style={{ borderColor: P }} />
                    </div>
                  )}
                  <div className="mt-1.5 grid grid-cols-3 gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-3.5 rounded-[1px]"
                        style={
                          t.tiles === "filled"
                            ? { background: i === 0 ? P : `#${t.soft}`, borderTop: `2px solid ${i === 0 ? A : S}` }
                            : { border: "1px solid #e2e8f0", borderLeft: `2px solid ${i === 0 ? A : P}` }
                        }
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="h-1 w-full bg-slate-200" />
                    <div className="h-1 w-5/6 bg-slate-200" />
                  </div>
                  <div className="mt-1.5">
                    <div className="h-1.5" style={t.tableHead === "filled" ? { background: P } : { borderTop: `1px solid ${P}`, borderBottom: `1px solid ${P}` }} />
                    <div className="mt-0.5 h-1 bg-slate-100" />
                    <div className="mt-0.5 h-1 bg-slate-100" />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {t.name}
                  {on && <span className="rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary">Selected</span>}
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function CoverEditor({ content, auto, update }: { content: ReportContent; auto: ReportModel; update: Update }) {
  const set = (k: "title" | "subtitle" | "generation" | "tagline" | "supportedBy") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    update((c) => ({ ...c, [k]: e.target.value }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cover page</CardTitle>
        <CardDescription>The PN logo is added automatically. Leave a field empty to use the suggested text.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <Input value={content.title ?? ""} onChange={set("title")} placeholder={auto.title} maxLength={80} />
          </Field>
          <Field label="Subtitle">
            <Input value={content.subtitle ?? ""} onChange={set("subtitle")} placeholder={auto.subtitle} maxLength={80} />
          </Field>
          <Field label="Generation">
            <Input value={content.generation ?? ""} onChange={set("generation")} placeholder={auto.generation} maxLength={80} />
          </Field>
          <Field label="Tagline">
            <Input value={content.tagline ?? ""} onChange={set("tagline")} placeholder={auto.tagline} maxLength={200} />
          </Field>
        </div>
        <Field label="Supported by" hint="One partner or donor per line — shown at the bottom of the cover.">
          <Textarea rows={4} value={content.supportedBy ?? ""} onChange={set("supportedBy")} placeholder={"AFD\nFondation…\n…"} maxLength={1000} />
        </Field>
        <PhotoField photoKey="cover" content={content} update={update} label="Cover photo" />
      </CardContent>
    </Card>
  );
}

function ChapterEditor({ chapter, content, auto, model, update }: { chapter: ChapterKey; content: ReportContent; auto: ReportModel; model: ReportModel; update: Update }) {
  const meta = CHAPTERS.find((c) => c.key === chapter)!;
  const texts = (Object.keys(TEXTS) as TextKey[]).filter((k) => TEXTS[k].chapter === chapter);
  const figures = (Object.keys(FIGURES) as FigureKey[]).filter((k) => FIGURES[k].chapter === chapter);
  const hidden = (content.hidden ?? []).includes(chapter);
  const summary = model.summary[chapter];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{meta.label}</CardTitle>
            <CardDescription>{hidden ? "Left out of the report." : "Included in the report."}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              update((c) => {
                const set = new Set(c.hidden ?? []);
                if (set.has(chapter)) set.delete(chapter);
                else set.add(chapter);
                return { ...c, hidden: [...set] };
              })
            }
          >
            {hidden ? <Eye /> : <EyeOff />} {hidden ? "Include" : "Leave out"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary && (
            <div className="rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm">
              <div className="mb-0.5 text-xs font-medium tracking-wide text-primary uppercase">Written from the figures</div>
              {summary}
            </div>
          )}
          {figures.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Figures</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {figures.map((k) => (
                  <FigureInput key={k} k={k} content={content} auto={auto} update={update} />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Grey numbers are counted from the app. Type a number to replace one (e.g. figures recorded on paper); clear it to go back.</p>
            </div>
          )}
          {texts.map((k) => (
            <Field key={k} label={TEXTS[k].label}>
              <Textarea
                rows={k.endsWith("challenges") || k === "exam_next" ? 3 : 5}
                value={content.text?.[k] ?? ""}
                onChange={(e) => update((c) => ({ ...c, text: { ...c.text, [k]: e.target.value } }))}
                placeholder={TEXTS[k].hint}
                maxLength={6000}
              />
            </Field>
          ))}
          {meta.photo && <PhotoField photoKey={chapter} content={content} update={update} label="Photos" />}
        </CardContent>
      </Card>
      {chapter === "timeline" && <TimelineEditor content={content} auto={auto} update={update} />}
      {chapter === "staff" && <StaffEditor content={content} auto={auto} update={update} />}
      {chapter === "budget" && <BudgetEditor content={content} model={model} update={update} />}
      {chapter === "recommendations" && <ReviewsEditor content={content} update={update} />}
    </>
  );
}

function FigureInput({ k, content, auto, update }: { k: FigureKey; content: ReportContent; auto: ReportModel; update: Update }) {
  const typed = content.figures?.[k];
  const autoValue = FIGURES[k].auto ? auto.fig[k] : null;
  return (
    <Field label={FIGURES[k].label}>
      <div className="relative">
        <Input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={typed ?? ""}
          placeholder={autoValue != null ? String(autoValue) : "—"}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            update((c) => ({ ...c, figures: { ...c.figures, [k]: v != null && Number.isFinite(v) ? v : null } }));
          }}
          className={cn(typed != null && FIGURES[k].auto && "border-amber-400 pr-8")}
        />
        {typed != null && FIGURES[k].auto && (
          <button
            type="button"
            title={`Use the counted number (${fmt(autoValue)})`}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => update((c) => ({ ...c, figures: { ...c.figures, [k]: null } }))}
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    </Field>
  );
}

function PhotoField({ photoKey, content, update, label }: { photoKey: PhotoKey; content: ReportContent; update: Update; label: string }) {
  const max = MAX_PHOTOS[photoKey];
  const list = content.photos?.[photoKey] ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!max) return null;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = max - list.length;
      const added: string[] = [];
      for (const file of [...files].slice(0, room)) {
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
          toast.error(`${file.name}: use a JPG, PNG or WebP photo`);
          continue;
        }
        const small = await compressImageFile(file, 4.5 * 1024 * 1024, 2400);
        added.push(await uploadReportPhoto(small));
      }
      if (added.length) update((c) => ({ ...c, photos: { ...c.photos, [photoKey]: [...(c.photos?.[photoKey] ?? []), ...added].slice(0, max) } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload the photo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {list.length} of {max}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((p, i) => (
          <div key={p} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reportPhotoUrl(p, 256)} alt={`Photo ${i + 1}`} className="h-24 w-36 rounded-md border object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => update((c) => ({ ...c, photos: { ...c.photos, [photoKey]: (c.photos?.[photoKey] ?? []).filter((x) => x !== p) } }))}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-90 hover:bg-black/80"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {list.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex h-24 w-36 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {busy ? "Uploading…" : "Add photo"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple={max > 1} className="hidden" onChange={(e) => add(e.target.files)} />
    </div>
  );
}

function TimelineEditor({ content, auto, update }: { content: ReportContent; auto: ReportModel; update: Update }) {
  const custom = content.timeline != null && content.timeline.length > 0;
  const rows = custom ? content.timeline! : auto.timeline;
  const setRow = (i: number, patch: Partial<{ stage: string; start: string; end: string }>) =>
    update((c) => ({ ...c, timeline: (c.timeline ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Stages and dates</CardTitle>
          <CardDescription>{custom ? "Your own dates." : "Taken from the dates recorded in the app (sessions, exams, interviews, visits, decisions)."}</CardDescription>
        </div>
        {custom ? (
          <Button variant="outline" size="sm" onClick={() => update((c) => ({ ...c, timeline: null }))}>
            <RotateCcw /> Use the app&apos;s dates
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              update((c) => ({
                ...c,
                timeline: auto.timeline.length ? auto.timeline.map(({ stage, start, end }) => ({ stage, start, end })) : STAGES.map((s) => ({ stage: s.label, start: "", end: "" })),
              }))
            }
          >
            Edit dates
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No dates recorded yet.</p>}
        {rows.map((r, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_2rem]">
            <Input value={r.stage} disabled={!custom} onChange={(e) => setRow(i, { stage: e.target.value })} aria-label="Stage" maxLength={80} />
            <Input type="date" value={r.start.slice(0, 10)} disabled={!custom} onChange={(e) => setRow(i, { start: e.target.value })} aria-label="From" />
            <Input type="date" value={r.end.slice(0, 10)} disabled={!custom} onChange={(e) => setRow(i, { end: e.target.value })} aria-label="To" />
            {custom ? (
              <Button variant="ghost" size="icon-sm" aria-label="Remove stage" onClick={() => update((c) => ({ ...c, timeline: (c.timeline ?? []).filter((_, j) => j !== i) }))}>
                <Trash2 />
              </Button>
            ) : (
              <span />
            )}
          </div>
        ))}
        {custom && (
          <Button variant="outline" size="sm" onClick={() => update((c) => ({ ...c, timeline: [...(c.timeline ?? []), { stage: "", start: "", end: "" }] }))}>
            <Plus /> Add stage
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StaffEditor({ content, auto, update }: { content: ReportContent; auto: ReportModel; update: Update }) {
  const extra = content.staff ?? [];
  const manualNames = new Set(extra.map((s) => s.name.trim().toLowerCase()));
  const recorded = auto.staff.filter((s) => !manualNames.has(s.name.toLowerCase()));
  const setRow = (i: number, patch: Partial<{ name: string; stages: StageKey[] }>) =>
    update((c) => ({ ...c, staff: (c.staff ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff</CardTitle>
        <CardDescription>
          Found in the app: interviewers, home visitors, committee voters and PNC staff who presented information sessions. Add anyone else (exam supervisors, session helpers…) below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {recorded.length === 0 && <span className="text-sm text-muted-foreground">No staff recorded in the app for this cycle.</span>}
          {recorded.map((s) => (
            <span key={s.name} className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs">
              {s.name} <span className="text-muted-foreground">· {[...s.stages].map((k) => STAGES.find((x) => x.key === k)?.label.split(" ")[0]).join(", ")}</span>
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {extra.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <Input className="w-56" value={r.name} placeholder="Name" onChange={(e) => setRow(i, { name: e.target.value })} maxLength={80} aria-label="Staff name" />
              {STAGES.map((s) => (
                <label key={s.key} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={r.stages.includes(s.key)}
                    onChange={(e) => setRow(i, { stages: e.target.checked ? [...r.stages, s.key] : r.stages.filter((x) => x !== s.key) })}
                  />
                  {s.label}
                </label>
              ))}
              <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Remove" onClick={() => update((c) => ({ ...c, staff: (c.staff ?? []).filter((_, j) => j !== i) }))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => update((c) => ({ ...c, staff: [...(c.staff ?? []), { name: "", stages: [] }] }))}>
            <Plus /> Add staff member
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetEditor({ content, model, update }: { content: ReportContent; model: ReportModel; update: Update }) {
  const rows = content.budget ?? [];
  const setRow = (i: number, patch: (r: (typeof rows)[number]) => (typeof rows)[number]) =>
    update((c) => ({ ...c, budget: (c.budget ?? []).map((r, j) => (j === i ? patch(r) : r)) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses (USD)</CardTitle>
        <CardDescription>One line per type of expense, with the amount spent in each stage. Totals and percentages are calculated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Expense</th>
                  {STAGES.map((s) => (
                    <th key={s.key} className="px-1 py-1 font-medium">
                      {s.label}
                    </th>
                  ))}
                  <th className="px-1 py-1 text-right font-medium">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <Input value={r.item} onChange={(e) => setRow(i, (x) => ({ ...x, item: e.target.value }))} maxLength={80} aria-label="Expense" />
                    </td>
                    {STAGES.map((s) => (
                      <td key={s.key} className="px-1 py-1">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={r.amounts[s.key] ?? ""}
                          aria-label={`${r.item} — ${s.label}`}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            setRow(i, (x) => ({ ...x, amounts: { ...x.amounts, [s.key]: v != null && Number.isFinite(v) ? v : null } }));
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1 text-right font-medium whitespace-nowrap tabular-nums">
                      {usd(STAGES.reduce((a, s) => a + (Number(r.amounts[s.key]) || 0), 0))}
                    </td>
                    <td className="py-1 pl-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => update((c) => ({ ...c, budget: (c.budget ?? []).filter((_, j) => j !== i) }))}>
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2">Grand total</td>
                  {STAGES.map((s) => (
                    <td key={s.key} className="px-3 py-2 tabular-nums">
                      {model.budget.totals[s.key] ? usd(model.budget.totals[s.key]) : ""}
                    </td>
                  ))}
                  <td className="px-1 py-2 text-right tabular-nums">{usd(model.budget.grand)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => update((c) => ({ ...c, budget: [...(c.budget ?? []), { item: "", amounts: {} }] }))}>
            <Plus /> Add line
          </Button>
          {rows.length === 0 && (
            <Button variant="ghost" size="sm" onClick={() => update((c) => ({ ...c, budget: DEFAULT_BUDGET_ITEMS.map((item) => ({ item, amounts: {} })) }))}>
              Start with the usual lines
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewsEditor({ content, update }: { content: ReportContent; update: Update }) {
  return (
    <>
      {STAGES.map((s) => {
        const r = content.reviews?.[s.key] ?? {};
        const set = (k: "strengths" | "challenges" | "recommendations") => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
          update((c) => ({ ...c, reviews: { ...c.reviews, [s.key]: { ...c.reviews?.[s.key], [k]: e.target.value } } }));
        return (
          <Card key={s.key}>
            <CardHeader>
              <CardTitle>{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Strengths observed">
                <Textarea rows={3} value={r.strengths ?? ""} onChange={set("strengths")} maxLength={3000} />
              </Field>
              <Field label="Challenges noted">
                <Textarea rows={3} value={r.challenges ?? ""} onChange={set("challenges")} maxLength={3000} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Recommendations" hint="One recommendation per line — printed as a list.">
                  <Textarea rows={4} value={r.recommendations ?? ""} onChange={set("recommendations")} maxLength={4000} />
                </Field>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
