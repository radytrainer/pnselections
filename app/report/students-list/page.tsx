"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { buildStudentExport, fetchAllStudents, readExportParams, type StudentExport } from "@/features/student-export/model";
import { StudentListDocument, STUDENT_LIST_CSS } from "@/components/students/StudentListDocument";

/**
 * Printable student list (Students page → Export → PDF): A4 landscape, PN
 * logo, summary, then one section per center/province when grouped. Opened
 * with ?print=1, which brings up the print dialog — "Save as PDF" gives the
 * PDF. Rendering in the browser keeps Khmer names displaying correctly.
 */
export default function StudentListReportPage() {
  const { user, loading: authLoading } = useAuth();
  const [doc, setDoc] = useState<StudentExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wordBusy, setWordBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return setError("Please sign in to export students.");
    const params = readExportParams(new URLSearchParams(window.location.search));
    fetchAllStudents(params)
      .then((students) => setDoc(buildStudentExport(students, { ...params, generatedBy: user.displayName || user.email })))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the students"));
  }, [user, authLoading]);

  useEffect(() => {
    if (!doc) return;
    const prev = document.title;
    document.title = doc.fileName;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (new URLSearchParams(window.location.search).get("print") === "1") t = setTimeout(() => window.print(), 600);
    return () => {
      document.title = prev;
      if (t) clearTimeout(t);
    };
  }, [doc]);

  async function downloadWord() {
    if (!doc) return;
    setWordBusy(true);
    try {
      const { downloadStudentListDocx } = await import("@/features/student-export/docx");
      await downloadStudentListDocx(doc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the Word file");
    } finally {
      setWordBusy(false);
    }
  }

  const footer = doc ? `Passerelles numériques Cambodia · ${doc.title} · ${doc.cycleName || "All cycles"} · Confidential`.replace(/["\\]/g, "") : "";

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 11mm 11mm 13mm;
          @bottom-left { content: "${footer}"; font: 7.5pt system-ui, sans-serif; color: #64748b; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt system-ui, sans-serif; color: #64748b; }
        }
        @media print {
          html, body { background: #fff !important; }
          .sl-root, .sl-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .sl-group { break-before: page; }
          .sl-group:first-of-type { break-before: auto; }
          .sl-table thead { display: table-header-group; }
          .sl-table tr { break-inside: avoid; }
        }
        ${STUDENT_LIST_CSS}
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[297mm] flex-wrap items-center justify-between gap-2 px-4 sm:px-0">
        <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to students
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground lg:inline">For PDF, choose “Save as PDF” in the print window.</span>
          <Button variant="outline" onClick={downloadWord} disabled={!doc || wordBusy}>
            {wordBusy ? <Loader2 className="animate-spin" /> : <FileText />} Download Word
          </Button>
          <Button onClick={() => window.print()} disabled={!doc}>
            <Download /> Download PDF
          </Button>
        </div>
      </div>

      <article className="sl-root mx-auto w-full max-w-[297mm] bg-white px-[11mm] py-[10mm] text-slate-900 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {error ? (
          <p className="py-20 text-center text-sm text-rose-700">{error}</p>
        ) : !doc ? (
          <p className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Preparing the student list…
          </p>
        ) : (
          <StudentListDocument doc={doc} />
        )}
      </article>
    </div>
  );
}
