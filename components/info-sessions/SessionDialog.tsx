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
import type { InformationSession, SessionInput } from "@/services/informationSessionService";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Give the session a name");
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
