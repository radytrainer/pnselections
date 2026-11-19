"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Province } from "@/services/lookupService";
import type { StudentExamCenter } from "@/services/studentService";
import { PRESENTER_TYPES, type InformationSession, type PresenterType, type SessionInput } from "@/services/informationSessionService";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/** Create / edit an information session. */
export function SessionDialog({
  session,
  provinces,
  centers,
  onSave,
  onClose,
}: {
  session: InformationSession | null;
  provinces: Province[];
  centers: StudentExamCenter[];
  onSave: (input: SessionInput & { name: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(session?.name ?? "");
  const [date, setDate] = useState(session?.session_date?.slice(0, 10) ?? "");
  const [venue, setVenue] = useState(session?.venue ?? "");
  const [provinceId, setProvinceId] = useState(session?.province_id ?? "");
  const [centerId, setCenterId] = useState(session?.default_exam_center_id ?? "");
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [telegram, setTelegram] = useState(session?.telegram_url ?? "");
  const [presenterType, setPresenterType] = useState<PresenterType | "">(session?.presenter_type ?? "");
  const [presenterName, setPresenterName] = useState(session?.presenter_name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accept "t.me/xyz" or "@xyz" too and turn them into a full link.
  function normalizeTelegram(v: string) {
    const t = v.trim();
    if (!t) return "";
    if (t.startsWith("@")) return `https://t.me/${t.slice(1)}`;
    if (/^(t\.me|telegram\.me)\//i.test(t)) return `https://${t}`;
    return t.replace(/^http:\/\//i, "https://");
  }
  const telegramUrl = normalizeTelegram(telegram);
  const telegramOk = !telegramUrl || /^https:\/\/(t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+$/.test(telegramUrl);

  async function save() {
    if (!name.trim()) return setError("Give the session a name");
    if (!presenterType) return setError("Choose who gave the session: PNC Staff, Partners or Alumni");
    if (!telegramOk) return setError("Use a Telegram link like https://t.me/+AbCdEf or https://t.me/groupname");
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        sessionDate: date || null,
        venue: venue.trim() || null,
        provinceId: provinceId || null,
        defaultExamCenterId: centerId || null,
        notes: notes.trim() || null,
        telegramUrl: telegramUrl || null,
        presenterType,
        presenterName: presenterName.trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{session ? "Edit information session" : "New information session"}</DialogTitle>
          <DialogDescription>
            {session ? "Changes show on the registration form straight away." : "A registration link and QR code are created with the session — open by default."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <label htmlFor="is-name" className="text-sm font-medium">
              Name <span className="text-rose-600">*</span>
            </label>
            <Input id="is-name" autoFocus placeholder="e.g. Hun Sen Takhmao High School" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="is-date" className="text-sm font-medium">
                Date
              </label>
              <Input id="is-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" id="is-province-label">
                Province
              </label>
              <Select value={provinceId || NONE} onValueChange={(v) => setProvinceId(!v || v === NONE ? "" : v)}>
                <SelectTrigger className="w-full" aria-labelledby="is-province-label">
                  <SelectValue>{(v: string) => (v === NONE ? "Not set" : (provinces.find((p) => p.id === v)?.name_en ?? "Not set"))}</SelectValue>
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
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="is-venue" className="text-sm font-medium">
              Venue / school
            </label>
            <Input id="is-venue" placeholder="Where the session takes place" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              Presented by <span className="text-rose-600">*</span>
            </legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {PRESENTER_TYPES.map((p) => (
                <label
                  key={p.value}
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    presenterType === p.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="presenter-type"
                    value={p.value}
                    checked={presenterType === p.value}
                    onChange={() => {
                      setPresenterType(p.value);
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <Input
              id="is-presenter"
              aria-label="Presenter name(s)"
              placeholder={
                presenterType === "partners" ? "Partner organization and presenter names" : presenterType === "alumni" ? "Alumni names" : "Presenter names, e.g. Sokha, Dara"
              }
              value={presenterName}
              onChange={(e) => setPresenterName(e.target.value)}
              maxLength={200}
            />
          </fieldset>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" id="is-center-label">
              Suggested exam center
            </label>
            <Select value={centerId || NONE} onValueChange={(v) => setCenterId(!v || v === NONE ? "" : v)}>
              <SelectTrigger className="w-full" aria-labelledby="is-center-label">
                <SelectValue>{(v: string) => (v === NONE ? "None — students choose" : (centers.find((c) => c.id === v)?.name ?? "None — students choose"))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None — students choose</SelectItem>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {centers.length === 0
                ? "No exam centers yet for this cycle — add them in Written Exams → Planning so students can choose one."
                : "Pre-selected on the form; students can still pick another."}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="is-telegram" className="text-sm font-medium">
              Telegram group link
            </label>
            <Input
              id="is-telegram"
              inputMode="url"
              placeholder="https://t.me/+AbCdEf123"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              maxLength={300}
              aria-invalid={!telegramOk || undefined}
            />
            <p className={telegramOk ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
              {telegramOk
                ? "Students see a “Join Telegram group” button after they register. Leave empty for none."
                : "Use a Telegram link like https://t.me/+AbCdEf or https://t.me/groupname"}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="is-notes" className="text-sm font-medium">
              Notes <span className="font-normal text-muted-foreground">(staff only)</span>
            </label>
            <Textarea id="is-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {session ? "Save" : "Create session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
