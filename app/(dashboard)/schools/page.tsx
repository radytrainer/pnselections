"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { listSchoolPartnersWithStats, type SchoolListItemWithStats } from "@/services/schoolService";
import { SchoolsTable } from "@/components/tables/SchoolsTable";
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

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolListItemWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [outreachFilter, setOutreachFilter] = useState<string>("");

  const fetchSchools = useCallback(() => {
    setLoading(true);
    return listSchoolPartnersWithStats()
      .then(setSchools)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load school partners"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const filtered = useMemo(() => {
    return schools.filter((school) => {
      if (outreachFilter && school.outreach_status !== outreachFilter) return false;
      if (search) {
        const haystack = `${school.school_name} ${school.principal_name ?? ""}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [schools, search, outreachFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">School Partners</h1>
          <p className="text-sm text-muted-foreground">{schools.length} partner schools</p>
        </div>
        <RoleGate capability="managePartners">
          <Link href="/schools/new" className={buttonVariants()}>
            New School Partner
          </Link>
        </RoleGate>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search school partners..."
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
        <SchoolsTable data={filtered} onChanged={fetchSchools} />
      )}
    </div>
  );
}
