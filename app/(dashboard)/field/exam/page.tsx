"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ExamEntry } from "@/components/field-entry/ExamEntry";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Field Mode exam page. The student comes from ?studentId= (not a path
 * segment) so this page has one fixed URL the service worker can cache for
 * offline use; returns to Field Mode after saving.
 */
function FieldPage() {
  const studentId = useSearchParams().get("studentId");
  if (!studentId) return <p className="text-sm text-muted-foreground">No student selected.</p>;
  return <ExamEntry key={studentId} studentId={studentId} doneHref="/field" />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      <FieldPage />
    </Suspense>
  );
}
