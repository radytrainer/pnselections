"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { getSignedStudentDocumentUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Renders a student's photo, or an initials circle if none is set yet.
 * Photos live in a private bucket (see migration 0012), so they're never
 * rendered from a plain public URL — pass either a pre-resolved `signedUrl`
 * (bulk-loaded lists, to avoid one signed-URL request per row) or just
 * `photoPath` to have this component fetch its own signed URL.
 */
export function StudentAvatar({
  photoPath,
  signedUrl,
  initials,
  size = "size-10",
  shape = "circle",
  className,
}: {
  photoPath: string | null;
  signedUrl?: string | null;
  initials: string;
  size?: string;
  /** "square" for a larger, clearer portrait view (e.g. a profile card); "circle" everywhere else. */
  shape?: "circle" | "square";
  className?: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(signedUrl ?? null);

  useEffect(() => {
    if (signedUrl !== undefined) {
      setResolvedUrl(signedUrl);
      return;
    }
    if (!photoPath) {
      setResolvedUrl(null);
      return;
    }
    let cancelled = false;
    getSignedStudentDocumentUrl(photoPath).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [photoPath, signedUrl]);

  const shapeClass = shape === "square" ? "rounded-xl" : "rounded-full";

  if (resolvedUrl) {
    // Signed URLs carry a per-request token and an expiry — not a stable
    // asset next/image can cache/optimize, so a plain <img> is the right call.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resolvedUrl} alt="" className={cn(size, "shrink-0 object-cover", shapeClass, className)} />;
  }

  return (
    <div
      className={cn(
        size,
        "flex shrink-0 items-center justify-center bg-primary/10 font-semibold text-primary",
        shapeClass,
        className,
      )}
    >
      {initials || <User className="size-1/2" />}
    </div>
  );
}
