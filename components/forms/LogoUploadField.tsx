"use client";

import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { uploadPartnerLogo } from "@/lib/storage";

export function LogoUploadField({
  value,
  onChange,
  kind,
  fallback,
}: {
  value: string;
  onChange: (url: string) => void;
  kind: "ngos" | "schools";
  fallback: string;
}) {
  return (
    <ImageUploadField
      value={value}
      onChange={onChange}
      fallback={fallback}
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      hint="PNG, JPEG, WebP, or SVG — up to 2MB."
      upload={(file) => uploadPartnerLogo(file, kind)}
    />
  );
}
