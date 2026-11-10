"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { createStudent, generateStudentCode } from "@/services/studentService";
import { getActiveCycle, listProvinces, listSchools } from "@/services/lookupService";
import { createNgo, listNgos } from "@/services/ngoService";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Download } from "lucide-react";

const TEMPLATE_HEADERS = [
  "First Name",
  "Last Name",
  "Gender",
  "Date of Birth",
  "Phone",
  "Province",
  "District",
  "Commune",
  "Village",
  "School",
  "Referring NGO",
  "Information Session",
  "Exam Center",
  "Eligible for Social Investigation",
  "Grade",
  "GPA",
  "English Level",
  "Father Name",
  "Mother Name",
  "Parent Occupation",
  "Family Monthly Income",
  "Siblings Count",
];

const TEMPLATE_EXAMPLE = [
  "Sokha",
  "Chan",
  "female",
  "2009-03-15",
  "012345678",
  "Banteay Meanchey",
  "Serei Saophoan",
  "Phnom Dei",
  "Chrey",
  "",
  "",
  "EDM - Banteaymeanchey",
  "EDM Banteaymeanchey 14th AM",
  "1",
  "10",
  "3.5",
  "intermediate",
  "Chan Dara",
  "Sok Mealea",
  "Farmer",
  "150",
  "3",
];

type ParsedRow = {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
  warnings: string[];
};

type ImportResult = { rowNumber: number; name: string; ok: boolean; message: string };

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s_]+/g, "_");
}

const HEADER_ALIASES: Record<string, string> = {
  first_name: "first_name",
  last_name: "last_name",
  gender: "gender",
  date_of_birth: "dob",
  dob: "dob",
  phone: "phone",
  province: "province",
  district: "district_name",
  commune: "commune_name",
  village: "village_name",
  school: "school",
  referring_ngo: "ngo",
  following_ngo: "ngo",
  ngo: "ngo",
  information_session: "information_session",
  exam_center: "exam_center",
  eligible_for_social_investigation: "eligible_for_social_investigation",
  grade: "grade",
  gpa: "gpa",
  english_level: "english_level",
  father_name: "father_name",
  mother_name: "mother_name",
  parent_occupation: "parent_occupation",
  family_monthly_income: "family_income_monthly",
  family_income_monthly: "family_income_monthly",
  siblings_count: "siblings_count",
};

function normalizeGender(raw: string): "male" | "female" | "lgbtqia+" | null {
  const v = raw.trim().toLowerCase();
  if (v === "male" || v === "m") return "male";
  if (v === "female" || v === "f") return "female";
  if (v === "lgbtqia+" || v === "lgbtqia" || v === "other" || v === "o") return "lgbtqia+";
  return null;
}

function normalizeEnglishLevel(raw: string): "none" | "beginner" | "intermediate" | "advanced" | null {
  const v = raw.trim().toLowerCase();
  if (["none", "beginner", "intermediate", "advanced"].includes(v)) {
    return v as "none" | "beginner" | "intermediate" | "advanced";
  }
  return null;
}

function normalizeFlag(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

function normalizeDob(raw: string): string | null {
  // Date cells come through already as full ISO strings (converted from JS
  // Date objects upstream, since cellDates: true is set on XLSX.read).
  const str = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function StudentImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Students");
    XLSX.writeFile(workbook, "student-import-template.xlsx");
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setResults(null);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const [provinces, schools, ngos] = await Promise.all([listProvinces(), listSchools(), listNgos()]);
    const provinceByName = new Map(provinces.map((p) => [p.name_en.trim().toLowerCase(), p.id]));
    const schoolByName = new Map(schools.map((s) => [s.school_name.trim().toLowerCase(), s.id]));
    const ngoByName = new Map(ngos.map((n) => [n.organization_name.trim().toLowerCase(), n.id]));

    const parsed: ParsedRow[] = raw.map((record, index) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(record)) {
        const mapped = HEADER_ALIASES[normalizeHeader(key)];
        if (mapped) normalized[mapped] = value instanceof Date ? value.toISOString() : String(value ?? "");
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!normalized.first_name?.trim()) errors.push("First name is required");
      if (!normalized.last_name?.trim()) errors.push("Last name is required");

      const gender = normalized.gender ? normalizeGender(normalized.gender) : null;
      if (!gender) errors.push("Gender must be male, female, or lgbtqia+");
      else normalized.gender = gender;

      if (normalized.dob) {
        const dob = normalizeDob(normalized.dob);
        if (!dob) warnings.push(`Date of birth "${normalized.dob}" is not a valid date, left blank`);
        normalized.dob = dob ?? "";
      }

      if (normalized.english_level) {
        const level = normalizeEnglishLevel(normalized.english_level);
        if (!level) warnings.push(`Unknown English level "${normalized.english_level}", left blank`);
        normalized.english_level = level ?? "";
      }

      if (normalized.province) {
        const id = provinceByName.get(normalized.province.trim().toLowerCase());
        if (!id) warnings.push(`Province "${normalized.province}" not found, left blank`);
        normalized.province_id = id ?? "";
      }

      if (normalized.school) {
        const id = schoolByName.get(normalized.school.trim().toLowerCase());
        if (!id) warnings.push(`School "${normalized.school}" not found, left blank`);
        normalized.school_id = id ?? "";
      }

      if (normalized.ngo) {
        const id = ngoByName.get(normalized.ngo.trim().toLowerCase());
        if (id) normalized.referred_by_ngo_id = id;
        else warnings.push(`NGO "${normalized.ngo}" not found — will be created automatically`);
      }

      if (normalized.eligible_for_social_investigation) {
        normalized.eligible_for_social_investigation = normalizeFlag(
          normalized.eligible_for_social_investigation,
        )
          ? "1"
          : "";
      }

      return { rowNumber: index + 2, values: normalized, errors, warnings };
    });

    setRows(parsed);
  }

  async function runImport() {
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    const importResults: ImportResult[] = [];
    try {
      const cycle = await getActiveCycle();
      if (!cycle) {
        toast.error("No active selection cycle found. Ask a Program Manager to create one.");
        return;
      }

      const ngos = await listNgos();
      const ngoByName = new Map(ngos.map((n) => [n.organization_name.trim().toLowerCase(), n.id]));

      for (const row of validRows) {
        const v = row.values;
        const name = `${v.first_name} ${v.last_name}`;
        let ngoNote = "";
        try {
          let ngoId = v.referred_by_ngo_id || "";
          if (!ngoId && v.ngo) {
            const key = v.ngo.trim().toLowerCase();
            const existing = ngoByName.get(key);
            if (existing) {
              ngoId = existing;
            } else {
              try {
                const created = await createNgo({ organization_name: v.ngo.trim() });
                ngoByName.set(key, created.id);
                ngoId = created.id;
                ngoNote = ` (created NGO partner "${v.ngo.trim()}")`;
              } catch {
                ngoNote = ` (could not create NGO "${v.ngo.trim()}" — referral left blank)`;
              }
            }
          }

          const studentCode = await generateStudentCode(cycle.year);
          const student = await createStudent({
            student_code: studentCode,
            cycle_id: cycle.id,
            first_name: v.first_name,
            last_name: v.last_name,
            gender: v.gender as "male" | "female" | "lgbtqia+",
            dob: v.dob || null,
            phone: v.phone || null,
            province_id: v.province_id || null,
            district_name: v.district_name || null,
            commune_name: v.commune_name || null,
            village_name: v.village_name || null,
            school_id: v.school_id || null,
            referred_by_ngo_id: ngoId || null,
            information_session: v.information_session || null,
            exam_center: v.exam_center || null,
            eligible_for_social_investigation: normalizeFlag(v.eligible_for_social_investigation || ""),
            grade: v.grade || null,
            gpa: v.gpa ? Number(v.gpa) : null,
            english_level: (v.english_level || null) as
              | "none"
              | "beginner"
              | "intermediate"
              | "advanced"
              | null,
            father_name: v.father_name || null,
            mother_name: v.mother_name || null,
            parent_occupation: v.parent_occupation || null,
            family_income_monthly: v.family_income_monthly ? Number(v.family_income_monthly) : null,
            siblings_count: v.siblings_count ? Number(v.siblings_count) : null,
          });
          importResults.push({
            rowNumber: row.rowNumber,
            name,
            ok: true,
            message: `Created ${student.student_code}${ngoNote}`,
          });
        } catch (error) {
          importResults.push({
            rowNumber: row.rowNumber,
            name,
            ok: false,
            message: error instanceof Error ? error.message : "Failed to create student",
          });
        }
      }

      setResults(importResults);
      const succeeded = importResults.filter((r) => r.ok).length;
      const failed = importResults.length - succeeded;
      if (failed === 0) {
        toast.success(`Imported ${succeeded} student${succeeded === 1 ? "" : "s"}`);
      } else {
        toast.error(`Imported ${succeeded}, failed ${failed} — see details below`);
      }
      onImported();
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import from Excel
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Students from Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">
              Columns: First Name, Last Name, Gender (required) — plus Date of Birth, Phone,
              Province, District, Commune, Village, School, Referring NGO, Information Session,
              Exam Center, Eligible for Social Investigation, Grade, GPA, English Level, and
              family info (optional). NGO names that don&apos;t match an existing partner are
              created automatically.
            </div>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="size-4" />
              Template
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {fileName && rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">{fileName}</span>: {rows.length} rows —{" "}
                <span className="text-green-600">{validCount} valid</span>
                {invalidCount > 0 && (
                  <>
                    , <span className="text-destructive">{invalidCount} with errors</span>
                  </>
                )}
              </p>

              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="p-2">{row.rowNumber}</td>
                        <td className="p-2">
                          {row.values.first_name} {row.values.last_name}
                        </td>
                        <td className="p-2">
                          {row.errors.length > 0 ? (
                            <span className="text-destructive">{row.errors.join("; ")}</span>
                          ) : row.warnings.length > 0 ? (
                            <span className="text-amber-600">{row.warnings.join("; ")}</span>
                          ) : (
                            <span className="text-green-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button onClick={runImport} disabled={importing || validCount === 0}>
                {importing ? "Importing..." : `Import ${validCount} student${validCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}

          {results && (
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.rowNumber} className="border-t">
                      <td className="p-2">{r.rowNumber}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">
                        <span className={r.ok ? "text-green-600" : "text-destructive"}>
                          {r.message}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
