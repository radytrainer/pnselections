import { api } from "@/lib/api/client";
import type { Database } from "@/types/database.types";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

export async function getMyProfile(firebaseUid: string): Promise<UserProfile | null> {
  return api.get<UserProfile | null>(`/api/v1/users/by-firebase-uid/${encodeURIComponent(firebaseUid)}`);
}

export async function updateMyProfile(
  firebaseUid: string,
  values: { full_name: string; phone: string | null; avatar_url: string | null },
): Promise<void> {
  await api.patch(`/api/v1/users/by-firebase-uid/${encodeURIComponent(firebaseUid)}`, values);
}
