"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { listNgosWithStats, type NgoListItemWithStats } from "@/services/ngoService";
import { NgosTable } from "@/components/tables/NgosTable";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/components/layout/RoleGate";
import { OUTREACH_STATUSES, OUTREACH_STATUS_LABELS, type OutreachStatus } from "@/lib/constants";

export default function NgosPage() {
  const [ngos, setNgos] = useState<NgoListItemWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [outreachFilter, setOutreachFilter] = useState<string>("");

  const fetchNgos = useCallback(() => {
    setLoading(true);
    return listNgosWithStats()
      .then(setNgos)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load NGO partners"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNgos();
  }, [fetchNgos]);

  const filtered = useMemo(() => {
    return ngos.filter((ngo) => {
      if (outreachFilter && ngo.outreach_status !== outreachFilter) return false;
      if (search) {
        const haystack = `${ngo.organization_name} ${ngo.contact_person ?? ""}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [ngos, search, outreachFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">NGO Partners</h1>
          <p className="text-sm text-muted-foreground">{ngos.length} partner organizations</p>
        </div>
        <RoleGate capability="managePartners">
          <Link href="/ngos/new" className={buttonVariants()}>
            New NGO Partner
          </Link>
        </RoleGate>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search NGO partners..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={outreachFilter} onValueChange={(value) => setOutreachFilter(value ?? "")}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Outreach Statuses">
              {(value: string) => (value ? OUTREACH_STATUS_LABELS[value as OutreachStatus] ?? value : "All Outreach Statuses")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Outreach Statuses</SelectItem>
            {OUTREACH_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {OUTREACH_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <NgosTable data={filtered} onChanged={fetchNgos} />
      )}
    </div>
  );
}
