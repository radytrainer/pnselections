"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Loader2, Lock, MapPin, TimerOff } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicForm, submitPublicRegistration, type PublicForm, type PublicRegistration } from "@/services/informationSessionService";
import { cn } from "@/lib/utils";
import { ageOn, dobLimits, formatKhmerMobile, khmerMobile, MAX_AGE, MIN_AGE } from "@/features/info-sessions/rules";

/**
 * Public self-registration form for an information session (migration 0061).
 * Opened from the session's link or QR code — no login. Khmer + English labels.
 */
const EMPTY: PublicRegistration = {
  firstName: "",
  lastName: "",
  gender: "",
  dob: "",
  phone: "",
  highSchool: "",
  grade: "",
  provinceId: "",
  examCenterId: "",
  website: "",
};

const REASONS: Record<string, string> = {
  closed: "Registration for this session is closed. · ការចុះឈ្មោះត្រូវបានបិទ។",
  expired: "This registration link has expired. · តំណនេះផុតកំណត់ហើយ។",
  not_found: "This registration link doesn't exist. · រកមិនឃើញតំណនេះទេ។",
  name_required: "Please enter your first and last name. · សូមបញ្ចូលនាមខ្លួន និងនាមត្រកូល។",
  gender_required: "Please choose your gender. · សូមជ្រើសរើសភេទ។",
  bad_dob: "Please check your date of birth. · សូមពិនិត្យថ្ងៃខែឆ្នាំកំណើត។",
  dob_required: "Please enter your date of birth. · សូមបញ្ចូលថ្ងៃខែឆ្នាំកំណើត។",
  age: `Only students aged ${MIN_AGE} to ${MAX_AGE} can register. · មានតែសិស្សអាយុពី ${MIN_AGE} ដល់ ${MAX_AGE} ឆ្នាំប៉ុណ្ណោះដែលអាចចុះឈ្មោះបាន។`,
  phone_required: "Please enter your phone number. · សូមបញ្ចូលលេខទូរស័ព្ទ។",
  bad_phone: "Please enter a Smart, Cellcard or Metfone number, e.g. 012 345 678. · សូមបញ្ចូលលេខទូរស័ព្ទ Smart, Cellcard ឬ Metfone។",
  center_required: "Please choose your exam center. · សូមជ្រើសរើសមណ្ឌលប្រឡង។",
  bad_choice: "Please choose again from the list. · សូមជ្រើសរើសម្តងទៀត។",
  too_many: "Too many registrations from this device. Please wait a few minutes. · សូមរង់ចាំបន្តិច។",
};

function Label({ htmlFor, en, km, required }: { htmlFor: string; en: string; km: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium">
      <span style={{ fontFamily: "var(--font-battambang)" }}>{km}</span> <span className="text-muted-foreground">· {en}</span>
      {required && <span className="ml-0.5 text-rose-600">*</span>}
    </label>
  );
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg space-y-4">
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
      <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: "var(--font-battambang)" }}>
        {text}
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<PublicRegistration>(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; already: boolean } | null>(null);

  useEffect(() => {
    getPublicForm(token)
      .then((f) => {
        setForm(f);
        if (f.status === "open") setValues((v) => ({ ...v, examCenterId: f.session.default_exam_center_id ?? "" }));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load the form"));
  }, [token]);

  const set = (k: keyof PublicRegistration) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.firstName.trim() || !values.lastName.trim()) return setError(REASONS.name_required);
    if (!values.gender) return setError(REASONS.gender_required);
    if (!values.dob) return setError(REASONS.dob_required);
    const age = ageOn(values.dob);
    if (age < MIN_AGE || age > MAX_AGE) return setError(REASONS.age);
    if (!values.phone.trim()) return setError(REASONS.phone_required);
    if (!khmerMobile(values.phone)) return setError(REASONS.bad_phone);
    if (form?.status === "open" && form.centers.length > 0 && !values.examCenterId) return setError(REASONS.center_required);
    setSending(true);
    try {
      const r = await submitPublicRegistration(token, values);
      if (r.ok) {
        setDone({ name: `${values.firstName.trim()} ${values.lastName.trim()}`, already: !!r.duplicate });
        window.scrollTo({ top: 0 });
      } else if (r.reason === "closed" || r.reason === "expired" || r.reason === "not_found") {
        const name = form?.status === "open" ? form.session.name : "";
        setForm(r.reason === "not_found" ? { status: "not_found" } : r.reason === "closed" ? { status: "closed", session: { name } } : { status: "expired", session: { name } });
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
  if (!form)
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  if (form.status === "not_found") return <Shell><Notice icon={<Lock className="size-6 text-muted-foreground" />} title="Link not found" text={REASONS.not_found} /></Shell>;
  if (form.status === "closed") return <Shell><Notice icon={<Lock className="size-6 text-muted-foreground" />} title={form.session.name || "Registration closed"} text={REASONS.closed} /></Shell>;
  if (form.status === "expired") return <Shell><Notice icon={<TimerOff className="size-6 text-muted-foreground" />} title={form.session.name || "Link expired"} text={REASONS.expired} /></Shell>;

  const s = form.session;
  const limits = dobLimits();
  const dobAge = values.dob ? ageOn(values.dob) : null;
  const phone = values.phone.trim() ? khmerMobile(values.phone) : null;
  // Only complain once enough digits are typed.
  const phoneBad = !phone && values.phone.replace(/\D/g, "").length >= 9;
  if (done) {
    return (
      <Shell>
        <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
            <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          {done.already ? (
            <>
              <h1 className="text-lg font-semibold">{done.name}, you are already registered</h1>
              <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: "var(--font-battambang)" }}>
                អ្នកបានចុះឈ្មោះរួចហើយ។ មិនចាំបាច់ចុះឈ្មោះម្តងទៀតទេ។
              </p>
              <p className="mt-2 text-sm text-muted-foreground">There is no need to register again. We will contact you about the exam.</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Thank you, {done.name}!</h1>
              <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: "var(--font-battambang)" }}>
                អរគុណ! ការចុះឈ្មោះរបស់អ្នកបានជោគជ័យ។
              </p>
              <p className="mt-2 text-sm text-muted-foreground">You are registered for {s.name}. We will contact you about the exam.</p>
            </>
          )}
          <Button
            className="mt-5 h-auto min-h-9 max-w-full py-2 whitespace-normal"
            variant="outline"
            onClick={() => {
              setDone(null);
              setValues({ ...EMPTY, examCenterId: s.default_exam_center_id ?? "" });
            }}
          >
            Register another student · ចុះឈ្មោះសិស្សម្នាក់ទៀត
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Information session · ការផ្សព្វផ្សាយ</p>
          <h1 className="mt-1 text-xl font-semibold">{s.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {s.date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
            {(s.venue || s.province) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {[s.venue, s.province].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm">
            <span style={{ fontFamily: "var(--font-battambang)" }}>សូមបំពេញព័ត៌មានខាងក្រោម ដើម្បីចុះឈ្មោះប្រឡងអាហារូបករណ៍។</span>{" "}
            <span className="text-muted-foreground">Fill in the form to register for the scholarship exam.</span>
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-first" km="នាមខ្លួន" en="First name" required />
              <Input id="r-first" autoComplete="given-name" value={values.firstName} onChange={set("firstName")} maxLength={100} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-last" km="នាមត្រកូល" en="Last name" required />
              <Input id="r-last" autoComplete="family-name" value={values.lastName} onChange={set("lastName")} maxLength={100} className="h-10" />
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              <span style={{ fontFamily: "var(--font-battambang)" }}>ភេទ</span> <span className="text-muted-foreground">· Gender</span>
              <span className="ml-0.5 text-rose-600">*</span>
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["female", "ស្រី", "Female"],
                ["male", "ប្រុស", "Male"],
                ["lgbtqia+", "ផ្សេងៗ", "LGBTQIA+"],
              ].map(([v, km, en]) => (
                <label
                  key={v}
                  className={cn(
                    "flex cursor-pointer flex-col items-center rounded-md border px-2 py-2 text-sm transition-colors",
                    values.gender === v ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted",
                  )}
                >
                  <input type="radio" name="gender" value={v} checked={values.gender === v} onChange={set("gender")} className="sr-only" />
                  <span style={{ fontFamily: "var(--font-battambang)" }}>{km}</span>
                  <span className="text-xs text-muted-foreground">{en}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-dob" km="ថ្ងៃខែឆ្នាំកំណើត" en="Date of birth" required />
              <Input id="r-dob" type="date" value={values.dob} onChange={set("dob")} min={limits.min} max={limits.max} className="h-10" aria-describedby="r-dob-hint" />
              <p id="r-dob-hint" className={cn("text-xs", dobAge !== null && (dobAge < MIN_AGE || dobAge > MAX_AGE) ? "text-rose-600" : "text-muted-foreground")}>
                {dobAge === null
                  ? `Age ${MIN_AGE}–${MAX_AGE} · អាយុ ${MIN_AGE}–${MAX_AGE} ឆ្នាំ`
                  : dobAge < MIN_AGE || dobAge > MAX_AGE
                    ? `Age ${dobAge} — only ${MIN_AGE} to ${MAX_AGE} can register`
                    : `Age ${dobAge} · អាយុ ${dobAge} ឆ្នាំ`}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-phone" km="លេខទូរស័ព្ទ" en="Phone" required />
              <Input
                id="r-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="012 345 678"
                value={values.phone}
                onChange={set("phone")}
                maxLength={20}
                className="h-10"
                aria-describedby="r-phone-hint"
                aria-invalid={phoneBad || undefined}
              />
              <p id="r-phone-hint" className={cn("text-xs", phoneBad ? "text-rose-600" : phone ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                {phone ? `✓ ${phone.operator} · ${formatKhmerMobile(phone.number)}` : phoneBad ? "Not a Smart, Cellcard or Metfone number" : "Smart, Cellcard or Metfone"}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <div className="space-y-1.5">
              <Label htmlFor="r-school" km="វិទ្យាល័យ" en="High school" />
              <Input id="r-school" value={values.highSchool} onChange={set("highSchool")} maxLength={200} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-grade" km="ថ្នាក់ទី" en="Grade" />
              <Input id="r-grade" inputMode="numeric" placeholder="12" value={values.grade} onChange={set("grade")} maxLength={20} className="h-10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-province" km="ខេត្ត/ក្រុង" en="Province" />
            <select id="r-province" className={selectClass} value={values.provinceId} onChange={set("provinceId")}>
              <option value="">—</option>
              {form.provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_kh ? `${p.name_kh} · ${p.name_en}` : p.name_en}
                </option>
              ))}
            </select>
          </div>
          {form.centers.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="r-center" km="មណ្ឌលប្រឡង" en="Exam center" required />
              <select id="r-center" className={selectClass} value={values.examCenterId} onChange={set("examCenterId")}>
                <option value="">— Choose · ជ្រើសរើស —</option>
                {form.centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.province ? `${c.name} (${c.province})` : c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Where you will sit the written exam.</p>
            </div>
          )}
          {/* Honeypot — hidden from people, bots fill it. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="r-website">Website</label>
            <input id="r-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" style={{ fontFamily: "var(--font-battambang)" }}>
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full text-base" disabled={sending}>
            {sending && <Loader2 className="animate-spin" />}
            <span style={{ fontFamily: "var(--font-battambang)" }}>ចុះឈ្មោះ</span> · Register
          </Button>
          {s.expires_at && (
            <p className="text-center text-xs text-muted-foreground">
              Registration closes {new Date(s.expires_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </form>
      </div>
    </Shell>
  );
}
