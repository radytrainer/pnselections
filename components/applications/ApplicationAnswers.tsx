"use client";

import { FileText, ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { studentDocumentUrl } from "@/lib/storage";
import { answerText, DECLARATION, isShown, SECTIONS } from "@/features/scholarship-application/form";
import type { StudentApplication } from "@/services/applicationService";

const KM = { fontFamily: "var(--font-battambang)" } as const;

/** Staff view of what the student filled in on their application form. */
export function ApplicationAnswers({ application }: { application: StudentApplication }) {
  const a = application.data ?? {};
  const photo = [...application.files].reverse().find((f) => f.doc_type === "photo");
  const attachments = application.files.filter((f) => f.doc_type !== "photo");
  const hasAnswers = Object.keys(a).length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-4">
            {photo ? (
              <a href={studentDocumentUrl(photo.file_path)} target="_blank" rel="noreferrer" title="Open full size">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${studentDocumentUrl(photo.file_path)}?w=384`} alt="Photo from the application" className="h-36 w-24 rounded-md border object-cover" />
              </a>
            ) : (
              <div className="flex h-36 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground">
                <ImageIcon className="size-5" />
                No photo
              </div>
            )}
            <span className="text-xs text-muted-foreground">Photo 4×6</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attached documents</CardTitle>
            <CardDescription>
              {attachments.length} of 5 · map to home, family book, equity card…
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files attached.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {attachments.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <a href={studentDocumentUrl(f.file_path)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium hover:text-primary hover:underline">
                      {f.original_name || f.file_path.split("/").pop()}
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(f.uploaded_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasAnswers ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">The student hasn&apos;t submitted the form yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {SECTIONS.map((section) => (
            <Card key={section.id} className={cn(section.id === "equity" && "lg:col-span-2")}>
              <CardHeader>
                <CardTitle style={KM}>{section.km}</CardTitle>
                <CardDescription>{section.en}</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {section.fields
                  .filter((f) => isShown(f, a))
                  .map((f) => {
                    const text = answerText(f, a[f.key]);
                    return (
                      <div key={f.key} className="grid gap-0.5 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
                        <span className="text-muted-foreground">{f.en}</span>
                        {f.type === "url" && text !== "—" && /^https?:\/\//i.test(text) ? (
                          <a href={text} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-primary hover:underline sm:text-right">
                            Open in Google Maps ↗
                          </a>
                        ) : (
                          <span className={cn("font-medium whitespace-pre-wrap break-words sm:text-right", text === "—" && "font-normal text-muted-foreground/70")}>{text}</span>
                        )}
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {hasAnswers && (
        <p className="text-xs text-muted-foreground">
          {a[DECLARATION.key] === true ? "✓ The student confirmed the information is true and correct." : "The student did not tick the declaration."}
        </p>
      )}
    </div>
  );
}
