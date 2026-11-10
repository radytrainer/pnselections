"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { SchoolForm } from "@/components/forms/SchoolForm";
import { createSchoolPartner } from "@/services/schoolService";
import { buttonVariants } from "@/components/ui/button";
import type { SchoolFormValues } from "@/features/schools/schema";

export default function NewSchoolPage() {
  const router = useRouter();

  async function handleSubmit(values: SchoolFormValues) {
    const school = await createSchoolPartner({
      school_name: values.school_name,
      logo_url: values.logo_url || null,
      principal_name: values.principal_name || null,
      phone: values.phone || null,
      email: values.email || null,
      province_id: values.province_id || null,
      district_name: values.district_name || null,
    });

    toast.success(`${school.school_name} created`);
    router.push(`/schools/${school.id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/schools"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2.5" })}
      >
        <ArrowLeft className="size-4" />
        Back to School Partners
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">New School Partner</h1>
        <p className="text-sm text-muted-foreground">
          Register a school that refers students into the selection pipeline.
        </p>
      </div>
      <SchoolForm onSubmit={handleSubmit} submitLabel="Create School Partner" />
    </div>
  );
}
