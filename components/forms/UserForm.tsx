"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserValues,
  type UpdateUserValues,
} from "@/features/admin/schema";
import { listNgos, type NgoListItem } from "@/services/ngoService";
import { APP_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type UserFormValues = CreateUserValues | UpdateUserValues;

export function UserForm({
  mode = "create",
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  mode?: "create" | "edit";
  defaultValues?: Partial<UserFormValues>;
  onSubmit: (values: UserFormValues) => Promise<void>;
  submitLabel?: string;
}) {
  const [ngos, setNgos] = useState<NgoListItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(mode === "edit" ? updateUserSchema : createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      role: "selection_team",
      ngoId: "",
      ...defaultValues,
    },
  });

  const role = form.watch("role");

  useEffect(() => {
    if (role === "ngo_partner") {
      listNgos().then(setNgos).catch(() => toast.error("Failed to load NGOs"));
    }
  }, [role]);

  async function handleSubmit(values: UserFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      if (mode === "create") form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{mode === "edit" ? "New Password (leave blank to keep current)" : "Password"}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role">
                      {(value: string) => value.replace(/_/g, " ")}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {role === "ngo_partner" && (
          <FormField
            control={form.control}
            name="ngoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NGO</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select NGO">
                        {(value: string) => ngos.find((ngo) => ngo.id === value)?.organization_name}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ngos.map((ngo) => (
                      <SelectItem key={ngo.id} value={ngo.id}>
                        {ngo.organization_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel ?? (mode === "edit" ? "Save Changes" : "Create User")}
        </Button>
      </form>
    </Form>
  );
}
