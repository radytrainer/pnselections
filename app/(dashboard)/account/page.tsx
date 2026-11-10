"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile, updateMyProfile, type UserProfile } from "@/services/userService";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";
import type { ProfileFormValues, PasswordFormValues } from "@/features/account/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMyProfile(user.uid)
      .then(setProfile)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleProfileSubmit(values: ProfileFormValues) {
    if (!user) return;

    await updateMyProfile(user.uid, {
      full_name: values.full_name,
      phone: values.phone || null,
      avatar_url: values.avatar_url || null,
    });
    await updateProfile(user, {
      displayName: values.full_name,
      // Firebase only clears photoURL on an empty string — null is treated
      // as "leave unchanged" and silently keeps the old value.
      photoURL: values.avatar_url || "",
    });
    setProfile((prev) => (prev ? { ...prev, full_name: values.full_name, phone: values.phone || null, avatar_url: values.avatar_url || null } : prev));
  }

  async function handlePasswordSubmit(values: PasswordFormValues) {
    if (!user?.email) return;

    const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, values.newPassword);
  }

  if (!user || loading) {
    return (
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Account</h1>
        <p className="text-sm text-muted-foreground">
          Update your profile photo, name, and password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Visible to other users across the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            firebaseUid={user.uid}
            email={user.email ?? ""}
            defaultValues={{
              full_name: profile?.full_name ?? user.displayName ?? "",
              phone: profile?.phone ?? "",
              avatar_url: profile?.avatar_url ?? "",
            }}
            onSubmit={handleProfileSubmit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Choose a strong password you don&apos;t use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm onSubmit={handlePasswordSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
