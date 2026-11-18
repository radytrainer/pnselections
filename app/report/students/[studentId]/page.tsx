"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { differenceInYears, format } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Download, FileText, ImagePlus, Loader2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentAvatar } from "@/components/students/StudentAvatar";
import { buildSections, buildVac, type Need, type Row } from "@/components/committee/SocialFormSummary";
import { useAuth } from "@/hooks/useAuth";
import { displayStudentStatus } from "@/lib/constants";
import { getSignedStudentDocumentUrl, pickLatestPhotoPath } from "@/lib/storage";
import { fetchReportImage, toReportImage, type ReportImage } from "./reportImages";
import type { ReportModel, ReportRating, ReportRow } from "./reportDocx";
import {
  CATEGORY_LABELS,
  isFailedHomeVisit,
  VAC_TIER_LABELS,
  type SocialFormCategory,
} from "@/features/social-form/scoring";
import { getStudent, type StudentDetail } from "@/services/studentService";
import { listCycles } from "@/services/lookupService";
import { getNgo } from "@/services/ngoService";
import type { SocialAssessmentRow } from "@/services/committeeService";

/**
 * Printable A4 home-visit report for one student, built from the latest
 * Social Form. Opened from the Students page ⋯ menu in a new tab with
 * ?print=1, which brings up the browser's print dialog — "Save as PDF"
 * gives the downloadable report. Rendering in the browser (not a PDF
 * library) keeps Khmer text in names/comments displaying correctly.
 */

const GENDER: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };
const RATING: Record<Need, { label: string; icon: LucideIcon; text: string; dot: string }> = {
  high: { label: "Concern", icon: AlertTriangle, text: "text-rose-700", dot: "bg-rose-600" },
  medium: { label: "Watch", icon: AlertCircle, text: "text-amber-700", dot: "bg-amber-500" },
  low: { label: "OK", icon: CheckCircle2, text: "text-emerald-700", dot: "bg-emerald-600" },
};

type Data = { student: StudentDetail; cycleName: string | null; ngoName: string | null };
/** One of the 4 photo slots before the signatures. */
type Photo = { image: ReportImage; caption: string } | null;
const RATING_WORD: Record<Need, ReportRating> = { high: "Concern", medium: "Watch", low: "OK" };

export default function StudentReportPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setError("Please sign in to view this report.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const student = await getStudent(studentId);
        const [cycles, ngo] = await Promise.all([
          listCycles().catch(() => []),
          student.referred_by_ngo_id ? getNgo(student.referred_by_ngo_id).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setData({
          student,
          cycleName: cycles.find((c) => c.id === student.cycle_id)?.name ?? null,
          ngoName: (ngo as { organization_name?: string } | null)?.organization_name ?? null,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load the report");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, user, authLoading]);

  const visit = useMemo(() => {
    const visits = data?.student.social_assessments ?? [];
    return visits.length ? [...visits].sort((a, b) => b.visit_number - a.visit_number)[0] : null;
  }, [data]);

  const fullName = data ? `${data.student.first_name} ${data.student.last_name}` : "";

  // Title becomes the default PDF file name in "Save as PDF".
  useEffect(() => {
    if (!data) return;
    const prev = document.title;
    document.title = `Home Visit Report - ${fullName} (${data.student.student_code})`;
    return () => {
      document.title = prev;
    };
  }, [data, fullName]);

  // Opened from the ⋯ menu: show the print dialog once the photo/logo have loaded.
  useEffect(() => {
    if (!data || new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [data]);

  // Photos added for this report (kept in the browser only, not saved).
  const [photos, setPhotos] = useState<Photo[]>([null, null, null, null]);
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => p && URL.revokeObjectURL(p.image.url)), []);
  const [wordBusy, setWordBusy] = useState(false);

  async function downloadWord() {
    if (!data) return;
    setWordBusy(true);
    try {
      const photoPath = pickLatestPhotoPath(data.student.student_documents);
      const url = photoPath ? await getSignedStudentDocumentUrl(photoPath) : null;
      const studentPhoto = url ? await fetchReportImage(url, 600) : null;
      const { downloadStudentReportDocx } = await import("./reportDocx");
      await downloadStudentReportDocx(buildReportModel(data, visit, fullName, photos, studentPhoto));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the Word file");
    } finally {
      setWordBusy(false);
    }
  }

  // Repeated in the bottom margin of every printed page (CSS @page margin boxes).
  const pageFooter = data
    ? `Home Visit Report · ${fullName} (${data.student.student_code}) · Confidential`.replace(/["\\]/g, "")
    : "Home Visit Report";

  return (
    <div className="report-root min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page {
          size: A4;
          margin: 14mm 14mm 16mm;
          @bottom-left { content: "${pageFooter}"; font: 7.5pt system-ui, sans-serif; color: #64748b; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt system-ui, sans-serif; color: #64748b; }
        }
        @media print {
          html, body { background: #fff !important; }
          .report-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      {/* Screen toolbar */}
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 sm:px-0">
        <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to students
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground lg:inline">For PDF, choose “Save as PDF” in the print window.</span>
          <Button variant="outline" onClick={downloadWord} disabled={!data || wordBusy}>
            {wordBusy ? <Loader2 className="animate-spin" /> : <FileText />} Download Word
          </Button>
          <Button onClick={() => window.print()} disabled={!data}>
            <Download /> Download PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto w-full max-w-[210mm] bg-white px-[12mm] py-[12mm] text-[10.5pt] leading-snug text-slate-900 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {error ? (
          <p className="py-20 text-center text-sm text-rose-700">{error}</p>
        ) : !data ? (
          <p className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Preparing report…
          </p>
        ) : (
          <ReportBody data={data} visit={visit} fullName={fullName} photos={photos} onPhotos={setPhotos} />
        )}
      </article>
    </div>
  );
}

function ReportBody({
  data,
  visit,
  fullName,
  photos,
  onPhotos,
}: {
  data: Data;
  visit: SocialAssessmentRow | null;
  fullName: string;
  photos: Photo[];
  onPhotos: (next: Photo[]) => void;
}) {
  const s = data.student;
  const age = s.dob ? differenceInYears(new Date(), new Date(s.dob)) : (visit?.age ?? null);
  const address = [s.village_name, s.commune_name, s.district_name, s.provinces?.name_en].filter(Boolean).join(", ");
  const generated = format(new Date(), "d MMMM yyyy");

  return (
    <>
      {/* Letterhead */}
      <header className="flex items-end justify-between gap-6 border-b-2 border-[#00427a] pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/pn-logo.png" alt="Passerelles Numériques — A Gateway for Life" className="h-[17mm] w-auto" />
        <div className="text-right">
          <h1 className="text-[17pt] font-semibold tracking-tight text-[#00427a]">Home Visit Report</h1>
          <p className="text-[9pt] text-slate-600">Social Form assessment{data.cycleName ? ` · ${data.cycleName}` : ""}</p>
          <p className="text-[8.5pt] text-slate-500">Generated {generated}</p>
        </div>
      </header>

      {/* Student */}
      <section className="avoid-break mt-5 flex gap-5">
        <StudentAvatar
          photoPath={pickLatestPhotoPath(s.student_documents)}
          initials={`${s.first_name[0] ?? ""}${s.last_name[0] ?? ""}`.toUpperCase()}
          shape="square"
          size="h-[34mm] w-[28mm]"
          displayWidth={220}
          className="rounded-md border border-slate-200 text-[18pt]"
          alt={fullName}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16pt] leading-tight font-semibold">{fullName}</h2>
          <p className="font-mono text-[9pt] text-slate-500">{s.student_code}</p>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[9.5pt]">
            <Field label="Gender" value={GENDER[s.gender] ?? s.gender} />
            <Field label="Age" value={age != null ? `${age} years${s.dob ? ` (born ${format(new Date(s.dob), "d MMM yyyy")})` : ""}` : null} />
            <Field label="Address" value={address} wide />
            <Field label="School" value={s.school_partners?.school_name} />
            <Field label="Referred by" value={data.ngoName} />
            <Field label="Current status" value={displayStudentStatus(s.status, s.elimination_reason).replace(/_/g, " ")} capitalize />
          </dl>
        </div>
      </section>

      {!visit ? (
        <p className="mt-8 rounded-md border border-dashed p-6 text-center text-slate-500">No home visit (Social Form) has been recorded for this student yet.</p>
      ) : (
        <VisitReport visit={visit} visitCount={s.social_assessments.length} />
      )}

      {/* Photos, then sign-off */}
      <PhotoSection photos={photos} onChange={onPhotos} />
      <section className="avoid-break mt-10 grid grid-cols-3 gap-8 text-[9pt]">
        <Signature label="Home visitor" name={visit?.visitor_name} />
        <Signature label="Reviewed by (Selection committee)" />
        <Signature label="Date" />
      </section>

      {/* Footer */}
      <footer className="mt-8 border-t pt-2 text-[7.5pt] text-slate-500">
        Confidential — for Passerelles Numériques selection committee use only. Generated by the Scholarship Selection Tracker on {generated}.
      </footer>
    </>
  );
}

function VisitReport({ visit, visitCount }: { visit: SocialAssessmentRow; visitCount: number }) {
  const category = visit.category as SocialFormCategory;
  const failed = isFailedHomeVisit(visit.final_score ?? 0, visit.manual_failed);
  const vac = buildVac(visit);
  const sections = buildSections(visit).filter((sec) => sec.rows.length > 0);

  const all: (Row & { section: string })[] = [
    ...vac.rows.map((r) => ({ ...r, section: "Vulnerability Checklist" })),
    ...sections.flatMap((sec) => sec.rows.map((r) => ({ ...r, section: sec.title }))),
  ];
  const concerns = all.filter((r) => r.need === "high");
  const watch = all.filter((r) => r.need === "medium");
  const strengths = all.filter((r) => r.need === "low");

  return (
    <>
      {/* Visit */}
      <p className="mt-5 rounded-md bg-slate-50 px-3 py-2 text-[9pt] text-slate-700">
        <span className="font-medium text-slate-900">Home visit #{visit.visit_number}</span>
        {visitCount > 1 ? ` (latest of ${visitCount})` : ""}
        {visit.visit_date ? ` · ${format(new Date(visit.visit_date), "d MMMM yyyy")}` : ""}
        {visit.visitor_name ? ` · Visited by ${visit.visitor_name}` : ""}
      </p>

      {/* Summary */}
      <section className="avoid-break mt-4">
        <SectionHeading>Summary</SectionHeading>
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Poverty score"
            value={String(visit.final_score ?? "—")}
            note={failed ? "Failed home visit" : CATEGORY_LABELS[category]}
            hint="Lower score = poorer household"
          />
          <Stat
            label="Vulnerability checklist"
            value={visit.vac_total_score != null ? `${visit.vac_total_score}/36` : "—"}
            note={vac.tier ? VAC_TIER_LABELS[vac.tier] : "Not recorded"}
            hint={vac.answered < vac.total ? `Only ${vac.answered} of ${vac.total} items answered` : "Lower score = more vulnerable"}
            warn={vac.answered < vac.total}
          />
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-[8pt] font-medium tracking-wide text-slate-500 uppercase">Assessment</p>
            <ul className="mt-1.5 space-y-0.5 text-[9.5pt]">
              <li className="flex items-center justify-between"><RatingLabel need="high" /> <span className="tabular-nums">{concerns.length}</span></li>
              <li className="flex items-center justify-between"><RatingLabel need="medium" /> <span className="tabular-nums">{watch.length}</span></li>
              <li className="flex items-center justify-between"><RatingLabel need="low" /> <span className="tabular-nums">{strengths.length}</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* Key findings */}
      {(concerns.length > 0 || strengths.length > 0) && (
        <section className="avoid-break mt-5 grid grid-cols-2 gap-4">
          <FindingList need="high" title="Key concerns" items={concerns} />
          <FindingList need="low" title="Strengths" items={strengths} />
        </section>
      )}

      {/* Detailed findings */}
      <section className="mt-6">
        <SectionHeading>Detailed findings</SectionHeading>
        <div className="space-y-4">
          {vac.rows.length > 0 && <FindingsTable title="Vulnerability Checklist" rows={vac.rows} />}
          {sections.map((sec) => (
            <FindingsTable key={sec.title} title={sec.title} rows={sec.rows} />
          ))}
        </div>
      </section>

      {/* Visitor notes */}
      {(visit.poverty_certificate || visit.distance_from_town || visit.visitor_comments) && (
        <section className="avoid-break mt-6">
          <SectionHeading>Home visitor&apos;s notes</SectionHeading>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[9.5pt]">
            <Field label="Poverty certificate" value={visit.poverty_certificate} />
            <Field label="Distance from town" value={visit.distance_from_town} />
          </dl>
          {visit.visitor_comments && (
            <blockquote className="mt-2.5 border-l-[3px] border-[#00427a] bg-slate-50 px-3 py-2 text-[10pt] whitespace-pre-line">
              {visit.visitor_comments}
            </blockquote>
          )}
        </section>
      )}

    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11.5pt] font-semibold text-[#00427a]">{children}</h3>;
}

function Field({ label, value, wide, capitalize }: { label: string; value: string | null | undefined; wide?: boolean; capitalize?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="inline text-slate-500">{label}: </dt>
      <dd className={`inline ${capitalize ? "capitalize" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Stat({ label, value, note, hint, warn }: { label: string; value: string; note: string; hint: string; warn?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-[8pt] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-0.5 text-[18pt] leading-none font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[9.5pt] font-medium">{note}</p>
      <p className={`mt-0.5 text-[8pt] ${warn ? "text-amber-700" : "text-slate-500"}`}>{hint}</p>
    </div>
  );
}

function RatingLabel({ need }: { need: Need }) {
  const r = RATING[need];
  return (
    <span className={`inline-flex items-center gap-1.5 ${r.text}`}>
      <r.icon className="size-3.5" />
      {r.label === "OK" ? "OK / strength" : r.label === "Watch" ? "To watch" : "Concerns"}
    </span>
  );
}

function FindingList({ need, title, items }: { need: Need; title: string; items: (Row & { section: string })[] }) {
  const r = RATING[need];
  return (
    <div className="rounded-md border border-slate-200">
      <p className={`flex items-center gap-1.5 border-b px-3 py-1.5 text-[9.5pt] font-medium ${r.text}`}>
        <r.icon className="size-3.5" /> {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-[9pt] text-slate-500">None recorded</p>
      ) : (
        <ul className="divide-y text-[9pt]">
          {items.map((i) => (
            <li key={`${i.section}-${i.label}`} className="px-3 py-1">
              <span className="font-medium">{i.label}:</span> {i.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FindingsTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <table className="avoid-break w-full border-collapse text-[9.5pt]">
      <caption className="mb-1 text-left text-[10pt] font-medium">{title}</caption>
      <thead>
        <tr className="bg-slate-100 text-left text-[8pt] tracking-wide text-slate-600 uppercase">
          <th className="w-[34%] px-2.5 py-1.5 font-medium">Item</th>
          <th className="px-2.5 py-1.5 font-medium">Finding</th>
          <th className="w-[16%] px-2.5 py-1.5 font-medium">Rating</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-slate-200 align-top">
            <td className="px-2.5 py-1.5 text-slate-600">{r.label}</td>
            <td className="px-2.5 py-1.5">
              <span className={r.noteOnly ? "italic text-slate-700" : undefined}>{r.value}</span>
              {r.note && <span className="mt-0.5 block text-[0.92em] text-slate-600 italic">Note: {r.note}</span>}
            </td>
            <td className="px-2.5 py-1.5">
              {r.need ? (
                <span className={`inline-flex items-center gap-1.5 ${RATING[r.need].text}`}>
                  <span className={`size-2 rounded-full ${RATING[r.need].dot}`} aria-hidden />
                  {RATING[r.need].label}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Signature({ label, name }: { label: string; name?: string | null }) {
  return (
    <div>
      <div className="h-10 border-b border-slate-400" />
      <p className="mt-1 text-slate-600">{label}</p>
      {name && <p className="text-slate-900">{name}</p>}
    </div>
  );
}

/**
 * Four photo slots (2 × 2) before the signatures. On screen each empty slot
 * opens the file picker; "Add photos" fills several at once. Empty slots print
 * as framed space, so a photo can be stuck on paper or pasted in Word later.
 * Photos stay in this browser tab — they're not saved anywhere.
 */
function PhotoSection({ photos, onChange }: { photos: Photo[]; onChange: (next: Photo[]) => void }) {
  const multiRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const filled = photos.filter(Boolean).length;

  async function add(files: FileList | null, slot?: number) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...photos];
      const free = slot != null ? [slot] : next.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
      const list = Array.from(files).slice(0, free.length);
      for (const [k, file] of list.entries()) {
        next[free[k]] = { image: await toReportImage(file), caption: "" };
      }
      if (files.length > list.length) toast.info(`Only ${list.length} more photo${list.length === 1 ? "" : "s"} fit (4 in total).`);
      onChange(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that image");
    } finally {
      setBusy(false);
    }
  }

  function remove(i: number) {
    const p = photos[i];
    if (p) URL.revokeObjectURL(p.image.url);
    onChange(photos.map((x, j) => (j === i ? null : x)));
  }

  return (
    <section className="avoid-break mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <SectionHeading>Photos</SectionHeading>
        <div className="no-print flex items-center gap-2">
          <span className="text-xs text-slate-500">Up to 4 photos · used for this download only, not saved</span>
          <input ref={multiRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files).finally(() => (e.target.value = ""))} />
          <Button variant="outline" size="sm" disabled={busy || filled >= 4} onClick={() => multiRef.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} Add photos
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <figure key={i} className="avoid-break">
            {p ? (
              <div className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image.url} alt={p.caption || `Photo ${i + 1}`} className="h-[58mm] w-full rounded-md border border-slate-200 bg-slate-50 object-contain" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="no-print absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-[58mm] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-300 text-[9pt] text-slate-400 print:cursor-default">
                <ImagePlus className="no-print size-6" />
                <span className="no-print">Add photo</span>
                <span className="hidden print:inline">Photo</span>
                <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => add(e.target.files, i).finally(() => (e.target.value = ""))} />
              </label>
            )}
            {p && (
              <>
                <input
                  aria-label={`Caption for photo ${i + 1}`}
                  placeholder="Caption (optional), e.g. Front of the house"
                  value={p.caption}
                  onChange={(e) => onChange(photos.map((x, j) => (j === i && x ? { ...x, caption: e.target.value } : x)))}
                  className="no-print mt-1 w-full rounded border border-slate-200 px-2 py-1 text-[9pt]"
                  maxLength={120}
                />
                {p.caption && <figcaption className="mt-1 hidden text-center text-[8.5pt] text-slate-600 print:block">{p.caption}</figcaption>}
              </>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Everything the Word file needs, in the same order and wording as the page. */
function buildReportModel(data: Data, visit: SocialAssessmentRow | null, fullName: string, photos: Photo[], studentPhoto: ReportImage | null): ReportModel {
  const s = data.student;
  const age = s.dob ? differenceInYears(new Date(), new Date(s.dob)) : (visit?.age ?? null);
  const address = [s.village_name, s.commune_name, s.district_name, s.provinces?.name_en].filter(Boolean).join(", ");
  const generated = format(new Date(), "d MMMM yyyy");
  const row = (r: Row): ReportRow => ({
    label: r.label,
    value: r.value,
    note: r.note,
    rating: r.need ? RATING_WORD[r.need] : undefined,
  });

  let visitModel: ReportModel["visit"] = null;
  if (visit) {
    const category = visit.category as SocialFormCategory;
    const failed = isFailedHomeVisit(visit.final_score ?? 0, visit.manual_failed);
    const vac = buildVac(visit);
    const sections = buildSections(visit).filter((sec) => sec.rows.length > 0);
    const all = [...vac.rows, ...sections.flatMap((sec) => sec.rows)];
    visitModel = {
      line: [
        `Home visit #${visit.visit_number}${s.social_assessments.length > 1 ? ` (latest of ${s.social_assessments.length})` : ""}`,
        visit.visit_date ? format(new Date(visit.visit_date), "d MMMM yyyy") : "",
        visit.visitor_name ? `Visited by ${visit.visitor_name}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      stats: [
        { label: "Poverty score", value: String(visit.final_score ?? "—"), note: failed ? "Failed home visit" : CATEGORY_LABELS[category], hint: "Lower score = poorer household" },
        {
          label: "Vulnerability checklist",
          value: visit.vac_total_score != null ? `${visit.vac_total_score}/36` : "—",
          note: vac.tier ? VAC_TIER_LABELS[vac.tier] : "Not recorded",
          hint: vac.answered < vac.total ? `Only ${vac.answered} of ${vac.total} items answered` : "Lower score = more vulnerable",
        },
      ],
      counts: {
        concerns: all.filter((r) => r.need === "high").length,
        watch: all.filter((r) => r.need === "medium").length,
        ok: all.filter((r) => r.need === "low").length,
      },
      concerns: all.filter((r) => r.need === "high").map(row),
      strengths: all.filter((r) => r.need === "low").map(row),
      sections: [...(vac.rows.length ? [{ title: "Vulnerability Checklist", rows: vac.rows.map(row) }] : []), ...sections.map((sec) => ({ title: sec.title, rows: sec.rows.map(row) }))],
      facts: [
        { label: "Poverty certificate", value: visit.poverty_certificate ?? "" },
        { label: "Distance from town", value: visit.distance_from_town ?? "" },
      ].filter((f) => f.value),
      comments: visit.visitor_comments?.trim() || null,
      visitorName: visit.visitor_name ?? null,
    };
  }

  return {
    fileName: `Home Visit Report - ${fullName} (${s.student_code})`,
    cycleName: data.cycleName,
    generated,
    student: {
      name: fullName,
      code: s.student_code,
      photo: studentPhoto,
      fields: [
        { label: "Gender", value: GENDER[s.gender] ?? s.gender },
        { label: "Age", value: age != null ? `${age} years${s.dob ? ` (born ${format(new Date(s.dob), "d MMM yyyy")})` : ""}` : "" },
        { label: "Address", value: address },
        { label: "School", value: s.school_partners?.school_name ?? "" },
        { label: "Referred by", value: data.ngoName ?? "" },
        { label: "Current status", value: displayStudentStatus(s.status, s.elimination_reason).replace(/_/g, " ") },
      ],
    },
    visit: visitModel,
    photos,
  };
}
