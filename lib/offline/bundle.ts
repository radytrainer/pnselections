import { api, buildUrl, sendRequest } from "@/lib/api/client";
import { BUNDLE_STUDENTS_KEY, type OfflineStudent } from "@/lib/offline/fallback";
import { getMeta, idbPutMany, setMeta, type CachedResponse } from "@/lib/offline/store";

export const BUNDLE_INFO_KEY = "bundle-info";
export type BundleInfo = { downloadedAt: string; studentCount: number; cycleId: string | null };

type Bundle = {
  generatedAt: string;
  cycleId: string | null;
  activeCycle: unknown;
  cycles: unknown[];
  provinces: unknown[];
  schools: unknown[];
  interviewCategories: unknown[];
  students: (OfflineStudent & {
    exam_results: unknown;
    interviews: { id: string } | null;
    social_assessments: { visit_number: number }[];
  })[];
  interviewAnswers: Record<string, unknown[]>;
};

/** Pages Field Mode can open without internet (their HTML + JS is cached by public/sw.js). */
export const OFFLINE_PAGES = ["/field", "/field/social-form", "/field/exam", "/field/interview", "/students", "/offline"];

/**
 * Downloads everything Field Mode needs and stores it under the exact URLs
 * the normal services request, so the existing pages and forms read it
 * transparently when offline (lib/api/client.ts#offlineRead).
 */
export async function downloadForOffline(onProgress?: (message: string) => void, firebaseUid?: string) {
  onProgress?.("Downloading students…");
  const bundle = await sendRequest<Bundle>("GET", buildUrl("/api/v1/offline/bundle"));

  onProgress?.(`Saving ${bundle.students.length} students on this device…`);
  const now = Date.now();
  const entries: [string, CachedResponse][] = [];
  const put = (path: string, data: unknown) => entries.push([buildUrl(path), { data, savedAt: now }]);

  put("/api/v1/lookups/cycles", bundle.cycles);
  put("/api/v1/lookups/cycles/active", bundle.activeCycle);
  put("/api/v1/lookups/provinces", bundle.provinces);
  put("/api/v1/lookups/schools", bundle.schools);
  put("/api/v1/interview-categories", bundle.interviewCategories);

  for (const student of bundle.students) {
    const latest = [...student.social_assessments].sort((a, b) => b.visit_number - a.visit_number)[0] ?? null;
    put(`/api/v1/students/${student.id}`, student);
    put(`/api/v1/social-assessments/student/${student.id}/latest`, latest);
    put(`/api/v1/exams/${student.id}`, student.exam_results ?? null);
    put(`/api/v1/interviews/student/${student.id}`, student.interviews ?? null);
    if (student.interviews) {
      put(`/api/v1/interviews/${student.interviews.id}/answers`, bundle.interviewAnswers[student.interviews.id] ?? []);
    }
  }
  await idbPutMany("responses", entries);
  await setMeta(BUNDLE_STUDENTS_KEY, bundle.students);

  onProgress?.("Saving filters and your profile…");
  await Promise.allSettled([
    api.get("/api/v1/ngos"),
    api.get("/api/v1/students/home-visitors", { cycleId: bundle.cycleId ?? undefined }),
    firebaseUid ? api.get(`/api/v1/users/by-firebase-uid/${encodeURIComponent(firebaseUid)}`) : Promise.resolve(),
  ]);

  onProgress?.("Saving the app for offline use…");
  await precachePages();

  const info: BundleInfo = { downloadedAt: bundle.generatedAt, studentCount: bundle.students.length, cycleId: bundle.cycleId };
  await setMeta(BUNDLE_INFO_KEY, info);
  return info;
}

export function getBundleInfo() {
  return getMeta<BundleInfo>(BUNDLE_INFO_KEY);
}

export function getDownloadedStudents() {
  return getMeta<OfflineStudent[]>(BUNDLE_STUDENTS_KEY);
}

/**
 * Loads each offline page and the JS/CSS it references while online, so the
 * service worker has them cached (navigations network-first, /_next/static
 * cache-first).
 */
async function precachePages() {
  const assets = new Set<string>();
  for (const page of OFFLINE_PAGES) {
    try {
      const res = await fetch(page, { credentials: "include" });
      if (!res.ok || res.redirected) continue;
      const html = await res.text();
      // Paths may contain parentheses, e.g. /_next/static/chunks/app/(dashboard)/field/page-….js
      for (const match of html.matchAll(/\/_next\/static\/[^"'\s\\]+/g)) assets.add(match[0]);
    } catch {
      // best effort
    }
  }
  await Promise.allSettled(Array.from(assets).map((asset) => fetch(asset)));
}
