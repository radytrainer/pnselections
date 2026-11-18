"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadXlsxBook } from "@/components/exams/readSpreadsheet";
import type { StudentExamCenter } from "@/services/studentService";
import {
  addRegistrationsToCandidates,
  removeRegistrations,
  updateRegistration,
  type InformationSession,
  type IsRegistration,
} from "@/services/informationSessionService";

const GENDER: Record<IsRegistration["gender"], string> = { female: "Female", male: "Male", "lgbtqia+": "LGBTQIA+" };
const NONE = "__none__";

export function RegistrationsTable({
  session,
  rows,
  centers,
  loading,
  reload,
}: {
  session: InformationSession;
  rows: IsRegistration[];
  centers: StudentExamCenter[];
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "add" | "remove"; ids: string[] }>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.first_name, r.last_name, r.high_school, r.phone, r.exam_center_name, r.exam_number].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [rows, q]);
  const selectedIds = filtered.filter((r) => selected[r.id]).map((r) => r.id);
  const notAdded = rows.filter((r) => !r.candidate_id);
  const allChecked = filtered.length > 0 && filtered.every((r) => selected[r.id]);
  /** Repeat registrations of someone who already registered (safe to remove). */
  const repeats = rows.filter((r) => r.duplicate_of_registration && !r.candidate_id);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    try {
      toast.success(await fn());
      setSelected({});
      setConfirm(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function exportXlsx() {
    const header = ["Registered", "First name", "Last name", "Gender", "Date of birth", "Phone", "High school", "Grade", "Province", "Exam center", "Exam no."];
    const body = rows.map((r) => [
      new Date(r.created_at).toLocaleString(),
      r.first_name,
      r.last_name,
      GENDER[r.gender],
      r.dob?.slice(0, 10) ?? "",
      r.phone ?? "",
      r.high_school ?? "",
      r.grade ?? "",
      r.province_name ?? "",
      r.exam_center_name ?? "",
      r.exam_number ?? "",
    ]);
    const file = `Registrations_${session.name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 60)}.xlsx`;
    downloadXlsxBook(file, [{ name: "Registrations", rows: [header, ...body], widths: [18, 16, 16, 10, 12, 14, 26, 7, 16, 18, 9], filterRow: 0, textColumns: [5, 10] }]).catch(() =>
      toast.error("Couldn't create the Excel file"),
    );
  }

  const addIds = (selectedIds.length ? selectedIds : notAdded.map((r) => r.id)).filter((id) => !rows.find((r) => r.id === id)?.candidate_id);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search registrations" placeholder="Search name, school, phone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={addIds.length === 0} onClick={() => setConfirm({ kind: "add", ids: addIds })}>
            <UserPlus /> Add {addIds.length > 0 ? addIds.length : ""} to exam candidates
          </Button>
          <Button variant="outline" disabled={rows.length === 0} onClick={exportXlsx}>
            <Download /> Excel
          </Button>
          {repeats.length > 0 && (
            <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10" onClick={() => setSelected(Object.fromEntries(repeats.map((r) => [r.id, true])))}>
              Select {repeats.length} repeat{repeats.length === 1 ? "" : "s"}
            </Button>
          )}
          {selectedIds.length > 0 && (
            <Button variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-500/10" onClick={() => setConfirm({ kind: "remove", ids: selectedIds })}>
              <Trash2 /> Remove {selectedIds.length}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No registrations yet. Share the link or QR code with students at the session.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) => setSelected(v === true ? Object.fromEntries(filtered.map((r) => [r.id, true])) : {})}
                    aria-label="Select all"
                  />
                </th>
                <th className="min-w-52 px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Gender</th>
                <th className="px-3 py-2 font-medium">High school · province</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Exam center</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className={selected[r.id] ? "bg-primary/5" : undefined}>
                  <td className="px-3 py-2">
                    <Checkbox checked={!!selected[r.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: v === true }))} aria-label={`Select ${r.first_name} ${r.last_name}`} />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.dob ? `Born ${r.dob.slice(0, 10)} · ` : ""}
                      {new Date(r.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </td>
                  <td className="px-3 py-2">{GENDER[r.gender]}</td>
                  <td className="px-3 py-2">
                    <p className="truncate">{r.high_school || "—"}{r.grade ? ` · Gr. ${r.grade}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{r.province_name ?? ""}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.phone || "—"}</td>
                  <td className="px-3 py-2">
                    {r.candidate_id ? (
                      r.exam_center_name ?? "—"
                    ) : (
                      <Select
                        value={r.exam_center_id ?? NONE}
                        onValueChange={(v) =>
                          run(`center-${r.id}`, async () => {
                            await updateRegistration(r.id, { examCenterId: !v || v === NONE ? null : v });
                            return "Exam center updated";
                          })
                        }
                      >
                        <SelectTrigger size="sm" className="w-40" aria-label={`Exam center for ${r.first_name} ${r.last_name}`}>
                          <SelectValue>{(v: string) => (v === NONE ? "Not chosen" : (centers.find((c) => c.id === v)?.name ?? r.exam_center_name ?? "Not chosen"))}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Not chosen</SelectItem>
                          {centers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.candidate_id ? (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Candidate {r.exam_number}
                      </Badge>
                    ) : r.duplicate_of_registration ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                        title={`Same person registered earlier (${new Date(r.duplicate_of_registration).toLocaleString()}) — same name and birth date or phone`}
                      >
                        Repeat
                      </Badge>
                    ) : r.duplicate_candidate ? (
                      <Badge
                        variant="outline"
                        className="border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300"
                        title="Already in the exam candidates with the same name and birth date — adding links to that candidate instead of creating a new one"
                      >
                        Already candidate {r.duplicate_candidate}
                      </Badge>
                    ) : (
                      <Badge variant="outline">New</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm?.kind === "add" ? (
            <>
              <DialogHeader>
                <DialogTitle>Add {confirm.ids.length} to exam candidates?</DialogTitle>
                <DialogDescription>
                  Each gets the next free exam number, with their name, gender, date of birth, high school, province and chosen exam center. Anyone already in the
                  candidates (same name and birth date) is linked to that candidate instead of being added twice. They then appear on Written Exams → Candidates
                  (attendance lists, ZipGrade CSV).
                  {rows.filter((r) => confirm.ids.includes(r.id) && !r.exam_center_id).length > 0 &&
                    ` ${rows.filter((r) => confirm.ids.includes(r.id) && !r.exam_center_id).length} have no exam center yet — you can assign one later on the Candidates tab.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={busy === "add"}
                  onClick={() =>
                    run("add", async () => {
                      const r = await addRegistrationsToCandidates(confirm.ids);
                      const parts = [
                        r.added ? `${r.added} added to exam candidates (${r.first === r.last ? r.first : `${r.first}–${r.last}`})` : "",
                        r.matched ? `${r.matched} matched to existing candidate${r.matched === 1 ? "" : "s"}` : "",
                      ].filter(Boolean);
                      return parts.length ? parts.join(" · ") : "Nothing new to add";
                    })
                  }
                >
                  {busy === "add" && <Loader2 className="animate-spin" />}
                  Add to candidates
                </Button>
              </DialogFooter>
            </>
          ) : confirm ? (
            <>
              <DialogHeader>
                <DialogTitle>Remove {confirm.ids.length} registration{confirm.ids.length === 1 ? "" : "s"}?</DialogTitle>
                <DialogDescription>Use this for duplicates or test entries. Exam candidates already created from them are not affected.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy === "remove"}
                  onClick={() =>
                    run("remove", async () => {
                      const r = await removeRegistrations(confirm.ids);
                      return `${r.removed} removed`;
                    })
                  }
                >
                  {busy === "remove" && <Loader2 className="animate-spin" />}
                  Remove
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
