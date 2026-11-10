import { api, API_BASE_URL } from "@/lib/api/client";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_STUDENT_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validateLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return "Logo must be a PNG, JPEG, WebP, or SVG image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Logo must be 2MB or smaller.";
  }
  return null;
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return "Photo must be a PNG, JPEG, or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Photo must be 2MB or smaller.";
  }
  return null;
}

export function validateStudentPhotoFile(file: File): string | null {
  if (!ALLOWED_STUDENT_PHOTO_TYPES.includes(file.type)) {
    return "Photo must be a PNG, JPEG, or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Photo must be 2MB or smaller.";
  }
  return null;
}

/**
 * Re-encodes an oversized photo as JPEG, scaling it down and stepping down
 * quality until it fits maxBytes — phone-camera photos routinely come in at
 * 5-10MB, and rejecting those outright just pushes the resizing work onto
 * whoever is doing the home visit. Returns the original file untouched if
 * it already fits or if it isn't a decodable image (the caller's normal
 * validation will reject those).
 */
export async function compressImageFile(file: File, maxBytes: number = MAX_IMAGE_BYTES): Promise<File> {
  if (file.size <= maxBytes) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob: Blob | null = null;
  for (let quality = 0.85; quality >= 0.4; quality -= 0.15) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) break;
  }
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

/** Uploads a partner logo (public) and returns its URL. */
export async function uploadPartnerLogo(file: File, kind: "ngos" | "schools"): Promise<string> {
  const invalidReason = validateLogoFile(file);
  if (invalidReason) throw new Error(invalidReason);
  const { url } = await api.upload<{ url: string }>("/api/v1/uploads/partner-logo", file, { kind });
  return `${API_BASE_URL}${url}`;
}

/** Uploads the signed-in user's profile photo (public, under their own folder) and returns its URL.
 * The folder comes from the verified token server-side; the uid argument is kept for call-site compatibility. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function uploadAvatar(file: File, _firebaseUid: string): Promise<string> {
  const invalidReason = validateAvatarFile(file);
  if (invalidReason) throw new Error(invalidReason);
  const { url } = await api.upload<{ url: string }>("/api/v1/uploads/avatar", file);
  return `${API_BASE_URL}${url}`;
}

/**
 * Uploads a student's profile photo to private storage and records it as a
 * `doc_type='photo'` student_documents row. Returns the storage path; render
 * it via getSignedStudentDocumentUrl.
 */
export async function uploadStudentPhoto(file: File, studentId: string): Promise<string> {
  const invalidReason = validateStudentPhotoFile(file);
  if (invalidReason) throw new Error(invalidReason);
  const { path } = await api.upload<{ path: string }>(`/api/v1/uploads/student-photo/${studentId}`, file);
  return path;
}

/**
 * URL for a private student document. The API checks the session cookie
 * against student_documents RLS on every request, so the URL itself grants
 * nothing — and since it's stable, the browser's HTTP cache can reuse it
 * across list reloads and pages (the reason the old signed-URL cache existed).
 */
export function studentDocumentUrl(path: string): string {
  return `${API_BASE_URL}/api/v1/files/student-documents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Kept async for drop-in compatibility with the previous signed-URL API. */
export async function getSignedStudentDocumentUrl(path: string): Promise<string | null> {
  return studentDocumentUrl(path);
}

/** Bulk variant for lists — no network round-trip needed anymore. */
export async function getSignedStudentDocumentUrls(paths: string[]): Promise<Record<string, string>> {
  return Object.fromEntries(paths.map((path) => [path, studentDocumentUrl(path)]));
}

/** A student can have several `doc_type='photo'` rows over time (re-uploads
 * aren't deleted) — this is "the" profile photo shown in the UI. */
export function pickLatestPhotoPath(
  documents: { doc_type: string; file_path: string; uploaded_at: string }[],
): string | null {
  const photos = documents.filter((d) => d.doc_type === "photo");
  if (photos.length === 0) return null;
  return photos.reduce((latest, d) => (d.uploaded_at > latest.uploaded_at ? d : latest)).file_path;
}
