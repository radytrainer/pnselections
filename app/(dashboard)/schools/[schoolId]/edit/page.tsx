"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { SchoolForm } from "@/components/forms/SchoolForm";
import { getSchoolPartner, updateSchoolPartner, type SchoolDetail } from "@/services/schoolService";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import type { SchoolFormValues } from "@/features/schools/schema";

export default function EditSchoolPage() {
  const params = useParams<{ schoolId: string }>();
  const router = useRouter();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSchoolPartner(params.schoolId)
      .then(setSchool)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load school partner"))
      .finally(() => setLoading(false));
  }, [params.schoolId]);

  async function handleSubmit(values: SchoolFormValues) {
    await updateSchoolPartner(params.schoolId, {
      school_name: values.school_name,
      logo_url: values.logo_url || null,
      principal_name: values.principal_name || null,
      phone: values.phone || null,
      email: values.email || null,
      province_id: values.province_id || null,
      district_name: values.district_name || null,
    });

    toast.success("School partner updated");
    router.push(`/schools/${params.schoolId}`);
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!school) {
    return <p className="text-sm text-muted-foreground">School partner not found.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/schools/${school.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2.5" })}
      >
        <ArrowLeft className="size-4" />
        Back to {school.school_name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Edit {school.school_name}</h1>
      </div>
      <SchoolForm
        defaultValues={{
          school_name: school.school_name,
          logo_url: school.logo_url ?? "",
          principal_name: school.principal_name ?? "",
          phone: school.phone ?? "",
          email: school.email ?? "",
          province_id: school.province_id ?? "",
          district_name: school.district_name ?? "",
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </div>
  );
}
