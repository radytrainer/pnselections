"use client";

import { useParams } from "next/navigation";
import { SocialFormEntry } from "@/components/field-entry/SocialFormEntry";

export default function SocialFormEntryPage() {
  const params = useParams<{ studentId: string }>();
  return <SocialFormEntry studentId={params.studentId} doneHref={`/students/${params.studentId}`} />;
}
