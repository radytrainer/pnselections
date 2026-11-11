"use client";

import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { uploadAvatar } from "@/lib/storage";

export function AvatarUploadField({
  value,
  onChange,
  fallback,
  firebaseUid,
}: {
  value: string;
  onChange: (url: string) => void;
  fallback: string;
  firebaseUid: string;
}) {
  return (
    <ImageUploadField
      value={value}
      onChange={onChange}
      fallback={fallback}
      accept="image/png,image/jpeg,image/webp"
      hint="PNG, JPEG, or WebP. Large phone photos are resized automatically."
      upload={(file) => uploadAvatar(file, firebaseUid)}
      avatarClassName="size-20"
    />
  );
}
