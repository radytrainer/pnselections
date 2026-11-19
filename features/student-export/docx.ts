/**
 * Word (.docx) version of the student list export: A4 landscape, PN logo
 * letterhead, summary, then one section per center/province (each on a new
 * page) with a repeating table header. docx is loaded only on demand.
 */
import type { IBorderOptions, Paragraph as TParagraph, Table as TTable, TextRun as TTextRun, ImageRun as TImageRun } from "docx";
import type { StudentExport } from "./model";

const NAVY = "00427A";
const ORANGE = "F28C28";
const CYAN = "1BA1E2";
const MUTED = "64748B";
const LINE = "E2E8F0";

export async function downloadStudentListDocx(doc: StudentExport) {
  const d = await import("docx");
  const { AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageBreak, PageNumber, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } = d;
  const font = "Calibri";
  const line: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: none, bottom: none, left: none, right: none };
  type Run = TTextRun | TImageRun;

  const t = (text: string, o: { bold?: boolean; color?: string; size?: number; mono?: boolean } = {}) =>
    new TextRun({ text, font: o.mono ? "Consolas" : font, size: o.size ?? 17, bold: o.bold, color: o.color });
  const p = (children: Run[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) =>
    new Paragraph({ alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, children });
  const align = (a?: "right" | "center") => (a === "right" ? AlignmentType.RIGHT : a === "center" ? AlignmentType.CENTER : AlignmentType.LEFT);

  const logo = await fetch("/brand/pn-logo.png")
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

  const children: (TParagraph | TTable)[] = [];

  // Letterhead: logo left, title right, navy rule.
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: none, left: none, right: none, insideHorizontal: none, insideVertical: none, bottom: { style: BorderStyle.SINGLE, size: 14, color: NAVY } },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.BOTTOM,
              children: [logo ? p([new ImageRun({ type: "png", data: logo, transformation: { width: 120, height: 51 } })], { after: 80 }) : p([])],
            }),
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.BOTTOM,
              children: [
                p([t(doc.title, { bold: true, size: 32, color: NAVY })], { align: AlignmentType.RIGHT }),
                p([t(doc.cycleName || "All selection cycles", { size: 18, color: MUTED })], { align: AlignmentType.RIGHT, after: 80 }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  // Summary tiles + details.
  const tiles = [
    { v: doc.totals.total, l: "students", accent: true },
    { v: doc.totals.female, l: "female" },
    { v: doc.totals.male, l: "male" },
    ...(doc.totals.other ? [{ v: doc.totals.other, l: "other" }] : []),
    ...(doc.groupBy !== "none" ? [{ v: doc.groups.length, l: doc.groupBy === "province" ? "provinces" : "centers" }] : []),
  ];
  children.push(p([], { after: 120 }));
  children.push(
    new Table({
      width: { size: 60, type: WidthType.PERCENTAGE },
      borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" } },
      rows: [
        new TableRow({
          children: tiles.map(
            (x) =>
              new TableCell({
                shading: { type: ShadingType.CLEAR, color: "auto", fill: x.accent ? NAVY : "F1F7FC" },
                borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 18, color: x.accent ? ORANGE : CYAN } },
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [p([t(x.v.toLocaleString(), { bold: true, size: 30, color: x.accent ? "FFFFFF" : NAVY })]), p([t(x.l, { size: 15, color: x.accent ? "FFFFFF" : MUTED })])],
              }),
          ),
        }),
      ],
    }),
  );
  if (doc.filtersText) children.push(p([t("Filters: ", { bold: true }), t(doc.filtersText, { color: MUTED })], { before: 120 }));
  if (doc.statusTotals.length) children.push(p([t("By status: ", { bold: true }), t(doc.statusTotals.map((s) => `${s.label} ${s.value}`).join("  ·  "), { color: MUTED })], { before: 40 }));
  children.push(p([t(`Generated ${doc.generated}${doc.generatedBy ? ` by ${doc.generatedBy}` : ""}`, { color: MUTED, size: 15 })], { before: 40, after: 160 }));

  if (doc.totals.total === 0) children.push(p([t("No students match these filters.", { color: MUTED })], { before: 400, align: AlignmentType.CENTER }));

  const head = new TableRow({
    tableHeader: true,
    children: doc.columns.map(
      (c) =>
        new TableCell({
          width: { size: c.width, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
          borders: { top: none, bottom: none, left: none, right: none },
          margins: { top: 50, bottom: 50, left: 70, right: 70 },
          children: [p([t(c.label.toUpperCase(), { bold: true, size: 14, color: "FFFFFF" })], { align: align(c.align) })],
        }),
    ),
  });

  doc.groups.forEach((g, gi) => {
    if (doc.groupBy !== "none") {
      if (gi > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 80 },
          border: { left: { style: BorderStyle.SINGLE, size: 24, color: ORANGE, space: 6 } },
          children: [
            t(g.name, { bold: true, size: 26, color: NAVY }),
            t(`     ${g.counts.total} student${g.counts.total === 1 ? "" : "s"} · ${g.counts.female} female · ${g.counts.male} male${g.counts.other ? ` · ${g.counts.other} other` : ""}`, { size: 16, color: MUTED }),
          ],
        }),
      );
    }
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [
          head,
          ...g.rows.map(
            (r, i) =>
              new TableRow({
                cantSplit: true,
                children: doc.columns.map(
                  (c) =>
                    new TableCell({
                      width: { size: c.width, type: WidthType.PERCENTAGE },
                      shading: i % 2 ? { type: ShadingType.CLEAR, color: "auto", fill: "F8FAFC" } : undefined,
                      borders: { top: none, left: none, right: none, bottom: line },
                      margins: { top: 40, bottom: 40, left: 70, right: 70 },
                      children: [
                        p([t(String(r[c.key]) || "—", { size: 16, bold: c.key === "name", mono: c.mono, color: c.key === "no" || !String(r[c.key]) ? MUTED : undefined })], { align: align(c.align) }),
                      ],
                    }),
                ),
              }),
          ),
        ],
      }),
    );
  });

  const document_ = new Document({
    creator: "PNC Selection",
    title: doc.fileName,
    styles: { default: { document: { run: { font, size: 17 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE, width: 11906, height: 16838 },
            margin: { top: 620, bottom: 720, left: 620, right: 620 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: "right", position: 15500 }],
                children: [
                  new TextRun({ font, size: 14, color: MUTED, text: `Passerelles numériques Cambodia · ${doc.title} · ${doc.cycleName || "All cycles"} · Confidential` }),
                  new TextRun({ font, size: 14, color: MUTED, children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(document_);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
