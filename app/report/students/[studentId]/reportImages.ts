/** A photo prepared for the report: JPEG, scaled down, usable on screen (url) and in Word (data). */
export type ReportImage = { url: string; data: ArrayBuffer; width: number; height: number };

/**
 * Converts any image the browser can read (JPEG, PNG, WebP…) to a JPEG no
 * larger than `maxSide` pixels, so the Word file stays small and every image
 * has a type Word understands.
 */
export async function toReportImage(source: Blob, maxSide = 1400): Promise<ReportImage> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare images");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.85),
  );
  return { url: URL.createObjectURL(blob), data: await blob.arrayBuffer(), width, height };
}

/** Loads an image from a URL (same-origin, with the session cookie) as a ReportImage, or null. */
export async function fetchReportImage(url: string, maxSide?: number): Promise<ReportImage | null> {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    return await toReportImage(await res.blob(), maxSide);
  } catch {
    return null;
  }
}
