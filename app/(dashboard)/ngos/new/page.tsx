"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { NgoForm } from "@/components/forms/NgoForm";
import { createNgo } from "@/services/ngoService";
import { buttonVariants } from "@/components/ui/button";
import type { NgoFormValues } from "@/features/ngos/schema";

export default function NewNgoPage() {
  const router = useRouter();

  async function handleSubmit(values: NgoFormValues) {
    const ngo = await createNgo({
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

    toast.success(`${ngo.organization_name} created`);
    router.push(`/ngos/${ngo.id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/ngos"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2.5" })}
      >
        <ArrowLeft className="size-4" />
        Back to NGO Partners
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">New NGO Partner</h1>
        <p className="text-sm text-muted-foreground">
          Register a referring or local partner organization.
        </p>
      </div>
      <NgoForm onSubmit={handleSubmit} submitLabel="Create NGO Partner" />
    </div>
  );
}
