"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";
import { getNgo, getNgoPerformance, type NgoDetail } from "@/services/ngoService";
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

export default function NgoDetailPage() {
  const params = useParams<{ ngoId: string }>();
  const [ngo, setNgo] = useState<NgoDetail | null>(null);
  const [performance, setPerformance] = useState<{ referred: number; selected: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getNgo(params.ngoId), getNgoPerformance(params.ngoId)])
      .then(([ngoData, perf]) => {
        setNgo(ngoData);
        setPerformance(perf);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load NGO partner"))
      .finally(() => setLoading(false));
  }, [params.ngoId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!ngo) {
    return <p className="text-sm text-muted-foreground">NGO partner not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/ngos"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2.5" })}
      >
        <ArrowLeft className="size-4" />
        Back to NGO Partners
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={ngo.logo_url ?? undefined} alt={ngo.organization_name} />
            <AvatarFallback className="text-base">{initials(ngo.organization_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{ngo.organization_name}</h1>
            <p className="text-sm text-muted-foreground">
              {[ngo.district_name, ngo.provinces?.name_en].filter(Boolean).join(", ") || "No location set"}
            </p>
          </div>
        </div>
        <RoleGate capability="managePartners">
          <Link href={`/ngos/${ngo.id}/edit`} className={buttonVariants({ variant: "outline" })}>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Contact Person: {ngo.contact_person ?? "—"}</p>
            <p>Phone: {ngo.phone ?? "—"}</p>
            <p>Email: {ngo.email ?? "—"}</p>
            <p>Website: {ngo.website ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Initiatives run by this NGO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {ngo.ngo_projects.length === 0 ? (
              <p className="text-muted-foreground">No projects recorded.</p>
            ) : (
              ngo.ngo_projects.map((project) => (
                <div key={project.id}>
                  <p className="font-medium">{project.name}</p>
                  {project.description && (
                    <p className="text-muted-foreground">{project.description}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {ngo.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{ngo.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
