import type { StudentExport } from "@/features/student-export/model";

/** The student list export as printed (used by /report/students-list). */
const NAVY = "#00427A";

export const STUDENT_LIST_CSS = `
        .sl-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }
        .sl-table th { background: ${NAVY}; color: #fff; font-weight: 600; text-align: left; padding: 4pt 5pt; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .03em; }
        .sl-table td { padding: 3.5pt 5pt; border-bottom: 1px solid #E2E8F0; vertical-align: top; overflow-wrap: anywhere; }
        .sl-table tbody tr:nth-child(even) td { background: #F8FAFC; }
`;

export function StudentListDocument({ doc }: { doc: StudentExport }) {
  const grouped = doc.groupBy !== "none";
  return (
    <>
      {/* Letterhead */}
      <header className="flex items-end justify-between gap-6 border-b-2 pb-2.5" style={{ borderColor: NAVY }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/pn-logo.png" alt="Passerelles numériques" className="h-[13mm] w-auto" />
        <div className="text-right">
          <h1 className="text-[17pt] leading-tight font-bold" style={{ color: NAVY }}>
            {doc.title}
          </h1>
          <p className="text-[9pt] text-slate-600">{doc.cycleName || "All selection cycles"}</p>
        </div>
      </header>

      {/* Summary */}
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-6">
        <div className="flex gap-2">
          {[
            { v: doc.totals.total, l: "students", accent: true },
            { v: doc.totals.female, l: "female" },
            { v: doc.totals.male, l: "male" },
            ...(doc.totals.other ? [{ v: doc.totals.other, l: "other" }] : []),
            ...(grouped ? [{ v: doc.groups.length, l: doc.groupBy === "province" ? "provinces" : "centers" }] : []),
          ].map((t) => (
            <div
              key={t.l}
              className="min-w-[22mm] rounded-[4pt] px-3 py-1.5"
              style={{ background: t.accent ? NAVY : "#F1F7FC", color: t.accent ? "#fff" : NAVY, borderTop: `2.5pt solid ${t.accent ? "#F28C28" : "#1BA1E2"}` }}
            >
              <div className="text-[15pt] leading-tight font-bold tabular-nums">{t.v.toLocaleString()}</div>
              <div className={t.accent ? "text-[7.5pt] text-white/90" : "text-[7.5pt] text-slate-500"}>{t.l}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-[8.5pt] text-slate-600">
          {doc.filtersText && (
            <p>
              <span className="font-semibold text-slate-800">Filters: </span>
              {doc.filtersText}
            </p>
          )}
          {doc.statusTotals.length > 0 && (
            <p>
              <span className="font-semibold text-slate-800">By status: </span>
              {doc.statusTotals.map((s) => `${s.label} ${s.value}`).join(" · ")}
            </p>
          )}
          <p>
            Generated {doc.generated}
            {doc.generatedBy ? ` by ${doc.generatedBy}` : ""}
          </p>
        </div>
      </div>

      {doc.totals.total === 0 && <p className="py-16 text-center text-sm text-slate-500">No students match these filters.</p>}

      {doc.groups.map((g) => (
        <section key={g.name} className="sl-group mt-5">
          {grouped && (
            <div className="mb-1.5 flex items-baseline justify-between gap-4 border-l-[3pt] pl-2.5" style={{ borderColor: "#F28C28" }}>
              <h2 className="text-[13pt] font-bold" style={{ color: NAVY }}>
                {g.name}
              </h2>
              <span className="text-[8.5pt] text-slate-600 tabular-nums">
                {g.counts.total} student{g.counts.total === 1 ? "" : "s"} · {g.counts.female} female · {g.counts.male} male
                {g.counts.other ? ` · ${g.counts.other} other` : ""}
              </span>
            </div>
          )}
          <table className="sl-table">
            <colgroup>
              {doc.columns.map((c) => (
                <col key={c.key} style={{ width: `${c.width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {doc.columns.map((c) => (
                  <th key={c.key} style={{ textAlign: c.align ?? "left" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={`${r.code}-${r.no}`}>
                  {doc.columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align ?? "left" }}
                      className={c.mono ? "font-mono text-[8pt] tabular-nums" : c.key === "name" ? "font-semibold" : c.key === "no" ? "text-slate-500 tabular-nums" : ""}
                    >
                      {String(r[c.key]) || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
