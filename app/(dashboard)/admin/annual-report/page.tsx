"use client";

import { AnnualReportEditor } from "@/components/annual-report/AnnualReportEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";

/** Configuration → Annual Report: write the yearly selection report and download it as PDF or Word. */
export default function AnnualReportPage() {
  const { role, loading } = useRole();
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!can(role, "manageAnnualReport")) return <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>;
  return <AnnualReportEditor />;
}
