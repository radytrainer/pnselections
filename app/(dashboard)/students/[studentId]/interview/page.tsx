"use client";

import { useParams } from "next/navigation";
import { InterviewEntry } from "@/components/field-entry/InterviewEntry";

export default function InterviewEntryPage() {
  const params = useParams<{ studentId: string }>();
  return <InterviewEntry studentId={params.studentId} doneHref={`/students/${params.studentId}`} />;
}
