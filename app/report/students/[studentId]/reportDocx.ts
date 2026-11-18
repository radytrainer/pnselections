/**
 * Word (.docx) version of the student home-visit report — same sections as
 * the printable page: letterhead, student, summary, key findings, detailed
 * findings, visitor's notes, photos and signatures. docx is loaded only when
 * someone clicks "Download Word".
 */
import type { IBorderOptions, ITableCellOptions } from "docx";
import type { ReportImage } from "./reportImages";

export type ReportRating = "Concern" | "Watch" | "OK";
export type ReportRow = { label: string; value: string; note?: string; rating?: ReportRating };
export type ReportModel = {
  fileName: string;
  cycleName: string | null;
  generated: string;
  student: { name: string; code: string; fields: { label: string; value: string }[]; photo: ReportImage | null };
  visit: null | {
    line: string;
    stats: { label: string; value: string; note: string; hint: string }[];
    counts: { concerns: number; watch: number; ok: number };
    concerns: ReportRow[];
    strengths: ReportRow[];
    sections: { title: string; rows: ReportRow[] }[];
    facts: { label: string; value: string }[];
    comments: string | null;
    visitorName: string | null;
  };
  photos: ({ image: ReportImage; caption: string } | null)[];
};

const BLUE = "00427A";
const RATING_COLOR: Record<ReportRating, string> = { Concern: "BE123C", Watch: "B45309", OK: "047857" };

export async function downloadStudentReportDocx(m: ReportModel) {
  const d = await import("docx");
  const {
    AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell,
    TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
  } = d;
  const font = "Calibri";
  const grey = "CBD5E1";
  const line: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: grey };
  const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const boxBorders = { top: line, bottom: line, left: line, right: line };
  const noBorders = { top: none, bottom: none, left: none, right: none };
  const tableNoBorders = { ...noBorders, insideHorizontal: none, insideVertical: none };

  const t = (text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
    new TextRun({ text, font, size: o.size ?? 20, bold: o.bold, color: o.color, italics: o.italics });
  const p = (children: InstanceType<typeof TextRun>[] | InstanceType<typeof ImageRun>[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) =>
    new Paragraph({ alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, children });
  const heading = (text: string) => p([t(text, { bold: true, size: 23, color: BLUE })], { before: 280, after: 100 });
  const img = (im: ReportImage, maxW: number, maxH: number) => {
    const s = Math.min(maxW / im.width, maxH / im.height);
    return new ImageRun({ type: "jpg", data: im.data, transformation: { width: Math.round(im.width * s), height: Math.round(im.height * s) } });
  };
  const cell = (children: InstanceType<typeof Paragraph>[], o: { width?: number; fill?: string; borders?: ITableCellOptions["borders"]; margin?: number; vAlign?: ITableCellOptions["verticalAlign"] } = {}) =>
    new TableCell({
      width: o.width != null ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
      borders: o.borders ?? boxBorders,
      shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
      margins: { top: o.margin ?? 70, bottom: o.margin ?? 70, left: 100, right: 100 },
      verticalAlign: o.vAlign,
      children,
    });

  const logo = await fetch("/brand/pn-logo.png")
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  // Letterhead: logo left, title right.
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...tableNoBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE } },
      rows: [
        new TableRow({
          children: [
            cell(logo ? [p([new ImageRun({ type: "png", data: logo, transformation: { width: 150, height: 64 } })])] : [p([])], {
              width: 40,
              borders: noBorders,
              vAlign: VerticalAlign.BOTTOM,
            }),
            cell(
              [
                p([t("Home Visit Report", { bold: true, size: 34, color: BLUE })], { align: AlignmentType.RIGHT }),
                p([t(`Social Form assessment${m.cycleName ? ` · ${m.cycleName}` : ""}`, { size: 18, color: "475569" })], { align: AlignmentType.RIGHT }),
                p([t(`Generated ${m.generated}`, { size: 17, color: "64748B" })], { align: AlignmentType.RIGHT, after: 80 }),
              ],
              { width: 60, borders: noBorders, vAlign: VerticalAlign.BOTTOM },
            ),
          ],
        }),
      ],
    }),
  );

  // Student: photo + details.
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableNoBorders,
      rows: [
        new TableRow({
          children: [
            // Without a profile photo the details use the full width.
            ...(m.student.photo ? [cell([p([img(m.student.photo, 110, 135)])], { width: 18, borders: noBorders, margin: 160 })] : []),
            cell(
              [
                p([t(m.student.name, { bold: true, size: 32 })], { before: 160 }),
                p([t(m.student.code, { size: 18, color: "64748B" })], { after: 100 }),
                ...m.student.fields.map((f) => p([t(`${f.label}: `, { color: "64748B", size: 19 }), t(f.value || "—", { size: 19 })], { after: 30 })),
              ],
              { width: m.student.photo ? 82 : 100, borders: noBorders },
            ),
          ],
        }),
      ],
    }),
  );

  const v = m.visit;
  if (!v) {
    children.push(p([t("No home visit (Social Form) has been recorded for this student yet.", { color: "64748B" })], { before: 300 }));
  } else {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableNoBorders,
        rows: [new TableRow({ children: [cell([p([t(v.line, { size: 18, color: "334155" })])], { fill: "F8FAFC", borders: noBorders })] })],
      }),
    );

    // Summary
    children.push(heading("Summary"));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            children: [
              ...v.stats.map((s) =>
                cell(
                  [
                    p([t(s.label.toUpperCase(), { size: 15, color: "64748B", bold: true })]),
                    p([t(s.value, { size: 36, bold: true })], { before: 40 }),
                    p([t(s.note, { size: 19, bold: true })]),
                    p([t(s.hint, { size: 15, color: "64748B" })]),
                  ],
                  { width: 33, margin: 110 },
                ),
              ),
              cell(
                [
                  p([t("ASSESSMENT", { size: 15, color: "64748B", bold: true })], { after: 60 }),
                  p([t("Concerns  ", { size: 19, color: RATING_COLOR.Concern }), t(String(v.counts.concerns), { size: 19, bold: true })]),
                  p([t("To watch  ", { size: 19, color: RATING_COLOR.Watch }), t(String(v.counts.watch), { size: 19, bold: true })]),
                  p([t("OK / strength  ", { size: 19, color: RATING_COLOR.OK }), t(String(v.counts.ok), { size: 19, bold: true })]),
                ],
                { width: 34, margin: 110 },
              ),
            ],
          }),
        ],
      }),
    );

    // Key concerns / strengths side by side
    const list = (title: string, color: string, rows: ReportRow[]) =>
      cell(
        [
          p([t(`${title} (${rows.length})`, { bold: true, size: 19, color })], { after: 60 }),
          ...(rows.length
            ? rows.map((r) => p([t(`${r.label}: `, { bold: true, size: 18 }), t(r.value, { size: 18 })], { after: 30 }))
            : [p([t("None recorded", { size: 18, color: "64748B" })])]),
        ],
        { width: 50, margin: 110 },
      );
    if (v.concerns.length || v.strengths.length) {
      children.push(p([], { before: 160 }));
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [new TableRow({ children: [list("Key concerns", RATING_COLOR.Concern, v.concerns), list("Strengths", RATING_COLOR.OK, v.strengths)] })],
        }),
      );
    }

    // Detailed findings
    children.push(heading("Detailed findings"));
    for (const sec of v.sections) {
      children.push(p([t(sec.title, { bold: true, size: 20 })], { before: 120, after: 40 }));
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: ["Item", "Finding", "Rating"].map((h, i) =>
                cell([p([t(h.toUpperCase(), { size: 15, bold: true, color: "475569" })])], { width: [34, 50, 16][i], fill: "F1F5F9" }),
              ),
            }),
            ...sec.rows.map(
              (r) =>
                new TableRow({
                  cantSplit: true,
                  children: [
                    cell([p([t(r.label, { size: 18, color: "475569" })])], { width: 34 }),
                    cell(
                      [p([t(r.value, { size: 18 })]), ...(r.note ? [p([t(`Note: ${r.note}`, { size: 17, italics: true, color: "475569" })], { before: 30 })] : [])],
                      { width: 50 },
                    ),
                    cell([p([t(r.rating ?? "—", { size: 18, color: r.rating ? RATING_COLOR[r.rating] : "94A3B8", bold: !!r.rating })])], { width: 16 }),
                  ],
                }),
            ),
          ],
        }),
      );
    }

    // Visitor notes
    if (v.facts.length || v.comments) {
      children.push(heading("Home visitor's notes"));
      for (const f of v.facts) children.push(p([t(`${f.label}: `, { color: "64748B", size: 19 }), t(f.value, { size: 19 })], { after: 30 }));
      if (v.comments) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { ...tableNoBorders, left: { style: BorderStyle.SINGLE, size: 18, color: BLUE } },
            rows: [new TableRow({ children: [cell(v.comments.split("\n").map((l) => p([t(l, { size: 20 })])), { fill: "F8FAFC", borders: noBorders, margin: 110 })] })],
          }),
        );
      }
    }
  }

  // Photos: 2 × 2 grid; empty slots stay as framed space.
  children.push(heading("Photos"));
  const slot = (ph: ReportModel["photos"][number]) =>
    cell(
      ph
        ? [p([img(ph.image, 300, 215)], { align: AlignmentType.CENTER }), ...(ph.caption ? [p([t(ph.caption, { size: 17, color: "475569" })], { align: AlignmentType.CENTER, before: 40 })] : [])]
        : [p([t("Photo", { size: 17, color: "94A3B8" })], { align: AlignmentType.CENTER, before: 1300, after: 1300 })],
      { width: 50, margin: 100, vAlign: VerticalAlign.CENTER },
    );
  const photos = [...m.photos, null, null, null, null].slice(0, 4);
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [new TableRow({ cantSplit: true, children: [slot(photos[0]), slot(photos[1])] }), new TableRow({ cantSplit: true, children: [slot(photos[2]), slot(photos[3])] })],
    }),
  );

  // Signatures
  children.push(p([], { before: 600 }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableNoBorders,
      rows: [
        new TableRow({
          cantSplit: true,
          // Three signature lines with gaps between them (spacer cells have no border).
          children: [
            ["Home visitor", v?.visitorName ?? ""],
            ["Reviewed by (Selection committee)", ""],
            ["Date", ""],
          ].flatMap(([label, name], i) => [
            ...(i > 0 ? [cell([p([])], { width: 5, borders: noBorders })] : []),
            cell(
              [p([t(label, { size: 17, color: "475569" })]), ...(name ? [p([t(name, { size: 18 })])] : [])],
              { width: 30, borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" } } },
            ),
          ]),
        }),
      ],
    }),
  );
  children.push(
    p([t(`Confidential — for Passerelles Numériques selection committee use only. Generated by the Scholarship Selection Tracker on ${m.generated}.`, { size: 15, color: "64748B" })], {
      before: 400,
    }),
  );

  const doc = new Document({
    creator: "PNC Selection",
    title: m.fileName,
    sections: [
      {
        properties: { page: { margin: { top: 794, bottom: 907, left: 794, right: 794 } } }, // 14 / 16 mm
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ font, size: 15, color: "64748B", text: `Home Visit Report · ${m.student.name} (${m.student.code}) · Confidential    ` }),
                  new TextRun({ font, size: 15, color: "64748B", children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${m.fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
