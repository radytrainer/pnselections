"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ResultsExport, ResultStatusLabel } from "@/components/exams/resultsExport";

const RESULT_CLASS: Record<ResultStatusLabel, string> = {
  Pass: "text-emerald-700",
  Fail: "text-rose-700",
  Absent: "text-slate-600",
  Excluded: "text-slate-600",
  "No pass marks": "text-slate-600",
};

/**
 * Printable A4-landscape results report. Rendered into <body> only while
 * printing; everything else on the page is hidden for print, so "Save as PDF"
 * produces just this report. Calls onDone after the print dialog closes.
 */
export function ResultsPrint({ model, onDone }: { model: ResultsExport; onDone: () => void }) {
  useEffect(() => {
    const prev = document.title;
    document.title = model.fileBase; // default PDF file name
    const after = () => onDone();
    window.addEventListener("afterprint", after);
    const t = setTimeout(() => window.print(), 400);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", after);
      document.title = prev;
    };
  }, [model, onDone]);

  const footer = `Written exam results · ${model.cycleName} · Confidential`.replace(/["\\]/g, "");

  return createPortal(
    <div className="results-print-root bg-white text-[9pt] leading-snug text-slate-900">
      <style>{`
        @media screen { .results-print-root { display: none; } }
        @media print {
          body > *:not(.results-print-root) { display: none !important; }
          html, body { background: #fff !important; }
          .results-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .results-print-root tr { break-inside: avoid; }
        }
        @page {
          size: A4 landscape;
          margin: 10mm 10mm 12mm;
          @bottom-left { content: "${footer}"; font: 7.5pt system-ui, sans-serif; color: #64748b; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt system-ui, sans-serif; color: #64748b; }
        }
      `}</style>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b-2 border-[#00427a] pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/pn-logo.png" alt="Passerelles Numériques" className="h-[13mm] w-auto" />
        <div className="text-center">
          <h1 className="text-[16pt] font-semibold text-[#00427a]">Written exam results</h1>
          <p className="text-[9pt] text-slate-600">
            {model.cycleName} · generated {model.generated}
          </p>
          <p className="text-[9.5pt] font-semibold">{model.scope}</p>
        </div>
        <span aria-hidden />
      </header>

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${model.summary.length}, minmax(0, 1fr))` }}>
        {model.summary.map((s) => (
          <div key={s.label} className="rounded-md border border-slate-200 px-3 py-1.5">
            <p className="text-[7pt] font-medium tracking-wide text-slate-500 uppercase">{s.label}</p>
            <p className="text-[13pt] font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9pt]">
        <span className="text-slate-500">Pass marks: </span>
        <span className="font-semibold">{model.passMarks}</span>
      </p>

      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left text-[7pt] tracking-wide text-slate-600 uppercase">
            <th className="w-[3.5%] border border-slate-300 px-1.5 py-1 font-medium">#</th>
            <th className="w-[6.5%] border border-slate-300 px-1.5 py-1 font-medium">ID</th>
            <th className="border border-slate-300 px-1.5 py-1 font-medium">Name</th>
            <th className="w-[6%] border border-slate-300 px-1.5 py-1 font-medium">Gender</th>
            <th className="w-[13%] border border-slate-300 px-1.5 py-1 font-medium">Exam center</th>
            {model.papers.map((p) => (
              <th key={p.name} className="w-[9%] border border-slate-300 px-1.5 py-1 text-right font-medium">
                {p.name} <span className="normal-case">/{p.max}</span>
              </th>
            ))}
            <th className="w-[7%] border border-slate-300 px-1.5 py-1 font-medium">Result</th>
            <th className="w-[19%] border border-slate-300 px-1.5 py-1 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((r) => (
            <tr key={r.id}>
              <td className="border border-slate-300 px-1.5 py-1 text-slate-500 tabular-nums">{r.n}</td>
              <td className="border border-slate-300 px-1.5 py-1 font-mono tabular-nums">{r.id}</td>
              <td className="border border-slate-300 px-1.5 py-1 font-medium">{r.name || "—"}</td>
              <td className="border border-slate-300 px-1.5 py-1">{r.gender}</td>
              <td className="border border-slate-300 px-1.5 py-1">
                {r.center}
                {r.room && <span className="block text-[7.5pt] text-slate-500">{r.room}</span>}
              </td>
              {r.scores.map((s, i) => (
                <td key={i} className="border border-slate-300 px-1.5 py-1 text-right font-semibold tabular-nums">
                  {s == null ? <span className="font-normal text-slate-400">—</span> : s}
                  {r.manual[i] && <span className="ml-0.5 font-normal text-amber-700">✎</span>}
                </td>
              ))}
              <td className={`border border-slate-300 px-1.5 py-1 font-semibold ${RESULT_CLASS[r.result]}`}>{r.result}</td>
              <td className="border border-slate-300 px-1.5 py-1 text-[8pt] text-slate-600">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[7.5pt] text-slate-500">
        ✎ = manual score entered in the app. Scores are calculated from the ZipGrade sheets with the current answer keys.
      </p>
    </div>,
    document.body,
  );
}
