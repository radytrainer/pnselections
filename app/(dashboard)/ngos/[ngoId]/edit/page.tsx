"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { NgoForm } from "@/components/forms/NgoForm";
import { getNgo, updateNgo, type NgoDetail } from "@/services/ngoService";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import type { NgoFormValues } from "@/features/ngos/schema";

export default function EditNgoPage() {
  const params = useParams<{ ngoId: string }>();
  const router = useRouter();
  const [ngo, setNgo] = useState<NgoDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNgo(params.ngoId)
      .then(setNgo)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load NGO partner"))
      .finally(() => setLoading(false));
  }, [params.ngoId]);

  async function handleSubmit(values: NgoFormValues) {
    await updateNgo(params.ngoId, {
      organization_name: values.organization_name,
      logo_url: values.logo_url || null,
      contact_person: values.contact_person || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      province_id: values.province_id || null,
      district_name: values.district_name || null,
      notes: values.notes || null,
    });

    toast.success("NGO partner updated");
    router.push(`/ngos/${params.ngoId}`);
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!ngo) {
    return <p className="text-sm text-muted-foreground">NGO partner not found.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/ngos/${ngo.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2.5" })}
      >
        <ArrowLeft className="size-4" />
        Back to {ngo.organization_name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Edit {ngo.organization_name}</h1>
      </div>
      <NgoForm
        defaultValues={{
          organization_name: ngo.organization_name,
          logo_url: ngo.logo_url ?? "",
          contact_person: ngo.contact_person ?? "",
          phone: ngo.phone ?? "",
          email: ngo.email ?? "",
          website: ngo.website ?? "",
          province_id: ngo.province_id ?? "",
          district_name: ngo.district_name ?? "",
          notes: ngo.notes ?? "",
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </div>
  );
}
