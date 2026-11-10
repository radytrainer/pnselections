"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FirebaseError } from "firebase/app";
import { passwordFormSchema, type PasswordFormValues } from "@/features/account/schema";
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

const FRIENDLY_ERRORS: Record<string, string> = {
  "auth/wrong-password": "Current password is incorrect.",
  "auth/invalid-credential": "Current password is incorrect.",
  "auth/weak-password": "Choose a stronger password (at least 6 characters).",
  "auth/requires-recent-login": "Please sign out and back in, then try again.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
};

export function ChangePasswordForm({
  onSubmit,
}: {
  onSubmit: (values: PasswordFormValues) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function handleSubmit(values: PasswordFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      toast.success("Password updated");
      form.reset();
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : undefined;
      toast.error(
        (code && FRIENDLY_ERRORS[code]) ??
          (error instanceof Error ? error.message : "Failed to update password"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          Update Password
        </Button>
      </form>
    </Form>
  );
}
