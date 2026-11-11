import { api, downloadFile } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Audit logs (Configuration → Audit Logs)
// ---------------------------------------------------------------------------
export type AuditAction = "insert" | "update" | "delete" | "soft_delete";

export type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  changed_at: string;
  actor: { id: string; full_name: string; email: string } | null;
  student: { id: string; name: string; code: string } | null;
  /** Name of the partner / user / cycle / question the row is about, when it has one. */
  label: string | null;
  /** Fields that changed (updates only). */
  changed_fields: string[] | null;
};

export type AuditLogDetail = Omit<AuditLogRow, "label" | "changed_fields"> & {
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

export type AuditLogFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  table?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
};

export async function listAuditLogs(filters: AuditLogFilters) {
  return api.get<{ rows: AuditLogRow[]; total: number; page: number; pageSize: number }>("/api/v1/audit-logs", {
    ...filters,
    page: filters.page ? String(filters.page) : undefined,
    pageSize: filters.pageSize ? String(filters.pageSize) : undefined,
  });
}

export async function getAuditLogMeta() {
  return api.get<{ users: { id: string; full_name: string; email: string }[]; tables: string[] }>(
    "/api/v1/audit-logs/meta",
  );
}

export async function getAuditLog(id: string) {
  return api.get<AuditLogDetail>(`/api/v1/audit-logs/${id}`);
}

// ---------------------------------------------------------------------------
// Backup (Configuration → Backup)
// ---------------------------------------------------------------------------
export type BackupTable = { name: string; rows: number | null };

export async function listBackupTables() {
  return api.get<BackupTable[]>("/api/v1/backup/tables");
}

export async function downloadSqlBackup(tables?: string[]) {
  const query = tables ? `?tables=${encodeURIComponent(tables.join(","))}` : "";
  return downloadFile(`/api/v1/backup/sql${query}`, "pn-selection-backup.sql");
}

export async function getBackupData(tables: string[]) {
  return api.get<{
    createdAt: string;
    tables: { name: string; columns: string[]; rows: Record<string, unknown>[]; error?: string }[];
  }>("/api/v1/backup/data", { tables: tables.join(",") });
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------
export async function emptyTrash() {
  return api.post<{ deleted: number }>("/api/v1/students/trash/empty");
}
