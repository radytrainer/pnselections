"use client";

import { useParams } from "next/navigation";
import { ExamEntry } from "@/components/field-entry/ExamEntry";

export default function ExamEntryPage() {
  const params = useParams<{ studentId: string }>();
  return <ExamEntry studentId={params.studentId} doneHref={`/students/${params.studentId}`} />;
}
