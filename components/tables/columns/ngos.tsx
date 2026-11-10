"use client";

import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGate } from "@/components/layout/RoleGate";
import { OUTREACH_STATUSES, OUTREACH_STATUS_LABELS, type OutreachStatus } from "@/lib/constants";
import { initials } from "@/lib/initials";
import {
  softDeleteNgo,
  updateNgoOutreachStatus,
  type NgoListItemWithStats,
} from "@/services/ngoService";

function StatPill({ value, emphasis }: { value: number; emphasis?: boolean }) {
  return (
    <span
      className={
        emphasis
          ? "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
          : "inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs font-medium text-muted-foreground"
      }
    >
      {value}
    </span>
  );
}

export function getNgoColumns(onChanged: () => void): ColumnDef<NgoListItemWithStats>[] {
  return [
    {
      id: "logo",
      header: "",
      cell: ({ row }) => (
        <Avatar>
          <AvatarImage src={row.original.logo_url ?? undefined} alt={row.original.organization_name} />
          <AvatarFallback>{initials(row.original.organization_name)}</AvatarFallback>
        </Avatar>
      ),
    },
    {
      accessorKey: "organization_name",
      header: "NGO",
      cell: ({ row }) => (
        <div>
          <Link href={`/ngos/${row.original.id}`} className="font-medium hover:underline">
            {row.original.organization_name}
          </Link>
          {row.original.website && (
            <a
              href={row.original.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3" />
              Website
            </a>
          )}
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => (
        <div className="text-sm">
          <p>{row.original.contact_person ?? "—"}</p>
          <p className="text-muted-foreground">{row.original.phone ?? row.original.email ?? ""}</p>
        </div>
      ),
    },
    {
      id: "province",
      header: "Province",
      cell: ({ row }) => row.original.provinces?.name_en ?? "—",
    },
    {
      id: "outreach",
      header: "Outreach",
      cell: ({ row }) => (
        <div>
          <Select
            value={row.original.outreach_status}
            onValueChange={async (value) => {
              if (!value) return;
              try {
                await updateNgoOutreachStatus(row.original.id, value as OutreachStatus);
                onChanged();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to update outreach status");
              }
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {(value: string) => OUTREACH_STATUS_LABELS[value as OutreachStatus] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {OUTREACH_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {row.original.last_contacted_at && (
            <p className="mt-1 text-xs text-muted-foreground">Last: {row.original.last_contacted_at}</p>
          )}
        </div>
      ),
    },
    {
      id: "referred",
      header: "Referred",
      cell: ({ row }) => <StatPill value={row.original.referred} />,
    },
    {
      id: "selected",
      header: "Selected",
      cell: ({ row }) => <StatPill value={row.original.selected} />,
    },
    {
      id: "this_cycle",
      header: "This Cycle",
      cell: ({ row }) => <StatPill value={row.original.referredThisCycle} emphasis />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <RoleGate capability="managePartners">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem render={<Link href={`/ngos/${row.original.id}/edit`} />}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  if (!window.confirm(`Delete NGO partner "${row.original.organization_name}"?`)) {
                    return;
                  }
                  try {
                    await softDeleteNgo(row.original.id);
                    toast.success("NGO partner deleted");
                    onChanged();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to delete NGO partner");
                  }
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RoleGate>
      ),
    },
  ];
}
