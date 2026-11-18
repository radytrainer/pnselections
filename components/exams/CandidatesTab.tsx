"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, FileUp, Link2, Pencil, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveDataTable, type ResponsiveColumnMeta } from "@/components/tables/ResponsiveDataTable";
import { downloadXlsxBook, readSpreadsheet } from "@/components/exams/readSpreadsheet";

/** Excel template for "Import list": the columns the importer reads, two examples, and instructions. */
async function downloadCandidateTemplate() {
  const header = ["ID number", "First name", "Last name", "Gender", "DoB", "High school", "Province", "NGO"];
  await downloadXlsxBook("candidate-list-template.xlsx", [
    {
      name: "Candidates",
      rows: [header, ["0001", "Sokha", "Chan", "F", "14/03/2008", "Hun Sen Kampong Kantout", "Kandal", "PSE"], ["0002", "Dara", "Kim", "M", "02/11/2007", "Bak Touk High School", "Phnom Penh", ""]],
      widths: [11, 16, 16, 8, 12, 30, 16, 22],
      textColumns: [0, 4],
    },
    {
      name: "How to fill",
      rows: [
        ["Column", "Required?", "What to write"],
        ["ID number", "Recommended", "The exam number (the ZipGrade StudentID). 1, 01 and 0001 are the same ID. Leave empty to let the app give numbers."],
        ["First name", "Yes*", "Given name. *Or use one 'Name' column with the full name instead of First/Last."],
        ["Last name", "Yes*", "Family name."],
        ["Gender", "Recommended", "F or M (also Female/Male, ស្រី/ប្រុស). Needed for the girls/boys statistics."],
        ["DoB", "Optional", "Date of birth as DD/MM/YYYY, or an Excel date."],
        ["High school", "Optional", "Printed on the attendance and display lists."],
        ["Province", "Optional", "Printed on the attendance list."],
        ["NGO", "Optional", "Referring NGO, printed on the attendance list."],
        [],
        ["Tips", "", "Delete the two example rows before importing. An ID that already exists (for example from imported results) gets its name and details filled in instead of a new candidate."],
      ],
      widths: [14, 14, 110],
    },
  ]);
}
import { candidateGender, sessionLabel, type ExamCandidate, type ExamData, type Gender } from "@/features/written-exam/scoring";
import {
  addCandidates,
  addCandidatesFromStudents,
  assignCandidates,
  autoLinkCandidates,
  deleteCandidate,
  editCandidate,
  listCycleStudents,
  type CycleStudent,
} from "@/services/writtenExamService";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };
type Meta = ResponsiveColumnMeta<ExamCandidate>;
type Filter = "all" | "unassigned" | "nosession" | "unlinked" | "linked";

const PAGE = 100;
const FILTERS: Record<Filter, string> = {
  all: "All candidates",
  unassigned: "Not assigned to a center",
  nosession: "Center but no session",
  unlinked: "Not linked to a student",
  linked: "Linked to a student",
};
const GENDER_LABEL: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };
const NONE = "__none__";

/** M / F / Male / Female / ប្រុស / ស្រី → gender. */
function parseGender(v: unknown): Gender | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (["m", "male", "boy", "ប្រុស", "ប"].includes(s)) return "male";
  if (["f", "female", "girl", "ស្រី", "ស"].includes(s)) return "female";
  if (s.startsWith("lgbt")) return "lgbtqia+";
  return null;
}

export function CandidatesTab({ data, canEdit, reload }: TabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [dialog, setDialog] = useState<null | "add" | "import" | "students" | "assign">(null);
  const [editing, setEditing] = useState<ExamCandidate | null>(null);
  const [busy, setBusy] = useState(false);

  const sheetsByCandidate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.sheets) m.set(s.candidate_id, (m.get(s.candidate_id) ?? 0) + 1);
    return m;
  }, [data.sheets]);
  const centerById = useMemo(() => new Map(data.centers.map((c) => [c.id, c])), [data.centers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.candidates.filter((c) => {
      if (filter === "unassigned" && c.center_id) return false;
      if (filter === "nosession" && !(c.center_id && !c.session_id)) return false;
      if (filter === "unlinked" && c.student_id) return false;
      if (filter === "linked" && !c.student_id) return false;
      return !q || c.exam_number.includes(q) || (c.full_name ?? "").toLowerCase().includes(q) || (c.student?.code ?? "").toLowerCase().includes(q);
    });
  }, [data.candidates, filter, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE, current * PAGE);
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  async function run<T>(action: () => Promise<T>, message: string | ((result: T) => string)) {
    setBusy(true);
    try {
      const result = await action();
      toast.success(typeof message === "function" ? message(result) : message);
      await reload();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<ColumnDef<ExamCandidate>[]>(
    () => [
      {
        id: "number",
        header: "Exam no.",
        meta: { card: "hidden", className: "w-24" } satisfies Meta,
        cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.exam_number}</span>,
      },
      {
        id: "name",
        header: "Name",
        meta: {
          card: "title",
          cardCell: (c) => (
            <div className="min-w-0">
              <p className="truncate font-medium">{c.full_name || "No name"}</p>
              <p className="font-mono text-xs text-muted-foreground">{c.exam_number}</p>
            </div>
          ),
        } satisfies Meta,
        cell: ({ row }) => <span className="block max-w-56 truncate">{row.original.full_name || <span className="text-muted-foreground">No name</span>}</span>,
      },
      {
        id: "gender",
        header: "Gender",
        meta: { card: "summary" } satisfies Meta,
        cell: ({ row }) => {
          const g = candidateGender(row.original);
          return g ? GENDER_LABEL[g] : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: "place",
        header: "Center · session · room",
        meta: { card: "detail", label: "Center · session · room" } satisfies Meta,
        cell: ({ row }) => {
          const c = row.original;
          const center = c.center_id ? centerById.get(c.center_id) : null;
          if (!center) return <span className="text-amber-700 dark:text-amber-400">Not assigned</span>;
          const session = center.sessions.find((s) => s.id === c.session_id);
          const room = center.rooms.find((r) => r.id === c.room_id);
          return (
            <span className="block text-sm">
              <span className="block">
                {center.name}
                {room ? ` · ${room.name}` : ""}
              </span>
              {session ? (
                <span className="block text-xs text-muted-foreground">{sessionLabel(session)}</span>
              ) : (
                <span className="block text-xs text-amber-700 dark:text-amber-400">No session</span>
              )}
            </span>
          );
        },
      },
      {
        id: "student",
        header: "Student",
        meta: { card: "summary" } satisfies Meta,
        cell: ({ row }) =>
          row.original.student ? (
            <Badge variant="outline" title={row.original.student.name}>
              {row.original.student.code}
            </Badge>
          ) : (
            <span className="text-muted-foreground">Not linked</span>
          ),
      },
      {
        id: "sheets",
        header: "Sheets",
        meta: { card: "detail", label: "Sheets imported", className: "text-right tabular-nums" } satisfies Meta,
        cell: ({ row }) => `${sheetsByCandidate.get(row.original.id) ?? 0} / ${data.papers.length}`,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { card: "actions", className: "w-px" } satisfies Meta,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.full_name ?? row.original.exam_number}`}>
              <Pencil />
            </Button>
            {canEdit && !sheetsByCandidate.get(row.original.id) && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${row.original.full_name ?? row.original.exam_number}`}
                onClick={() => run(() => deleteCandidate(row.original.id), "Candidate deleted")}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centerById, sheetsByCandidate, canEdit, data.papers.length],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="candidate-search"
              aria-label="Search candidates"
              placeholder="Search name, exam no. or student code"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter((v as Filter) ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-60" aria-label="Filter candidates">
              <SelectValue>{(v: string) => FILTERS[v as Filter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTERS) as Filter[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FILTERS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialog("add")}>
              <UserPlus /> Add
            </Button>
            <Button variant="outline" onClick={() => setDialog("import")}>
              <FileUp /> Import list
            </Button>
            <Button variant="outline" onClick={() => setDialog("students")}>
              <Users /> Add from students
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await autoLinkCandidates(data.cycle.id);
                  toast.success(
                    `Linked ${r.linked} candidate${r.linked === 1 ? "" : "s"} to students by name` +
                      (r.ambiguous ? `; ${r.ambiguous} had several possible students and were left for you` : ""),
                  );
                  await reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Linking failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Link2 /> Link by name
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {data.candidates.length} candidates · {data.candidates.filter((c) => !c.center_id).length} not assigned to a center ·{" "}
        {data.candidates.filter((c) => c.student_id).length} linked to students
      </p>

      {canEdit && selectedIds.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-primary/5 px-4 py-2 backdrop-blur">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Button variant="ghost" size="icon-xs" onClick={() => setSelection({})} aria-label="Clear selection">
              <X />
            </Button>
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => assignCandidates(data.cycle.id, selectedIds, null), "Assignment cleared").then((ok) => ok && setSelection({}))}>
              Clear assignment
            </Button>
            <Button size="sm" onClick={() => setDialog("assign")} disabled={!data.centers.length} title={data.centers.length ? undefined : "Add an exam center on the Planning tab first"}>
              Assign to center…
            </Button>
          </div>
        </div>
      )}

      <ResponsiveDataTable
        data={rows}
        columns={columns}
        getRowId={(c) => c.id}
        empty={data.candidates.length ? "No candidates match." : "No candidates yet. Add them, import a list, or import a ZipGrade file."}
        selectable={canEdit}
        rowSelection={selection}
        onRowSelectionChange={setSelection}
      />

      {filtered.length > PAGE && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Page {current} of {pages}
          </span>
          <Button variant="outline" size="icon-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      )}

      {dialog === "add" && <AddDialog cycleId={data.cycle.id} onDone={() => setDialog(null)} run={run} />}
      {dialog === "import" && <ImportListDialog cycleId={data.cycle.id} onDone={() => setDialog(null)} run={run} />}
      {dialog === "students" && <FromStudentsDialog cycleId={data.cycle.id} onDone={() => setDialog(null)} run={run} />}
      {dialog === "assign" && (
        <AssignDialog
          data={data}
          ids={selectedIds}
          onDone={(ok) => {
            setDialog(null);
            if (ok) setSelection({});
          }}
          run={run}
        />
      )}
      {editing && <EditDialog data={data} candidate={editing} canEdit={canEdit} onDone={() => setEditing(null)} run={run} />}
    </div>
  );
}

type Run = <T>(action: () => Promise<T>, message: string | ((result: T) => string)) => Promise<boolean>;

function NumberingFields({ start, setStart, digits, setDigits }: { start: string; setStart: (v: string) => void; digits: string; setDigits: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">First new exam number</span>
        <Input id="numbering-start" inputMode="numeric" placeholder="Next free" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">Digits</span>
        <Input id="numbering-digits" inputMode="numeric" value={digits} onChange={(e) => setDigits(e.target.value)} className="w-20" />
      </label>
      <p className="pb-2 text-xs text-muted-foreground">New numbers continue after the highest one already used.</p>
    </div>
  );
}

const numbering = (start: string, digits: string) => ({
  startNumber: start.trim() ? Number(start) : undefined,
  digits: digits.trim() ? Number(digits) : undefined,
});

function GenderSelect({ value, onChange, id }: { value: Gender | null; onChange: (g: Gender | null) => void; id: string }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(!v || v === NONE ? null : (v as Gender))}>
      <SelectTrigger id={id} className="w-full" aria-label="Gender">
        <SelectValue>{(v: string) => (v === NONE ? "Not set" : GENDER_LABEL[v])}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not set</SelectItem>
        <SelectItem value="female">Female</SelectItem>
        <SelectItem value="male">Male</SelectItem>
        <SelectItem value="lgbtqia+">LGBTQIA+</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Excel serial number, YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD (null if unreadable). */
function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (typeof v === "number" && v > 1000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

type DetailDraft = { firstName: string; lastName: string; dob: string; highSchool: string; province: string; ngo: string };

/** First/last name, DoB, high school, province and NGO: printed on the attendance sheet. */
function DetailFields({ value, onChange, disabled, idPrefix }: { value: DetailDraft; onChange: (v: DetailDraft) => void; disabled?: boolean; idPrefix: string }) {
  const field = (key: keyof DetailDraft, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <label htmlFor={`${idPrefix}-${key}`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Input id={`${idPrefix}-${key}`} value={value[key]} disabled={disabled} onChange={(e) => onChange({ ...value, [key]: e.target.value })} {...props} />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {field("firstName", "First name")}
      {field("lastName", "Last name")}
      {field("dob", "Date of birth", { type: "date" })}
      {field("province", "Province")}
      <div className="col-span-2">{field("highSchool", "High school")}</div>
      <div className="col-span-2">{field("ngo", "NGO")}</div>
    </div>
  );
}

function AddDialog({ cycleId, onDone, run }: { cycleId: string; onDone: () => void; run: Run }) {
  const [details, setDetails] = useState<DetailDraft>({ firstName: "", lastName: "", dob: "", highSchool: "", province: "", ngo: "" });
  const name = `${details.firstName} ${details.lastName}`.trim().replace(/\s+/g, " ");
  const [gender, setGender] = useState<Gender | null>(null);
  const [num, setNum] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a candidate</DialogTitle>
          <DialogDescription>Leave the exam number empty to give the next free number.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <DetailFields idPrefix="add" value={details} onChange={setDetails} />
          <GenderSelect id="add-gender" value={gender} onChange={setGender} />
          <Input id="add-number" inputMode="numeric" placeholder="Exam number (optional)" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              const d = details;
              const row = {
                fullName: name,
                gender,
                examNumber: num || undefined,
                firstName: d.firstName.trim() || null,
                lastName: d.lastName.trim() || null,
                dob: d.dob || null,
                highSchool: d.highSchool.trim() || null,
                province: d.province.trim() || null,
                ngo: d.ngo.trim() || null,
              };
              if (await run(() => addCandidates(cycleId, [row]), "Candidate added")) onDone();
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ListRow = {
  examNumber?: string;
  fullName: string;
  gender: Gender | null;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  highSchool: string | null;
  province: string | null;
  ngo: string | null;
};

function ImportListDialog({ cycleId, onDone, run }: { cycleId: string; onDone: () => void; run: Run }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [digits, setDigits] = useState("4");

  async function onFile(file: File) {
    setError(null);
    try {
      const { matrix } = await readSpreadsheet(file);
      const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
      const hi = matrix.findIndex((r) => r.some((c) => ["name", "fullname", "firstname", "lastname"].includes(norm(c))));
      if (hi < 0) throw new Error("Couldn't find a Name column (or First name / Last name).");
      const h = matrix[hi].map(norm);
      const col = (...n: string[]) => h.findIndex((c) => n.includes(c));
      const cName = col("name", "fullname", "studentname");
      const cFirst = col("firstname");
      const cLast = col("lastname", "familyname");
      const cGender = col("gender", "sex");
      const cNum = col("examnumber", "examno", "number", "id", "idnumber", "idno", "studentid", "zipgradeid");
      const cDob = col("dob", "dateofbirth", "birthdate", "birthday");
      const cSchool = col("highschool", "school", "schoolname");
      const cProvince = col("province", "provincename");
      const cNgo = col("ngo", "ngoname", "ngopartner", "referredby");
      const text = (c: number, r: unknown[]) => (c >= 0 ? String(r[c] ?? "").trim().replace(/\s+/g, " ") || null : null);
      const out: ListRow[] = [];
      for (const r of matrix.slice(hi + 1)) {
        const name = (cName >= 0 ? String(r[cName] ?? "") : [r[cFirst], r[cLast]].filter(Boolean).join(" ")).trim().replace(/\s+/g, " ");
        if (!name) continue;
        const num = cNum >= 0 ? String(r[cNum] ?? "").replace(/\.0+$/, "").trim() : "";
        if (num && !/^\d{1,12}$/.test(num)) throw new Error(`“${num}” (${name}) isn't a valid exam number: digits only.`);
        const dob = cDob >= 0 ? parseDate(r[cDob]) : null;
        if (cDob >= 0 && r[cDob] !== "" && !dob) throw new Error(`Couldn't read the date of birth “${String(r[cDob])}” for ${name}. Use DD/MM/YYYY.`);
        out.push({
          fullName: name,
          gender: cGender >= 0 ? parseGender(r[cGender]) : null,
          examNumber: num || undefined,
          firstName: text(cFirst, r),
          lastName: text(cLast, r),
          dob,
          highSchool: text(cSchool, r),
          province: text(cProvince, r),
          ngo: text(cNgo, r),
        });
      }
      if (!out.length) throw new Error("No names found under the header row.");
      setRows(out);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    }
  }

  const withNumber = rows?.filter((r) => r.examNumber).length ?? 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a candidate list</DialogTitle>
          <DialogDescription>
            Excel or CSV with <strong>First name</strong> / <strong>Last name</strong> columns (or one <strong>Name</strong> column).
            Optional: <strong>ID number</strong> (exam number), <strong>Gender</strong> (M/F, Male/Female, ប្រុស/ស្រី), <strong>DoB</strong>,{" "}
            <strong>High school</strong>, <strong>Province</strong> and <strong>NGO</strong>, all printed on the attendance sheet. An ID
            that already exists (e.g. from imported results) gets its name and details filled in; 1, 01 and 0001 count as the same ID.
          </DialogDescription>
        </DialogHeader>
        <input ref={fileRef} id="candidate-list-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp /> Choose file
          </Button>
          <Button variant="ghost" onClick={() => downloadCandidateTemplate().catch(() => toast.error("Couldn't create the template"))}>
            <Download /> Download template
          </Button>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {rows && (
          <div className="space-y-3 text-sm">
            <p>
              {rows.length} candidates · {withNumber} with an exam number · {rows.filter((r) => r.gender).length} with a gender ·{" "}
              {rows.filter((r) => r.dob).length} with a date of birth · {rows.filter((r) => r.highSchool).length} with a high school
            </p>
            {withNumber < rows.length && <NumberingFields start={start} setStart={setStart} digits={digits} setDigits={setDigits} />}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!rows?.length}
            onClick={async () => {
              if (
                rows &&
                (await run(
                  () => addCandidates(cycleId, rows, numbering(start, digits)),
                  (r) =>
                    [r.created ? `${r.created} candidates added` : "", r.updated ? `${r.updated} existing candidates updated (names and details)` : ""]
                      .filter(Boolean)
                      .join(" · ") || "Nothing to import",
                ))
              )
                onDone();
            }}
          >
            Import {rows?.length ?? ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FromStudentsDialog({ cycleId, onDone, run }: { cycleId: string; onDone: () => void; run: Run }) {
  const [students, setStudents] = useState<CycleStudent[] | null>(null);
  const [start, setStart] = useState("");
  const [digits, setDigits] = useState("4");
  useEffect(() => {
    listCycleStudents(cycleId).then(setStudents).catch(() => setStudents([]));
  }, [cycleId]);
  const todo = students?.filter((s) => !s.exam_number) ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidates from students</DialogTitle>
          <DialogDescription>
            Gives every student of this cycle who isn&apos;t an exam candidate yet a new exam number, and links them, so their results
            update the student record later.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {students === null ? "Counting students…" : `${todo.length} of ${students.length} students don't have an exam number yet.`}
        </p>
        {todo.length > 0 && <NumberingFields start={start} setStart={setStart} digits={digits} setDigits={setDigits} />}
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!todo.length}
            onClick={async () => {
              if (await run(() => addCandidatesFromStudents(cycleId, numbering(start, digits)), `${todo.length} candidates added from students`)) onDone();
            }}
          >
            Add {todo.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ data, ids, onDone, run }: { data: ExamData; ids: string[]; onDone: (ok: boolean) => void; run: Run }) {
  const [centerId, setCenterId] = useState(data.centers[0]?.id ?? "");
  const [sessionId, setSessionId] = useState(NONE);
  const [roomId, setRoomId] = useState(NONE);
  const center = data.centers.find((c) => c.id === centerId);
  const room = center?.rooms.find((r) => r.id === roomId);
  const inRoom = room ? data.candidates.filter((c) => c.room_id === room.id && (sessionId === NONE || c.session_id === sessionId) && !ids.includes(c.id)).length : 0;
  const over = room?.capacity ? inRoom + ids.length - room.capacity : 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onDone(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {ids.length} candidate{ids.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>Session and room are optional and can be set later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select
            value={centerId}
            onValueChange={(v) => {
              setCenterId(v ?? "");
              setSessionId(NONE);
              setRoomId(NONE);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Exam center">
              <SelectValue>{(v: string) => data.centers.find((c) => c.id === v)?.name ?? "Center"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {data.centers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sessionId} onValueChange={(v) => setSessionId(v ?? NONE)}>
            <SelectTrigger className="w-full" aria-label="Session">
              <SelectValue>{(v: string) => (v === NONE ? "No session yet" : (center?.sessions.find((s) => s.id === v) ? sessionLabel(center.sessions.find((s) => s.id === v)!) : "Session"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No session yet</SelectItem>
              {center?.sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {sessionLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roomId} onValueChange={(v) => setRoomId(v ?? NONE)}>
            <SelectTrigger className="w-full" aria-label="Room">
              <SelectValue>{(v: string) => (v === NONE ? "No room yet" : (center?.rooms.find((r) => r.id === v)?.name ?? "Room"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No room yet</SelectItem>
              {center?.rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity ? ` (${r.capacity} seats)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {room?.capacity != null && (
            <p className={over > 0 ? "text-sm text-amber-700 dark:text-amber-400" : "text-sm text-muted-foreground"}>
              {room.name}: {inRoom + ids.length} of {room.capacity} seats after this{over > 0 ? `, ${over} over capacity` : ""}.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onDone(false)}>
            Cancel
          </Button>
          <Button
            disabled={!centerId}
            onClick={async () =>
              onDone(
                await run(
                  () => assignCandidates(data.cycle.id, ids, centerId, sessionId === NONE ? null : sessionId, roomId === NONE ? null : roomId),
                  `${ids.length} candidate${ids.length === 1 ? "" : "s"} assigned`,
                ),
              )
            }
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ data, candidate, canEdit, onDone, run }: { data: ExamData; candidate: ExamCandidate; canEdit: boolean; onDone: () => void; run: Run }) {
  const initial = useMemo<DetailDraft>(() => {
    const [first, ...rest] = (candidate.full_name ?? "").trim().split(/\s+/);
    return {
      firstName: candidate.first_name ?? (candidate.last_name ? "" : first ?? ""),
      lastName: candidate.last_name ?? (candidate.first_name ? "" : rest.join(" ")),
      dob: candidate.dob?.slice(0, 10) ?? "",
      highSchool: candidate.high_school ?? "",
      province: candidate.province ?? "",
      ngo: candidate.ngo ?? "",
    };
  }, [candidate]);
  const [details, setDetails] = useState<DetailDraft>(initial);
  const name = `${details.firstName} ${details.lastName}`.trim().replace(/\s+/g, " ");
  const [gender, setGender] = useState<Gender | null>(candidate.gender);
  const [students, setStudents] = useState<CycleStudent[] | null>(null);
  const [q, setQ] = useState("");
  const [studentId, setStudentId] = useState<string | null>(candidate.student_id);
  useEffect(() => {
    listCycleStudents(data.cycle.id).then(setStudents).catch(() => setStudents([]));
  }, [data.cycle.id]);
  const matches = (students ?? [])
    .filter((s) => !s.exam_number || s.id === candidate.student_id)
    .filter((s) => {
      const t = q.trim().toLowerCase();
      return !t || `${s.first_name} ${s.last_name} ${s.code}`.toLowerCase().includes(t);
    })
    .slice(0, 8);
  const linked = students?.find((s) => s.id === studentId);

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Candidate {candidate.exam_number}</DialogTitle>
          <DialogDescription>
            Used on the printed lists and statistics. Once linked to a student, the student&apos;s record is printed instead.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto">
          <DetailFields idPrefix="edit" value={details} onChange={setDetails} disabled={!canEdit} />
          <GenderSelect id="edit-gender" value={gender} onChange={setGender} />
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Linked student</p>
            {linked ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {linked.first_name} {linked.last_name} · <span className="font-mono">{linked.code}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setStudentId(null)}>
                  Unlink
                </Button>
              </div>
            ) : (
              <>
                <Input id="link-search" placeholder="Search students by name or code" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {students === null && <p className="text-xs text-muted-foreground">Loading students…</p>}
                  {matches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStudentId(s.id)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span>
                        {s.first_name} {s.last_name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                    </button>
                  ))}
                  {students !== null && matches.length === 0 && <p className="text-xs text-muted-foreground">No unlinked student matches.</p>}
                </div>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              const patch: Parameters<typeof editCandidate>[1] = {};
              if (name !== (candidate.full_name ?? "")) patch.fullName = name;
              const keys: [keyof DetailDraft, keyof typeof patch][] = [
                ["firstName", "firstName"],
                ["lastName", "lastName"],
                ["dob", "dob"],
                ["highSchool", "highSchool"],
                ["province", "province"],
                ["ngo", "ngo"],
              ];
              const stored: DetailDraft = {
                firstName: candidate.first_name ?? "",
                lastName: candidate.last_name ?? "",
                dob: candidate.dob?.slice(0, 10) ?? "",
                highSchool: candidate.high_school ?? "",
                province: candidate.province ?? "",
                ngo: candidate.ngo ?? "",
              };
              for (const [k, p] of keys) if (details[k].trim() !== stored[k]) (patch as Record<string, string | null>)[p] = details[k].trim() || null;
              if (gender !== candidate.gender) patch.gender = gender;
              if (studentId !== candidate.student_id) patch.studentId = studentId;
              if (!Object.keys(patch).length) return onDone();
              if (await run(() => editCandidate(candidate.id, patch), "Candidate saved")) onDone();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
