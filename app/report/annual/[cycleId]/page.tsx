"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printPageCss, ReportDocument } from "@/components/annual-report/ReportDocument";
import { useReportData } from "@/components/annual-report/useReportData";
import { buildReportModel } from "@/features/annual-report/model";
import { useAuth } from "@/hooks/useAuth";

/**
 * Print view of the Annual Report (saved version). Opened from
 * Configuration → Annual Report with ?print=1, which brings up the print
 * dialog — "Save as PDF" gives the PDF. Rendering in the browser keeps Khmer
 * names and text displaying correctly.
 */
export default function AnnualReportPrintPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { data, error } = useReportData(cycleId, !authLoading && !!user);
  const model = useMemo(() => (data ? buildReportModel(data.source, data.source.content, data.sessions, data.exam) : null), [data]);
  const [wordBusy, setWordBusy] = useState(false);

  useEffect(() => {
    if (!model) return;
    const prev = document.title;
    document.title = `PNC ${model.title}`;
    return () => {
      document.title = prev;
    };
  }, [model]);

  // Print once the photos have loaded.
  useEffect(() => {
    if (!model || new URLSearchParams(window.location.search).get("print") !== "1") return;
    let cancelled = false;
    const imgs = [...document.querySelectorAll<HTMLImageElement>(".ar-doc img")];
    const loaded = (img: HTMLImageElement) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
    Promise.all(imgs.map(loaded))
      .then(() => new Promise((r) => setTimeout(r, 300)))
      .then(() => !cancelled && window.print());
    return () => {
      cancelled = true;
    };
  }, [model]);

  async function downloadWord() {
    if (!model) return;
    setWordBusy(true);
    try {
      const { downloadAnnualReportDocx } = await import("@/features/annual-report/docx");
      await downloadAnnualReportDocx(model);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the Word file");
    } finally {
      setWordBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{printPageCss(model?.title ?? "Selection Report")}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 sm:px-0">
        <Link href="/admin/annual-report" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to the editor
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground lg:inline">For PDF, choose “Save as PDF” in the print window.</span>
          <Button variant="outline" onClick={downloadWord} disabled={!model || wordBusy}>
            {wordBusy ? <Loader2 className="animate-spin" /> : <FileText />} Download Word
          </Button>
          <Button onClick={() => window.print()} disabled={!model}>
            <Download /> Download PDF
          </Button>
        </div>
      </div>
      {!authLoading && !user ? (
        <p className="py-20 text-center text-sm text-rose-700">Please sign in to view this report.</p>
      ) : error ? (
        <p className="py-20 text-center text-sm text-rose-700">{error}</p>
      ) : !model ? (
        <p className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Preparing report…
        </p>
      ) : (
        <ReportDocument m={model} />
      )}
    </div>
  );
}
