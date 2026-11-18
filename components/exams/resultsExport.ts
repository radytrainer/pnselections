/**
 * Exports of the written-exam results — Excel, Word, and the model the
 * printable PDF uses — all from one ResultsExport, built from exactly what the
 * Results tab shows (filters, exam center, search, sort, pass marks).
 */
import { downloadXlsxBook } from "@/components/exams/readSpreadsheet";

export type ResultStatusLabel = "Pass" | "Fail" | "Absent" | "Excluded" | "No pass marks";
export type ResultsExportRow = {
  n: number;
  id: string;
  name: string;
  gender: string;
  center: string;
  room: string;
  scores: (number | null)[];
  manual: boolean[];
  result: ResultStatusLabel;
  reason: string;
};
export type ResultsExport = {
  fileBase: string;
  cycleName: string;
  generated: string;
  scope: string;
  passMarks: string;
  summary: { label: string; value: string }[];
  papers: { name: string; max: number }[];
  rows: ResultsExportRow[];
};

const RESULT_COLOR: Record<ResultStatusLabel, string> = {
  Pass: "047857",
  Fail: "BE123C",
  Absent: "475569",
  Excluded: "475569",
  "No pass marks": "475569",
};

export async function exportResultsXlsx(m: ResultsExport) {
  const header = ["#", "ID", "Name", "Gender", "Exam center", "Room", ...m.papers.map((p) => `${p.name} (/${p.max})`), "Result", "Reason", "Manual scores"];
  const rows = m.rows.map((r) => [
    r.n,
    r.id,
    r.name,
    r.gender,
    r.center,
    r.room,
    ...r.scores.map((s) => s),
    r.result,
    r.reason,
    m.papers.filter((_, i) => r.manual[i]).map((p) => p.name).join(", "),
  ]);
  await downloadXlsxBook(`${m.fileBase}.xlsx`, [
    {
      name: "Results",
      rows: [header, ...rows],
      widths: [5, 9, 26, 9, 20, 12, ...m.papers.map((p) => Math.max(12, p.name.length + 6)), 10, 34, 16],
      filterRow: 0,
      textColumns: [1],
    },
    {
      name: "Summary",
      rows: [
        ["Written exam results"],
        ["Cycle", m.cycleName],
        ["Generated", m.generated],
        ["Showing", m.scope],
        ["Pass marks", m.passMarks],
        [],
        ...m.summary.map((s) => [s.label, s.value]),
      ],
      widths: [22, 70],
    },
  ]);
}

export async function exportResultsDocx(m: ResultsExport) {
  const d = await import("docx");
  const {
    AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageNumber, PageOrientation, Paragraph, ShadingType, Table,
    TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
  } = d;
  const font = "Calibri";
  const grey = "CBD5E1";
  const b = { style: BorderStyle.SINGLE, size: 4, color: grey };
  const borders = { top: b, bottom: b, left: b, right: b };
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const t = (text: string, o: { bold?: boolean; color?: string; size?: number } = {}) => new TextRun({ text, font, size: o.size ?? 17, bold: o.bold, color: o.color });
  const logo = await fetch("/brand/pn-logo.png")
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

  // Column widths (%): fixed columns, then the papers share what's left before Result/Reason.
  const fixed = [4, 7, 18, 7, 13];
  const tail = [8, 17];
  const paperW = Math.max(6, (100 - [...fixed, ...tail].reduce((a, c) => a + c, 0)) / Math.max(1, m.papers.length));
  const widths = [...fixed, ...m.papers.map(() => paperW), ...tail];
  const heads = ["#", "ID", "Name", "Gender", "Exam center", ...m.papers.map((p) => `${p.name} /${p.max}`), "Result", "Reason"];
  const cell = (children: InstanceType<typeof Paragraph>[], w: number, fill?: string) =>
    new TableCell({
      width: { size: w, type: WidthType.PERCENTAGE },
      borders,
      shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 70, right: 70 },
      children,
    });
  const right = (text: string, o?: Parameters<typeof t>[1]) => new Paragraph({ alignment: AlignmentType.RIGHT, children: [t(text, o)] });
  const left = (text: string, o?: Parameters<typeof t>[1]) => new Paragraph({ children: [t(text, o)] });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: heads.map((h, i) => cell([i >= fixed.length && i < fixed.length + m.papers.length ? right(h.toUpperCase(), { size: 14, bold: true, color: "475569" }) : left(h.toUpperCase(), { size: 14, bold: true, color: "475569" })], widths[i], "F1F5F9")),
      }),
      ...m.rows.map(
        (r) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell([left(String(r.n), { color: "64748B" })], widths[0]),
              cell([left(r.id)], widths[1]),
              cell([left(r.name || "—", { bold: true })], widths[2]),
              cell([left(r.gender)], widths[3]),
              cell([left(r.center), ...(r.room ? [left(r.room, { size: 15, color: "64748B" })] : [])], widths[4]),
              ...r.scores.map((s, i) => cell([right(s == null ? "—" : `${s}${r.manual[i] ? " ✎" : ""}`, { bold: s != null })], paperW)),
              cell([left(r.result, { bold: true, color: RESULT_COLOR[r.result] })], tail[0]),
              cell([left(r.reason, { size: 15, color: "475569" })], tail[1]),
            ],
          }),
      ),
    ],
  });

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: m.summary.map(
          (s) =>
            new TableCell({
              width: { size: 100 / m.summary.length, type: WidthType.PERCENTAGE },
              borders,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [left(s.label.toUpperCase(), { size: 13, bold: true, color: "64748B" }), left(s.value, { size: 26, bold: true })],
            }),
        ),
      }),
    ],
  });

  const doc = new Document({
    creator: "PNC Selection",
    title: m.fileBase,
    sections: [
      {
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 567, bottom: 680, left: 567, right: 567 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ font, size: 15, color: "64748B", text: `Written exam results · ${m.cycleName} · Confidential    ` }),
                  new TextRun({ font, size: 15, color: "64748B", children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: none, left: none, right: none, insideHorizontal: none, insideVertical: none, bottom: { style: BorderStyle.SINGLE, size: 12, color: "00427A" } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: { top: none, bottom: none, left: none, right: none },
                    verticalAlign: VerticalAlign.CENTER,
                    children: [new Paragraph({ children: logo ? [new ImageRun({ type: "png", data: logo, transformation: { width: 120, height: 51 } })] : [] })],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: none, bottom: none, left: none, right: none },
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [t("Written exam results", { size: 32, bold: true, color: "00427A" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [t(`${m.cycleName} · generated ${m.generated}`, { size: 18, color: "475569" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [t(m.scope, { size: 18, bold: true })] }),
                    ],
                  }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: none, bottom: none, left: none, right: none }, children: [new Paragraph({})] }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 160 }, children: [] }),
          summaryTable,
          new Paragraph({ spacing: { before: 120, after: 120 }, children: [t("Pass marks: ", { size: 18, color: "64748B" }), t(m.passMarks, { size: 18, bold: true })] }),
          table,
          new Paragraph({ spacing: { before: 160 }, children: [t("✎ = manual score entered in the app. Scores are calculated from the ZipGrade sheets with the current answer keys.", { size: 15, color: "64748B" })] }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${m.fileBase}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
