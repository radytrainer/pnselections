"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";
import { getSchoolPartner, getSchoolPerformance, type SchoolDetail } from "@/services/schoolService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { RoleGate } from "@/components/layout/RoleGate";
import { initials } from "@/lib/initials";

export default function SchoolDetailPage() {
  const params = useParams<{ schoolId: string }>();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [performance, setPerformance] = useState<{ referred: number; selected: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSchoolPartner(params.schoolId), getSchoolPerformance(params.schoolId)])
      .then(([schoolData, perf]) => {
        setSchool(schoolData);
        setPerformance(perf);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load school partner"))
      .finally(() => setLoading(false));
  }, [params.schoolId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!school) {
    return <p className="text-sm text-muted-foreground">School partner not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/schools"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2.5" })}
      >
        <ArrowLeft className="size-4" />
        Back to School Partners
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={school.logo_url ?? undefined} alt={school.school_name} />
            <AvatarFallback className="text-base">{initials(school.school_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{school.school_name}</h1>
            <p className="text-sm text-muted-foreground">
              {[school.district_name, school.provinces?.name_en].filter(Boolean).join(", ") ||
                "No location set"}
            </p>
          </div>
        </div>
        <RoleGate capability="managePartners">
          <Link href={`/schools/${school.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </RoleGate>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Students Referred</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{performance?.referred ?? "—"}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Students Selected</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{performance?.selected ?? "—"}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Selection Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">
              {performance && performance.referred > 0
                ? `${Math.round((performance.selected / performance.referred) * 100)}%`
                : "—"}
            </CardTitle>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Principal: {school.principal_name ?? "—"}</p>
          <p>Phone: {school.phone ?? "—"}</p>
          <p>Email: {school.email ?? "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
