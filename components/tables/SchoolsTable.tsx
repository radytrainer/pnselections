"use client";

import { useMemo, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { getSchoolColumns } from "@/components/tables/columns/schools";
import { ResponsiveDataTable } from "@/components/tables/ResponsiveDataTable";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/layout/RoleGate";
import { softDeleteSchoolPartner, type SchoolListItemWithStats } from "@/services/schoolService";

export function SchoolsTable({
  data,
  onChanged,
}: {
  data: SchoolListItemWithStats[];
  onChanged: () => void;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo(() => getSchoolColumns(onChanged), [onChanged]);
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} school partner${selectedIds.length === 1 ? "" : "s"}?`)) {
      return;
    }
    setDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => softDeleteSchoolPartner(id)));
      toast.success(`Deleted ${selectedIds.length} school partner${selectedIds.length === 1 ? "" : "s"}`);
      setRowSelection({});
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected schools");
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
      <ResponsiveDataTable
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        empty="No school partners found."
        selectable
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />
    </div>
  );
}
