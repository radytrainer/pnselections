"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ngoFormSchema, type NgoFormValues } from "@/features/ngos/schema";
import { listProvinces } from "@/services/lookupService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LogoUploadField } from "@/components/forms/LogoUploadField";
import { initials } from "@/lib/initials";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LookupOption = { id: string; name_en: string };

export function NgoForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save NGO Partner",
}: {
  defaultValues?: Partial<NgoFormValues>;
  onSubmit: (values: NgoFormValues) => Promise<void>;
  submitLabel?: string;
}) {
  const [provinces, setProvinces] = useState<LookupOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NgoFormValues>({
    resolver: zodResolver(ngoFormSchema),
    defaultValues: {
      organization_name: "",
      logo_url: "",
      contact_person: "",
      phone: "",
      email: "",
      website: "",
      province_id: "",
      district_name: "",
      notes: "",
      ...defaultValues,
    },
  });

  const organizationName = form.watch("organization_name");

  useEffect(() => {
    listProvinces().then(setProvinces).catch(() => toast.error("Failed to load provinces"));
  }, []);

  async function handleSubmit(values: NgoFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save NGO partner");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="logo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo</FormLabel>
              <FormControl>
                <LogoUploadField
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  kind="ngos"
                  fallback={initials(organizationName || "NGO")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="organization_name"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contact_person"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="province_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Province</FormLabel>
                <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select province">
                        {(value: string) => provinces.find((p) => p.id === value)?.name_en}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="district_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>District</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Serei Saophoan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}
