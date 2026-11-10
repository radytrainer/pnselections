"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getStudentColumns } from "@/components/tables/columns/students";
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
import { can } from "@/lib/rbac";
import { bulkSoftDeleteStudents, type StudentListItem } from "@/services/studentService";
import type { AppRole } from "@/lib/constants";

export function StudentsTable({
  data,
  page,
  pageSize,
  total,
  onPageChange,
  onChanged,
  role,
  currentUserId,
  photoUrls,
}: {
  data: StudentListItem[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onChanged: () => void;
  role: AppRole | null;
  currentUserId: string | null;
  photoUrls?: Record<string, string>;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleting, setDeleting] = useState(false);

  const canBulkDelete = can(role, "createEditStudents");

  const selectColumn: ColumnDef<StudentListItem> = useMemo(
    () => ({
      id: "select",
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
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: canBulkDelete,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  const selectedIds = table
    .getSelectedRowModel()
    .rows.map((r) => r.original.id);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

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

  return (
    <div className="space-y-3">
      {canBulkDelete && selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2">
          <span className="text-sm font-medium text-destructive">
            {selectedIds.length} student{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={handleBulkDelete}
          >
            <Trash2 className="size-4" />
            {deleting ? "Deleting..." : `Delete ${selectedIds.length}`}
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No students found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {pageCount} ({total} students)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
