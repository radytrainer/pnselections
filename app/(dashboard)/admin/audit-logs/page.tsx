"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FilePen,
  FileX2,
  History,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  getAuditLog,
  getAuditLogMeta,
  listAuditLogs,
  type AuditAction,
  type AuditLogDetail,
  type AuditLogRow,
} from "@/services/adminToolsService";
import { SearchInput } from "@/components/forms/SearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/** Plain-language names for the tables the audit trail records. */
const AREA_LABELS: Record<string, string> = {
  students: "Student",
  social_assessments: "Social form (home visit)",
  home_visits: "Home visit",
  exam_results: "Exam result",
  interviews: "Interview",
  interview_answers: "Interview answer",
  committee_ratings: "Committee vote",
  committee_decisions: "Committee decision",
  committee_notes: "Committee note",
  student_documents: "Photo / document",
  ngo_partners: "NGO partner",
  school_partners: "School partner",
  users: "User account",
  user_roles: "User role",
  user_ngo_link: "User–NGO link",
  selection_cycles: "Selection cycle",
  interview_questions: "Interview question",
  interview_categories: "Interview category",
  information_session_stats: "Information sessions (numbers)",
  exam_center_stats: "Exam centers (numbers)",
  exam_result_stats: "Exam results (numbers)",
  interview_center_stats: "Interview centers (numbers)",
  interview_result_stats: "Interview results (numbers)",
};
const areaLabel = (table: string) => AREA_LABELS[table] ?? table.replace(/_/g, " ");

const ACTIONS: Record<AuditAction, { label: string; icon: LucideIcon; className: string }> = {
  insert: { label: "Created", icon: FilePlus2, className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  update: { label: "Updated", icon: FilePen, className: "bg-blue-50 text-blue-700 ring-blue-200" },
  soft_delete: { label: "Moved to trash", icon: Trash2, className: "bg-amber-50 text-amber-800 ring-amber-200" },
  delete: { label: "Deleted", icon: FileX2, className: "bg-red-50 text-red-700 ring-red-200" },
};

/** "poor_level" -> "Poor level". */
const fieldLabel = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");

const ALL = "__all__";
const PAGE_SIZE = 50;

function ActionBadge({ action }: { action: AuditAction }) {
  const meta = ACTIONS[action] ?? ACTIONS.update;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1",
        meta.className,
      )}
    >
      <meta.icon className="size-3.5" />
      {meta.label}
    </span>
  );
}

function When({ at }: { at: string }) {
  const date = new Date(at);
  return (
    <div className="whitespace-nowrap" title={date.toString()}>
      <p className="text-sm">{format(date, "dd MMM yyyy, HH:mm")}</p>
      <p className="text-xs text-muted-foreground">{formatDistanceToNow(date, { addSuffix: true })}</p>
    </div>
  );
}

function Subject({ row, onNavigate }: { row: Pick<AuditLogRow, "student" | "label">; onNavigate?: () => void }) {
  if (row.student) {
    return (
      <div className="min-w-0">
        <Link
          href={`/students/${row.student.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.();
          }}
          className="font-medium hover:underline"
        >
          {row.student.name}
        </Link>
        <p className="text-xs text-muted-foreground">{row.student.code}</p>
      </div>
    );
  }
  return <span className={cn(!row.label && "text-muted-foreground")}>{row.label ?? "—"}</span>;
}

function ChangedFields({ fields }: { fields: string[] | null }) {
  if (!fields || fields.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = fields.slice(0, 3).map(fieldLabel);
  return (
    <span className="text-sm" title={fields.map(fieldLabel).join(", ")}>
      {shown.join(", ")}
      {fields.length > 3 && <span className="text-muted-foreground"> +{fields.length - 3} more</span>}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) return format(d, "dd MMM yyyy, HH:mm:ss");
  }
  return text;
}

/** Before/after table for one log entry. */
function DetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setDetail(null);
    setShowAll(false);
    if (!id) return;
    getAuditLog(id)
      .then(setDetail)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load entry"));
  }, [id]);

  const rows = useMemo(() => {
    if (!detail) return [];
    const before = detail.old_data ?? {};
    const after = detail.new_data ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    return keys.map((key) => ({
      key,
      before: before[key],
      after: after[key],
      changed: detail.action === "update" || detail.action === "soft_delete"
        ? JSON.stringify(before[key]) !== JSON.stringify(after[key])
        : true,
    }));
  }, [detail]);

  const isUpdate = detail?.action === "update" || detail?.action === "soft_delete";
  const visible = isUpdate && !showAll ? rows.filter((r) => r.changed && r.key !== "updated_at") : rows;

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {detail ? (
              <>
                <ActionBadge action={detail.action} />
                {areaLabel(detail.table_name)}
              </>
            ) : (
              "Loading..."
            )}
          </DialogTitle>
          {detail && (
            <DialogDescription>
              {detail.actor ? `${detail.actor.full_name} (${detail.actor.email})` : "System / unknown user"} ·{" "}
              {format(new Date(detail.changed_at), "dd MMM yyyy, HH:mm:ss")}
              {detail.student && ` · ${detail.student.name} (${detail.student.code})`}
            </DialogDescription>
          )}
        </DialogHeader>

        {!detail ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="space-y-3">
            {isUpdate && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="text-muted-foreground">
                  {rows.filter((r) => r.changed && r.key !== "updated_at").length} field(s) changed
                </p>
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show changes only" : "Show all fields"}
                </Button>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Field
                    </th>
                    {isUpdate ? (
                      <>
                        <th scope="col" className="px-3 py-2 text-left font-medium">
                          Before
                        </th>
                        <th scope="col" className="px-3 py-2 text-left font-medium">
                          After
                        </th>
                      </>
                    ) : (
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        {detail.action === "insert" ? "Value" : "Value before deletion"}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                        Nothing changed apart from the update time.
                      </td>
                    </tr>
                  ) : (
                    visible.map((r) => (
                      <tr key={r.key} className={cn("border-t align-top", isUpdate && r.changed && "bg-amber-50/40")}>
                        <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {fieldLabel(r.key)}
                        </th>
                        {isUpdate ? (
                          <>
                            <td className="max-w-xs px-3 py-2 break-words whitespace-pre-wrap text-muted-foreground">
                              {r.changed ? <span className="line-through decoration-red-300">{formatValue(r.before)}</span> : formatValue(r.before)}
                            </td>
                            <td className="max-w-xs px-3 py-2 break-words whitespace-pre-wrap">{formatValue(r.after)}</td>
                          </>
                        ) : (
                          <td className="max-w-md px-3 py-2 break-words whitespace-pre-wrap">
                            {formatValue(detail.action === "insert" ? r.after : r.before)}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AuditLogsPage() {
  const { role, loading: roleLoading } = useRole();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ users: { id: string; full_name: string; email: string }[]; tables: string[] }>({
    users: [],
    tables: [],
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userId, setUserId] = useState(ALL);
  const [table, setTable] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const seq = useRef(0);

  const allowed = can(role, "viewAuditLogs");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change starts again from page 1.
  useEffect(() => setPage(1), [debouncedSearch, userId, table, action, from, to]);

  useEffect(() => {
    if (!allowed) return;
    getAuditLogMeta()
      .then(setMeta)
      .catch(() => {});
  }, [allowed]);

  const load = useCallback(() => {
    if (!allowed) return;
    const current = ++seq.current;
    setLoading(true);
    listAuditLogs({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      userId: userId === ALL ? undefined : userId,
      table: table === ALL ? undefined : table,
      action: action === ALL ? undefined : action,
      from: from || undefined,
      to: to || undefined,
    })
      .then((result) => {
        if (current !== seq.current) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load audit logs"))
      .finally(() => {
        if (current === seq.current) setLoading(false);
      });
  }, [allowed, page, debouncedSearch, userId, table, action, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = Boolean(debouncedSearch || userId !== ALL || table !== ALL || action !== ALL || from || to);
  function resetFilters() {
    setSearch("");
    setUserId(ALL);
    setTable(ALL);
    setAction(ALL);
    setFrom("");
    setTo("");
  }

  if (roleLoading) return <Skeleton className="h-64 w-full" />;
  if (!allowed) return <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <History className="size-6 text-muted-foreground" />
          Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground">
          Every change made in the system: who did it, what changed, and when.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search student, student code, user, partner..."
          aria-label="Search audit logs"
          className="sm:w-full"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">User</Label>
            <Select value={userId} onValueChange={(v) => setUserId(v ?? ALL)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) =>
                    v === ALL ? "All users" : v === "system" ? "System / unknown" : meta.users.find((u) => u.id === v)?.full_name ?? "User"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All users</SelectItem>
                {meta.users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
                <SelectItem value="system">System / unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Area</Label>
            <Select value={table} onValueChange={(v) => setTable(v ?? ALL)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => (v === ALL ? "All areas" : areaLabel(v))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All areas</SelectItem>
                {[...meta.tables]
                  .sort((a, b) => areaLabel(a).localeCompare(areaLabel(b)))
                  .map((t) => (
                    <SelectItem key={t} value={t}>
                      {areaLabel(t)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v ?? ALL)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) =>
                    v === ALL ? "All actions" : v === "delete" ? "Deleted / trashed" : ACTIONS[v as AuditAction]?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                <SelectItem value="insert">Created</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="soft_delete">Moved to trash</SelectItem>
                <SelectItem value="delete">Deleted / trashed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input id="audit-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id="audit-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground" aria-live="polite">
            {loading ? "Loading..." : `${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}${filtered ? " match" : ""}`}
          </p>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5">
              <RotateCcw className="size-3.5" />
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  {filtered ? "No activity matches these filters." : "No activity recorded yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  onClick={() => setOpenId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(row.id);
                    }
                  }}
                  className={cn("cursor-pointer", loading && "opacity-60")}
                  aria-label={`Show details: ${ACTIONS[row.action]?.label} ${areaLabel(row.table_name)}`}
                >
                  <TableCell>
                    <When at={row.changed_at} />
                  </TableCell>
                  <TableCell>
                    {row.actor ? (
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{row.actor.full_name}</p>
                        <p className="text-xs text-muted-foreground">{row.actor.email}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">System / unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ActionBadge action={row.action} />
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{areaLabel(row.table_name)}</TableCell>
                  <TableCell className="text-sm">
                    <Subject row={row} />
                  </TableCell>
                  <TableCell>
                    <ChangedFields fields={row.changed_fields} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
          <p className="text-muted-foreground">
            Showing {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="tabular-nums text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <DetailDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
