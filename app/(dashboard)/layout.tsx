"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (roleLoading || role !== "committee_member") return;
    // Committee members reach a student's full record via the Committee
    // Dossier's "View full profile" link (/students/[id]) — only the list
    // pages themselves are off-limits, not that nested route.
    const blocked =
      pathname === "/students" ||
      pathname === "/reports" ||
      pathname.startsWith("/reports/") ||
      pathname === "/schools" ||
      pathname.startsWith("/schools/") ||
      pathname === "/ngos" ||
      pathname.startsWith("/ngos/");
    if (blocked) router.replace("/committee/queue");
  }, [role, roleLoading, pathname, router]);

  useEffect(() => {
    if (roleLoading || role !== "home_visit_team") return;
    // home_visit_team no longer has NGO/School/Finalist nav entries —
    // block the routes directly too, so typing the URL doesn't work either.
    const blocked =
      pathname === "/ngos" ||
      pathname.startsWith("/ngos/") ||
      pathname === "/schools" ||
      pathname.startsWith("/schools/") ||
      pathname === "/finalist" ||
      pathname.startsWith("/finalist/");
    if (blocked) router.replace("/students");
  }, [role, roleLoading, pathname, router]);

  if (authLoading || roleLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
