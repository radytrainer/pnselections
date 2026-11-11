"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ChevronDown, Database, Download, FileSpreadsheet, FileCode2, Loader2, ShieldAlert } from "lucide-react";
import { downloadSqlBackup, getBackupData, listBackupTables, type BackupTable } from "@/services/adminToolsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const AUDIT_TABLE = "audit_logs";
const EXCEL_CELL_LIMIT = 32_000; // Excel refuses cells over 32,767 characters

const nf = new Intl.NumberFormat("en-US");

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Excel sheet names: max 31 chars, no []:*?/\ and unique within the workbook. */
function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
  let candidate = base;
  for (let i = 2; used.has(candidate); i++) candidate = `${base.slice(0, 28)}_${i}`;
  used.add(candidate);
  return candidate;
}

function cellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : value;
  if (typeof text === "string" && text.length > EXCEL_CELL_LIMIT) return `${text.slice(0, EXCEL_CELL_LIMIT)}… [truncated]`;
  return text as string | number | boolean;
}

function OptionCard({
  icon: Icon,
  accent,
  title,
  description,
  points,
  action,
}: {
  icon: typeof Database;
  accent: string;
  title: string;
  description: string;
  points: string[];
  action: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", accent)}>
            <Icon className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <div className="mt-auto">{action}</div>
      </CardContent>
    </Card>
  );
}

export default function BackupPage() {
  const { role, loading: roleLoading } = useRole();
  const allowed = can(role, "manageBackups");
  const [tables, setTables] = useState<BackupTable[] | null>(null);
  const [includeAudit, setIncludeAudit] = useState(true);
  const [busy, setBusy] = useState<"sql" | "excel" | null>(null);
  const [showTables, setShowTables] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    listBackupTables()
      .then(setTables)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load tables"));
  }, [allowed]);

  const selected = useMemo(
    () => (tables ?? []).filter((t) => includeAudit || t.name !== AUDIT_TABLE),
    [tables, includeAudit],
  );
  const totalRows = selected.reduce((sum, t) => sum + (t.rows ?? 0), 0);
  const auditRows = tables?.find((t) => t.name === AUDIT_TABLE)?.rows ?? 0;

  async function handleSql() {
    setBusy("sql");
    try {
      const file = await downloadSqlBackup(includeAudit ? undefined : selected.map((t) => t.name));
      toast.success(`Downloaded ${file.name} (${formatBytes(file.bytes)})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleExcel() {
    setBusy("excel");
    try {
      const data = await getBackupData(selected.map((t) => t.name));
      const workbook = XLSX.utils.book_new();
      const used = new Set<string>();

      const summary = [
        ["PN Selection Tracker — data backup"],
        ["Created", new Date(data.createdAt).toLocaleString()],
        [],
        ["Table", "Rows", "Note"],
        ...data.tables.map((t) => [t.name, t.rows.length, t.error ? `Not included: ${t.error}` : ""]),
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summary);
      summarySheet["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, sheetName("Summary", used));

      for (const table of data.tables) {
        const header = table.columns.length ? table.columns : Object.keys(table.rows[0] ?? {});
        const rows = table.rows.map((row) => header.map((col) => cellValue(row[col])));
        const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
        sheet["!cols"] = header.map((col) => ({ wch: Math.min(40, Math.max(10, col.length + 2)) }));
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName(table.name, used));
      }

      const name = `pn-selection-backup-${stamp()}.xlsx`;
      XLSX.writeFile(workbook, name, { compression: true });
      toast.success(`Downloaded ${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup failed");
    } finally {
      setBusy(null);
    }
  }

  if (roleLoading) return <Skeleton className="h-64 w-full" />;
  if (!allowed) return <p className="text-sm text-muted-foreground">Only a Super Admin can download backups.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Database className="size-6 text-muted-foreground" />
          Backup
        </h1>
        <p className="text-sm text-muted-foreground">Download a full copy of the system&apos;s data.</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p>
          Backups contain students&apos; and families&apos; personal information. Keep the files in a safe, private place
          and don&apos;t send them by email or chat. Photos and documents are not included; only the data.
        </p>
      </div>

      {/* What's included */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What&apos;s included</CardTitle>
          <CardDescription>
            {tables
              ? `${selected.length} tables · ${nf.format(totalRows)} rows`
              : "Counting rows..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="include-audit"
              checked={includeAudit}
              onCheckedChange={(v) => setIncludeAudit(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="include-audit" className="flex flex-col items-start gap-0.5 font-normal">
              <span className="font-medium">Include audit logs</span>
              <span className="text-xs text-muted-foreground">
                The history of every change ({nf.format(auditRows)} entries). Makes the file larger.
              </span>
            </Label>
          </div>

          <button
            type="button"
            onClick={() => setShowTables((v) => !v)}
            aria-expanded={showTables}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ChevronDown className={cn("size-4 transition-transform", showTables && "rotate-180")} />
            {showTables ? "Hide tables" : "Show tables"}
          </button>
          {showTables &&
            (tables ? (
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {tables.map((t) => {
                  const excluded = !includeAudit && t.name === AUDIT_TABLE;
                  return (
                    <li key={t.name} className={cn("flex justify-between gap-3 border-b py-1", excluded && "opacity-40 line-through")}>
                      <span className="truncate font-mono text-xs">{t.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t.rows == null ? "no access" : nf.format(t.rows)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Skeleton className="h-24 w-full" />
            ))}
        </CardContent>
      </Card>

      {/* Formats */}
      <div className="grid gap-5 md:grid-cols-2">
        <OptionCard
          icon={FileCode2}
          accent="bg-indigo-100 text-indigo-700"
          title="SQL file"
          description="A restorable copy of the database"
          points={[
            "Use it to restore the system after a problem, or to move it to a new server.",
            "Contains INSERT statements for every table; instructions are at the top of the file.",
          ]}
          action={
            <Button className="w-full gap-2" disabled={busy !== null || !tables} onClick={handleSql}>
              {busy === "sql" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {busy === "sql" ? "Preparing..." : "Download SQL"}
            </Button>
          }
        />
        <OptionCard
          icon={FileSpreadsheet}
          accent="bg-emerald-100 text-emerald-700"
          title="Excel workbook"
          description="Easy to open and read"
          points={[
            "One sheet per table, plus a summary sheet with row counts.",
            "Good for checking or sharing data internally. Can't be used to restore the system.",
          ]}
          action={
            <Button variant="outline" className="w-full gap-2" disabled={busy !== null || !tables} onClick={handleExcel}>
              {busy === "excel" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {busy === "excel" ? "Preparing..." : "Download Excel"}
            </Button>
          }
        />
      </div>
    </div>
  );
}
