"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { Camera, CheckCircle2, FileText, Loader2, Lock, Paperclip, Pencil, TimerOff, Trash2, Upload } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/storage";
import {
  cleanAnswers,
  DECLARATION,
  DOCUMENTS_TO_ATTACH,
  isShown,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  missingRequired,
  SECTIONS,
  type Answers,
  type Field,
} from "@/features/scholarship-application/form";
import {
  getPublicApplication,
  publicApplicationFileUrl,
  removePublicApplicationFile,
  submitPublicApplication,
  uploadPublicApplicationFile,
  type PublicApplication,
  type PublicApplicationFile,
} from "@/services/applicationService";

/**
 * Public scholarship application form (migration 0068), one link per student,
 * opened from the link or QR code staff give after the interview — no login.
 * Khmer + English labels, following the paper form ពាក្យស្នើរសុំអាហារូបករណ៍.
 */

const KM = { fontFamily: "var(--font-battambang)" } as const;

const REASONS: Record<string, string> = {
  closed: "This form is closed. · ទម្រង់នេះត្រូវបានបិទ។",
  expired: "This link has expired. · តំណនេះផុតកំណត់ហើយ។",
  not_found: "This link doesn't exist. · រកមិនឃើញតំណនេះទេ។",
  bad_data: "Some answers couldn't be saved. Please check the form. · សូមពិនិត្យទម្រង់ម្តងទៀត។",
  bad_file: "Please choose a JPG, PNG or WebP image (or a PDF for documents). · សូមជ្រើសរើសរូបភាព JPG, PNG ឬ PDF។",
  file_too_large: "That file is too big (max 5 MB). · ឯកសារធំពេក (អតិបរមា 5 MB)។",
  too_many_files: `You can attach at most ${MAX_ATTACHMENTS} files. Remove one first. · អាចភ្ជាប់បានត្រឹម ${MAX_ATTACHMENTS} ឯកសារ។`,
  too_many: "Too many tries from this device. Please wait a few minutes. · សូមរង់ចាំបន្តិច។",
  photo_required: "Please upload your photo (4×6). · សូមបញ្ចូលរូបថត ៤×៦។",
  declaration: "Please tick the declaration at the end of the form. · សូមធីកការធានានៅខាងចុង។",
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex justify-center">
          <Logo />
        </div>
        {children}
        <p className="text-center text-xs text-muted-foreground">Passerelles Numériques Cambodia · Scholarship selection</p>
      </div>
    </main>
  );
}

function Notice({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">{icon}</div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground" style={KM}>
        {text}
      </p>
    </div>
  );
}

function FieldLabel({ f, htmlFor, as = "label" }: { f: Pick<Field, "km" | "en" | "required">; htmlFor?: string; as?: "label" | "legend" }) {
  const content = (
    <>
      <span style={KM}>{f.km}</span> <span className="text-muted-foreground">· {f.en}</span>
      {f.required && <span className="ml-0.5 text-rose-600">*</span>}
    </>
  );
  return as === "legend" ? (
    <legend className="mb-1.5 text-sm font-medium">{content}</legend>
  ) : (
    <label htmlFor={htmlFor} className="block text-sm font-medium">
      {content}
    </label>
  );
}

function Choice({ type, name, checked, onChange, km, en }: { type: "radio" | "checkbox"; name: string; checked: boolean; onChange: () => void; km: string; en: string }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors",
        checked ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted",
      )}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-primary" />
      <span className="leading-tight">
        <span style={KM}>{km}</span>
        <span className="block text-xs font-normal text-muted-foreground">{en}</span>
      </span>
    </label>
  );
}

function FieldInput({ f, value, set }: { f: Field; value: Answers[string] | undefined; set: (v: Answers[string]) => void }) {
  const id = `f-${f.key}`;
  if (f.type === "radio" || f.type === "checks") {
    const list = Array.isArray(value) ? value : [];
    const toggle = (v: string) => {
      if (f.type === "radio") return set(v);
      // "None" excludes the other choices (and the other way round).
      if (v === "none") return set(list.includes("none") ? [] : ["none"]);
      const next = list.includes(v) ? list.filter((x) => x !== v) : [...list.filter((x) => x !== "none"), v];
      set(next);
    };
    return (
      <fieldset className="space-y-1.5">
        <FieldLabel f={f} as="legend" />
        <div className={cn("grid gap-2", (f.options?.length ?? 0) > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {f.options!.map((o) => (
            <Choice
              key={o.value}
              type={f.type === "radio" ? "radio" : "checkbox"}
              name={f.key}
              checked={f.type === "radio" ? value === o.value : list.includes(o.value)}
              onChange={() => toggle(o.value)}
              km={o.km}
              en={o.en}
            />
          ))}
        </div>
      </fieldset>
    );
  }
  const str = typeof value === "string" ? value : "";
  return (
    <div className="space-y-1.5">
      <FieldLabel f={f} htmlFor={id} />
      {f.type === "textarea" ? (
        <Textarea id={id} value={str} onChange={(e) => set(e.target.value)} maxLength={f.max} rows={3} placeholder={f.placeholder} />
      ) : (
        <Input
          id={id}
          type={f.type === "tel" ? "tel" : f.type === "date" ? "date" : "text"}
          inputMode={f.type === "number" ? "numeric" : f.type === "tel" ? "tel" : undefined}
          value={str}
          onChange={(e) => set(f.type === "number" ? e.target.value.replace(/[^\d]/g, "") : e.target.value)}
          maxLength={f.type === "date" ? undefined : f.max}
          placeholder={f.placeholder}
          className="h-10"
        />
      )}
    </div>
  );
}

/** First answers: the saved ones, or what the school already knows about the student. */
function initialAnswers(app: Extract<PublicApplication, { status: "open" }>): Answers {
  if (app.data && Object.keys(app.data).length > 0) return app.data;
  const s = app.student;
  return {
    name_latin: `${s.first_name} ${s.last_name}`.trim(),
    dob: s.dob?.slice(0, 10) ?? "",
    gender: s.gender === "male" || s.gender === "female" ? s.gender : s.gender ? "other" : "",
    phone: s.phone ?? "",
  };
}

const draftKey = (token: string) => `apply-draft:${token}`;

function ageFrom(dob: string): number | null {
  const d = new Date(dob + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export default function ApplyPage() {
  const { token } = useParams<{ token: string }>();
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [files, setFiles] = useState<PublicApplicationFile[]>([]);
  const [uploading, setUploading] = useState<"photo" | "file" | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPublicApplication(token)
      .then((a) => {
        setApp(a);
        if (a.status !== "open") return;
        let start = initialAnswers(a);
        // Unsent changes on this device (e.g. the page was closed mid-way) win over the saved copy.
        try {
          const draft = localStorage.getItem(draftKey(token));
          if (draft) start = { ...start, ...JSON.parse(draft) };
        } catch {}
        setAnswers(start);
        setFiles(a.files);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load the form"));
  }, [token]);

  const set = (key: string) => (v: Answers[string]) => {
    setAnswers((a) => {
      const next = { ...a, [key]: v };
      try {
        localStorage.setItem(draftKey(token), JSON.stringify(next));
      } catch {}
      return next;
    });
    setError(null);
  };

  const photo = files.find((f) => f.kind === "photo") ?? null;
  const attachments = files.filter((f) => f.kind === "file");
  const age = typeof answers.dob === "string" && answers.dob ? ageFrom(answers.dob) : null;
  const missing = useMemo(() => missingRequired(answers), [answers]);

  async function upload(kind: "photo" | "file", picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    setError(null);
    const list = Array.from(picked).slice(0, kind === "photo" ? 1 : MAX_ATTACHMENTS - attachments.length);
    if (kind === "file" && list.length === 0) return setError(REASONS.too_many_files);
    setUploading(kind);
    try {
      for (const original of list) {
        const file = original.type.startsWith("image/") ? await compressImageFile(original, MAX_FILE_BYTES) : original;
        if (file.size > MAX_FILE_BYTES) {
          setError(REASONS.file_too_large);
          continue;
        }
        const r = await uploadPublicApplicationFile(token, kind, file);
        if (!r.ok) {
          setError(REASONS[r.reason ?? ""] ?? "Upload failed. Please try again.");
          if (r.reason === "closed" || r.reason === "expired" || r.reason === "not_found") setApp({ status: r.reason });
          break;
        }
        const added: PublicApplicationFile = { id: r.id!, kind, name: original.name, uploaded_at: new Date().toISOString() };
        setFiles((fs) => (kind === "photo" ? [...fs.filter((f) => f.kind !== "photo"), added] : [...fs, added]));
        if (kind === "photo") setPhotoVersion((v) => v + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(null);
      if (photoInput.current) photoInput.current.value = "";
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(id: string) {
    try {
      const r = await removePublicApplicationFile(token, id);
      if (r.ok) setFiles((fs) => fs.filter((f) => f.id !== id));
      else setError(REASONS[r.reason ?? ""] ?? "Couldn't remove the file.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the file.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (missing.length > 0) {
      const first = missing[0];
      document.getElementById(`f-${first.key}`)?.focus();
      return setError(`Please fill in: ${missing.map((f) => f.en).join(", ")} · សូមបំពេញ៖ ${missing.map((f) => f.km).join(", ")}`);
    }
    if (!photo) return setError(REASONS.photo_required);
    if (answers[DECLARATION.key] !== true) return setError(REASONS.declaration);
    setSending(true);
    try {
      const r = await submitPublicApplication(token, cleanAnswers(answers));
      if (r.ok) {
        try {
          localStorage.removeItem(draftKey(token));
        } catch {}
        setDone(true);
        window.scrollTo({ top: 0 });
      } else if (r.reason === "closed" || r.reason === "expired" || r.reason === "not_found") {
        setApp({ status: r.reason });
      } else {
        setError(REASONS[r.reason ?? ""] ?? "Something went wrong. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loadError) return <Shell><Notice icon={<TimerOff className="size-6 text-muted-foreground" />} title="Couldn't load the form" text={loadError} /></Shell>;
  if (!app)
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  if (app.status === "not_found") return <Shell><Notice icon={<Lock className="size-6 text-muted-foreground" />} title="Link not found" text={REASONS.not_found} /></Shell>;
  if (app.status === "closed") return <Shell><Notice icon={<Lock className="size-6 text-muted-foreground" />} title="Form closed" text={REASONS.closed} /></Shell>;
  if (app.status === "expired") return <Shell><Notice icon={<TimerOff className="size-6 text-muted-foreground" />} title="Link expired" text={REASONS.expired} /></Shell>;

  const name = typeof answers.name_latin === "string" && answers.name_latin.trim() ? answers.name_latin.trim() : `${app.student.first_name} ${app.student.last_name}`;

  if (done) {
    return (
      <Shell>
        <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
            <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-lg font-semibold">Thank you, {name}!</h1>
          <p className="mt-1 text-sm text-muted-foreground" style={KM}>
            អរគុណ! ពាក្យស្នើរសុំរបស់អ្នកត្រូវបានបញ្ជូនដោយជោគជ័យ។
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Your application has been sent. We will contact you about the next steps.</p>
          <Button variant="outline" className="mt-5" onClick={() => setDone(false)}>
            <Pencil /> Change my answers · កែប្រែ
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-semibold" style={KM}>
                ពាក្យស្នើរសុំអាហារូបករណ៍
              </h1>
              <p className="text-sm text-muted-foreground">Scholarship application form</p>
              <p className="mt-1 text-sm">
                <span style={KM}>ឆ្នាំសិក្សា</span> · Academic year {app.academic_year}
              </p>
              <p className="mt-2 text-sm font-medium">
                {name} <span className="font-mono text-xs text-muted-foreground">{app.student.student_code}</span>
              </p>
            </div>
            {/* Photo 4x6 */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={uploading === "photo"}
                className={cn(
                  "relative flex h-36 w-24 items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary",
                  photo && "border-solid",
                )}
                aria-label={photo ? "Change photo" : "Upload photo"}
              >
                {uploading === "photo" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${publicApplicationFileUrl(token, photo.id)}?v=${photoVersion}`} alt="Your photo" className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 px-1 text-center text-xs">
                    <Camera className="size-5" />
                    <span style={KM}>រូបថត</span>4 × 6
                  </span>
                )}
              </button>
              <span className="text-xs text-muted-foreground">
                {photo ? "Tap to change" : "Photo"} <span className="text-rose-600">*</span>
              </span>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload("photo", e.target.files)} />
            </div>
          </div>
          {app.submitted_at && (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <span style={KM}>អ្នកបានបញ្ជូនរួចហើយ។ អ្នកអាចកែប្រែ ហើយបញ្ជូនម្តងទៀតបាន។</span>
              <br />
              Sent on {new Date(app.submitted_at).toLocaleString()}. You can change your answers and send again.
            </p>
          )}
        </div>

        {SECTIONS.map((section) => (
          <section key={section.id} className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-3">
              <h2 className="font-semibold" style={KM}>
                {section.km}
              </h2>
              <p className="text-xs text-muted-foreground">{section.en}</p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {section.note && (
                <p className="text-sm font-medium sm:col-span-2">
                  <span style={KM}>{section.note.km}</span> <span className="text-muted-foreground">· {section.note.en}</span>
                </p>
              )}
              {section.fields
                .filter((f) => isShown(f, answers))
                .map((f) => (
                  <div key={f.key} className={cn(!f.half && "sm:col-span-2")}>
                    <FieldInput f={f} value={answers[f.key]} set={set(f.key)} />
                    {f.key === "dob" && age !== null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span style={KM}>អាយុ</span> · Age {age}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        ))}

        {/* Part 6 — documents */}
        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold" style={KM}>
              ផ្នែក ៦៖ ឯកសារត្រូវភ្ជាប់
            </h2>
            <p className="text-xs text-muted-foreground">Part 6: Documents to attach — photos or PDF, up to {MAX_ATTACHMENTS} files, 5 MB each</p>
          </div>
          <div className="space-y-3 p-5">
            <ul className="space-y-1 text-sm">
              {DOCUMENTS_TO_ATTACH.map((d) => (
                <li key={d.value} className="flex gap-2">
                  <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span style={KM}>{d.km}</span> <span className="text-muted-foreground">· {d.en}</span>
                  </span>
                </li>
              ))}
            </ul>
            {attachments.length > 0 && (
              <ul className="divide-y rounded-md border">
                {attachments.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <a href={publicApplicationFileUrl(token, f.id)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                      {f.name || "File"}
                    </a>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${f.name ?? "file"}`} onClick={() => remove(f.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={uploading === "file" || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileInput.current?.click()}
            >
              {uploading === "file" ? <Loader2 className="animate-spin" /> : <Upload />}
              {attachments.length >= MAX_ATTACHMENTS ? `${MAX_ATTACHMENTS} files attached (maximum)` : `Attach files · ភ្ជាប់ឯកសារ (${attachments.length}/${MAX_ATTACHMENTS})`}
            </Button>
            <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => upload("file", e.target.files)} />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <label className="flex cursor-pointer gap-3 text-sm">
            <input
              type="checkbox"
              checked={answers[DECLARATION.key] === true}
              onChange={(e) => set(DECLARATION.key)(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              <span style={KM}>{DECLARATION.km}</span>
              <span className="mt-0.5 block text-muted-foreground">{DECLARATION.en}</span>
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" style={KM}>
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full text-base" disabled={sending || uploading !== null}>
            {sending && <Loader2 className="animate-spin" />}
            <span style={KM}>បញ្ជូន</span> · Submit
          </Button>
          {app.expires_at && (
            <p className="text-center text-xs text-muted-foreground">
              This form closes {new Date(app.expires_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </section>
      </form>
    </Shell>
  );
}

