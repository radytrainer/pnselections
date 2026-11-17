"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, SearchX, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getStudentColumns, type StudentColumnMeta } from "@/components/tables/columns/students";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentCard } from "@/components/students/StudentCard";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { bulkSoftDeleteStudents, type StudentListItem } from "@/services/studentService";
import type { AppRole } from "@/lib/constants";

const metaClass = (meta: unknown) => (meta as StudentColumnMeta | undefined)?.className;

/** Clicks on these inside a row keep their own behavior instead of opening the profile. */
const INTERACTIVE = "a, button, input, label, [role='checkbox'], [role='menuitem'], [data-slot='tooltip-trigger']";

export function StudentsTable({
  data,
  loading = false,
  page,
  pageSize,
  total,
  onPageChange,
  onChanged,
  onClearFilters,
  role,
  currentUserId,
  photoUrls,
}: {
  data: StudentListItem[];
  loading?: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onChanged: () => void;
  /** Shown in the empty state when filters are active. */
  onClearFilters?: () => void;
  role: AppRole | null;
  currentUserId: string | null;
  photoUrls?: Record<string, string>;
}) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleting, setDeleting] = useState(false);

  const canBulkDelete = can(role, "createEditStudents");

  const selectColumn: ColumnDef<StudentListItem> = useMemo(
    () => ({
      id: "select",
      meta: { className: "w-10" } satisfies StudentColumnMeta,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    }),
    [],
  );

  const columns = useMemo(() => {
    const base = getStudentColumns(onChanged, role, currentUserId, photoUrls);
    return canBulkDelete ? [selectColumn, ...base] : base;
  }, [onChanged, role, currentUserId, canBulkDelete, selectColumn, photoUrls]);

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: canBulkDelete,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedIds.length} student${selectedIds.length === 1 ? "" : "s"}? This can be restored by an admin later.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await bulkSoftDeleteStudents(selectedIds);
      toast.success(`${selectedIds.length} student${selectedIds.length === 1 ? "" : "s"} deleted`);
      setRowSelection({});
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete students");
    } finally {
      setDeleting(false);
    }
  }

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const rows = table.getRowModel().rows;

  const emptyState = (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium">No students found</p>
      <p className="text-sm text-muted-foreground">Try a different name or code, or loosen the filters.</p>
      {onClearFilters && (
        <Button variant="outline" size="sm" className="mt-1" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-3 lg:space-y-0 lg:overflow-hidden lg:rounded-xl lg:border lg:bg-card lg:shadow-xs">
      {canBulkDelete && selectedIds.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-lg border bg-primary/5 px-4 py-2 backdrop-blur lg:static lg:rounded-none lg:border-0 lg:border-b">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setRowSelection({})}
              aria-label="Clear selection"
            >
              <X />
            </Button>
            {selectedIds.length} selected
          </div>
          <Button variant="destructive" size="sm" disabled={deleting} onClick={handleBulkDelete}>
            <Trash2 />
            {deleting ? "Deleting..." : `Delete ${selectedIds.length}`}
          </Button>
        </div>
      )}

      {/* Desktop: full table */}
      <div className="hidden lg:block">
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-10 text-xs font-medium tracking-wide text-muted-foreground uppercase first:pl-4 last:pr-4",
                    metaClass(header.column.columnDef.meta),
                  )}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                {headers.map((h) => (
                  <TableCell
                    key={h.id}
                    className={cn("py-3 first:pl-4 last:pr-4", metaClass(h.column.columnDef.meta))}
                  >
                    {h.column.id === "name" ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ) : h.column.id === "select" ? (
                      <Skeleton className="size-4" />
                    ) : (
                      <Skeleton className="h-3.5 w-16" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
                  if (window.getSelection()?.toString()) return; // let people copy text
                  router.push(`/students/${row.original.id}`);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn("py-2.5 first:pl-4 last:pr-4", metaClass(cell.column.columnDef.meta))}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-16">
                {emptyState}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      {/* Phone / tablet: cards with the essentials; details expand on tap */}
      <div className="space-y-2 lg:hidden">
        {canBulkDelete && !loading && rows.length > 0 && (
          <label className="flex w-fit items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              aria-label="Select all on this page"
            />
            Select all on this page
          </label>
        )}
        {loading ? (
          <ul className="grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </li>
            ))}
          </ul>
        ) : rows.length ? (
          <ul className="grid gap-2">
            {rows.map((row) => (
              <StudentCard
                key={row.id}
                student={row.original}
                photoUrls={photoUrls ?? {}}
                role={role}
                currentUserId={currentUserId}
                onChanged={onChanged}
                selectable={canBulkDelete}
                selected={row.getIsSelected()}
                onSelectedChange={(v) => row.toggleSelected(v)}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border bg-card px-4 py-12">{emptyState}</div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:rounded-none lg:border-0 lg:border-t lg:bg-transparent">
        <span>
          {total === 0 ? (
            "No results"
          ) : (
            <>
              Showing <span className="font-medium text-foreground">{from}–{to}</span> of{" "}
              <span className="font-medium text-foreground">{total}</span>
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="mr-1 tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= pageCount || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
