"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { getNgoColumns } from "@/components/tables/columns/ngos";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGate } from "@/components/layout/RoleGate";
import { softDeleteNgo, type NgoListItemWithStats } from "@/services/ngoService";

export function NgosTable({
  data,
  onChanged,
}: {
  data: NgoListItemWithStats[];
  onChanged: () => void;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo<ColumnDef<NgoListItemWithStats>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(checked === true)} />
        ),
      },
      ...getNgoColumns(onChanged),
    ],
    [onChanged],
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} NGO partner${selectedIds.length === 1 ? "" : "s"}?`)) {
      return;
    }
    setDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => softDeleteNgo(id)));
      toast.success(`Deleted ${selectedIds.length} NGO partner${selectedIds.length === 1 ? "" : "s"}`);
      setRowSelection({});
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected NGOs");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <RoleGate capability="managePartners">
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
            <p className="text-sm">{selectedIds.length} selected</p>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={handleBulkDelete}>
              <Trash2 className="size-4" />
              Delete Selected
            </Button>
          </div>
        </RoleGate>
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
                <TableRow key={row.id}>
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
                  No NGO partners found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
