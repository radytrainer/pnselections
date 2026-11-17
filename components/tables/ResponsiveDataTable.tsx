"use client";

import { useId, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Where a column goes on the phone/tablet card:
 *  - media    picture/avatar on the left
 *  - title    the main line (name/link); the card's heading
 *  - summary  short facts always visible under the title (status, counts…)
 *  - detail   shown with its label only when the card is expanded
 *  - actions  buttons/menu at the card's top-right
 *  - hidden   desktop table only
 */
export type CardSlot = "media" | "title" | "summary" | "detail" | "actions" | "hidden";

export type ResponsiveColumnMeta<T> = {
  card?: CardSlot;
  /** Label in the expanded details (defaults to the column header when it's a string). */
  label?: string;
  /** Different, more compact content for the card than the table cell. */
  cardCell?: (row: T) => React.ReactNode;
  /** Extra classes for the desktop <th>/<td>. */
  className?: string;
};

function meta<T>(col: ColumnDef<T>): ResponsiveColumnMeta<T> {
  return (col.meta as ResponsiveColumnMeta<T> | undefined) ?? {};
}

/**
 * A list that's a table on computers (lg and up) and a stack of expandable
 * cards on phones and tablets — both rendered from the same column defs.
 */
export function ResponsiveDataTable<T>({
  data,
  columns,
  getRowId,
  empty,
  loading = false,
  selectable = false,
  rowSelection,
  onRowSelectionChange,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  empty: React.ReactNode;
  loading?: boolean;
  /** Adds a checkbox column (table) / checkbox (cards). Selection state is the caller's. */
  selectable?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (next: RowSelectionState) => void;
}) {
  const allColumns = useMemo<ColumnDef<T>[]>(() => {
    if (!selectable) return columns;
    const select: ColumnDef<T> = {
      id: "__select",
      meta: { card: "hidden", className: "w-10" } satisfies ResponsiveColumnMeta<T>,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(v === true)} aria-label="Select row" />
      ),
    };
    return [select, ...columns];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: selectable,
    state: { rowSelection: rowSelection ?? {} },
    onRowSelectionChange: (updater) => {
      if (!onRowSelectionChange) return;
      onRowSelectionChange(typeof updater === "function" ? updater(rowSelection ?? {}) : updater);
    },
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      {/* Computers: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs lg:block">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className={cn(
                      "h-10 text-xs font-medium tracking-wide text-muted-foreground uppercase first:pl-4 last:pr-4",
                      meta(h.column.columnDef).className,
                    )}
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {allColumns.map((c, j) => (
                    <TableCell key={j} className="py-3 first:pl-4 last:pr-4">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("py-2.5 first:pl-4 last:pr-4", meta(cell.column.columnDef).className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="h-24 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Phones / tablets: cards */}
      <div className="space-y-2 lg:hidden">
        {selectable && !loading && rows.length > 0 && (
          <label className="flex w-fit items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
            />
            Select all
          </label>
        )}
        {loading ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
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
          <ul className="grid items-start gap-2 md:grid-cols-2">
            {rows.map((row) => (
              <DataCard key={row.id} row={row} columns={columns} selectable={selectable} />
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">{empty}</div>
        )}
      </div>
    </div>
  );
}

function renderFor<T>(col: ColumnDef<T>, row: Row<T>): React.ReactNode {
  const m = meta(col);
  if (m.cardCell) return m.cardCell(row.original);
  const cell = row.getAllCells().find((c) => c.column.id === (col.id ?? (col as { accessorKey?: string }).accessorKey));
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null;
}

function DataCard<T>({ row, columns, selectable }: { row: Row<T>; columns: ColumnDef<T>[]; selectable: boolean }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const by = (slot: CardSlot) => columns.filter((c) => meta(c).card === slot);
  const media = by("media");
  const title = by("title");
  const summary = by("summary");
  const details = by("detail");
  const actions = by("actions");

  return (
    <li className={cn("rounded-xl border bg-card shadow-xs", row.getIsSelected() && "border-primary/40 bg-primary/5")}>
      <div className="flex items-start gap-3 p-3">
        {selectable && (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
            aria-label="Select"
            className="mt-2.5"
          />
        )}
        {media.map((c, i) => (
          <div key={i} className="shrink-0">
            {renderFor(c, row)}
          </div>
        ))}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="min-w-0">
            {title.map((c, i) => (
              <div key={i} className="min-w-0 break-words">
                {renderFor(c, row)}
              </div>
            ))}
          </div>
          {summary.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {summary.map((c, i) => (
                <span key={i} className="inline-flex min-w-0 items-center gap-1.5">
                  {renderFor(c, row)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="-mr-1 flex shrink-0 items-center gap-0.5">
          {actions.map((c, i) => (
            <div key={i}>{renderFor(c, row)}</div>
          ))}
          {details.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={detailsId}
              aria-label={open ? "Hide details" : "Show details"}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
          )}
        </div>
      </div>
      {open && details.length > 0 && (
        <dl id={detailsId} className="grid grid-cols-2 gap-x-4 gap-y-3 border-t px-3 py-3 text-sm sm:grid-cols-3">
          {details.map((c, i) => {
            const m = meta(c);
            const label = m.label ?? (typeof c.header === "string" ? c.header : "");
            return (
              <div key={i} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 break-words">{renderFor(c, row)}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </li>
  );
}
