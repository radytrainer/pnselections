"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getSignedStudentDocumentUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Thumbnail widths the API serves (api/src/routes/files.ts THUMB_WIDTHS). */
const THUMB_WIDTHS = [48, 64, 96, 128, 192, 256, 384, 512, 768];

function pickThumbWidth(px: number) {
  return THUMB_WIDTHS.find((w) => w >= px) ?? THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
}

/** Largest rendered size from Tailwind classes like "size-24 sm:size-28" (1 unit = 4px). */
function displayPixels(sizeClass: string) {
  const units = [...sizeClass.matchAll(/size-(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  return units.length ? Math.max(...units) * 4 : 40;
}

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
  zoomable = false,
  alt = "",
  displayWidth,
}: {
  photoPath: string | null;
  signedUrl?: string | null;
  initials: string;
  size?: string;
  /** "square" for a larger, clearer portrait view (e.g. a profile card); "circle" everywhere else. */
  shape?: "circle" | "square";
  className?: string;
  /** Click the photo to view it full size. */
  zoomable?: boolean;
  /** Shown as the title of the full-size view. */
  alt?: string;
  /** Rendered width in CSS px when `size` isn't a fixed size-N class (e.g. a full-width card photo). */
  displayWidth?: number;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(signedUrl ?? null);
  const [open, setOpen] = useState(false);
  // The file can be missing (e.g. photos not carried over from the old
  // storage) — fall back to initials instead of a broken image.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [resolvedUrl]);

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

  if (resolvedUrl && !failed) {
    // Ask the API for a thumbnail sized for this spot (1x and 2x screens):
    // a big photo shrunk ~30x by the browser in one step looks blurry.
    const px = displayWidth ?? displayPixels(size);
    const thumb = (w: number) => `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}w=${w}`;
    const image = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumb(pickThumbWidth(px))}
        srcSet={`${thumb(pickThumbWidth(px))} 1x, ${thumb(pickThumbWidth(px * 2))} 2x, ${thumb(pickThumbWidth(px * 3))} 3x`}
        alt={alt}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn(size, "shrink-0 object-cover", shapeClass, className)}
      />
    );
    if (!zoomable) return image;
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn("shrink-0 cursor-zoom-in", shapeClass)}
          aria-label="View photo full size"
        >
          {image}
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-auto max-w-[95vw] p-2 sm:max-w-3xl">
            <DialogTitle className="sr-only">{alt || "Student photo"}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedUrl} alt={alt} className="max-h-[85vh] w-auto rounded-lg object-contain" />
          </DialogContent>
        </Dialog>
      </>
    );
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
