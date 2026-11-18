/**
 * Word (.docx) version of the printable exam lists — same content as the page:
 * one page per room, PN logo, centered title, exam center in bold.
 * The docx library is loaded only when someone clicks "Download Word".
 */
import type { CandidateDetails } from "@/features/written-exam/scoring";

export type DocxRow = { examNumber: string; details: CandidateDetails };
export type DocxGroup = { room: string; capacity: number | null; rows: DocxRow[] };

const BLUE = "00427A";
const GENDER: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };
const fmtDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

async function loadLogo(): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    const res = await fetch("/brand/pn-logo.png");
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    const url = URL.createObjectURL(new Blob([data], { type: "image/png" }));
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / Math.max(img.naturalHeight, 1));
      img.onerror = () => resolve(3);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    const height = 44;
    return { data, width: Math.round(height * ratio), height };
  } catch {
    return null;
  }
}

export async function downloadExamListDocx(opts: {
  type: "wall" | "attendance";
  cycleName: string;
  centerName: string;
  provinceName: string | null;
  sessionText: string;
  papers: string[];
  groups: DocxGroup[];
  fileName: string;
}) {
  const d = await import("docx");
  const {
    AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageNumber, PageOrientation, Paragraph, ShadingType,
    Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
  } = d;
  const logo = await loadLogo();
  const isWall = opts.type === "wall";
  const font = "Calibri";
  const size = isWall ? 24 : 18; // half-points: 12pt / 9pt
  const grey = "CBD5E1";
  const border = { style: BorderStyle.SINGLE, size: 4, color: grey };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const text = (t: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
    new TextRun({ text: t, font, size: o.size ?? size, bold: o.bold, color: o.color, italics: o.italics });

  // Columns: label, width %, value.
  type Col = { label: string; width: number; value: (r: DocxRow, i: number) => string; bold?: boolean };
  const cols: Col[] = isWall
    ? [
        { label: "ID", width: 13, value: (r) => r.examNumber, bold: true },
        { label: "First name", width: 21, value: (r) => r.details.firstName },
        { label: "Last name", width: 21, value: (r) => r.details.lastName },
        { label: "Gender", width: 12, value: (r) => GENDER[r.details.gender ?? ""] ?? "" },
        { label: "High school", width: 33, value: (r) => r.details.highSchool ?? "" },
      ]
    : (() => {
        const subjects = opts.papers.length ? opts.papers : ["Signature"];
        const subjectWidth = Math.max(7, Math.min(12, 24 / subjects.length));
        const rest = 100 - subjectWidth * subjects.length;
        // Fixed columns, scaled to the width left over by the subject columns.
        const fixed: [string, number, Col["value"], boolean?][] = [
          ["#", 3, (_r, i) => String(i + 1)],
          ["ID number", 7, (r) => r.examNumber],
          ["First name", 10, (r) => r.details.firstName],
          ["Last name", 10, (r) => r.details.lastName],
          ["Gender", 6, (r) => GENDER[r.details.gender ?? ""] ?? ""],
          ["DoB", 8, (r) => fmtDate(r.details.dob)],
          ["High school", 14, (r) => r.details.highSchool ?? ""],
          ["Exam center", 11, () => opts.centerName, true],
          ["Province", 9, (r) => r.details.province ?? ""],
          ["NGO", 10, (r) => r.details.ngo ?? ""],
        ];
        const sum = fixed.reduce((n, f) => n + f[1], 0);
        return [
          ...fixed.map(([label, w, value, bold]) => ({ label, width: (w / sum) * rest, value, bold })),
          ...subjects.map((s) => ({ label: s, width: subjectWidth, value: () => "" })),
        ];
      })();

  const headerCell = (label: string, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      shading: { type: ShadingType.CLEAR, color: "auto", fill: "F1F5F9" },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({ children: [text(label.toUpperCase(), { bold: true, size: isWall ? 16 : 14, color: "475569" })] })],
    });
  const bodyCell = (value: string, width: number, bold?: boolean) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: isWall ? 80 : 100, bottom: isWall ? 80 : 100, left: 80, right: 80 },
      children: [new Paragraph({ children: [text(value, { bold })] })],
    });

  const sections = opts.groups.map((g) => {
    const info = `${g.room} · ${opts.sessionText} · ${g.rows.length} candidate${g.rows.length === 1 ? "" : "s"}${g.capacity ? ` · ${g.capacity} seats` : ""}`;
    const children = [
      ...(logo
        ? [new Paragraph({ children: [new ImageRun({ type: "png", data: logo.data, transformation: { width: logo.width, height: logo.height } })] })]
        : []),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [text(isWall ? "Written exam — candidate list" : "Written exam — attendance list", { bold: true, size: 32, color: BLUE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          text(`${opts.cycleName} · `, { size: 20, color: "475569" }),
          text(opts.centerName, { size: 22, bold: true, color: "0F172A" }),
          text(opts.provinceName ? `, ${opts.provinceName}` : "", { size: 20, color: "475569" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 6 } },
        children: [text(info, { size: isWall ? 24 : 20, bold: isWall })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({ tableHeader: true, children: cols.map((c) => headerCell(c.label, c.width)) }),
          ...g.rows.map(
            (r, i) => new TableRow({ cantSplit: true, children: cols.map((c) => bodyCell(c.value(r, i), c.width, c.bold)) }),
          ),
        ],
      }),
      ...(isWall
        ? []
        : [
            new Paragraph({ spacing: { before: 480 }, children: [] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
              rows: [
                new TableRow({
                  children: ["Present (total)", "Supervisor name", "Supervisor signature"].map(
                    (l) =>
                      new TableCell({
                        width: { size: 33, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" }, bottom: noBorder, left: noBorder, right: noBorder },
                        margins: { right: 400 },
                        children: [new Paragraph({ children: [text(l, { size: 16, color: "475569" })] })],
                      }),
                  ),
                }),
              ],
            }),
          ]),
    ];
    return {
      properties: {
        page: {
          size: { orientation: isWall ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE },
          margin: { top: 567, bottom: 567, left: 567, right: 567 }, // 1 cm
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ font, size: 16, color: "64748B", children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }),
              ],
            }),
          ],
        }),
      },
      children,
    };
  });

  const doc = new Document({ creator: "PNC Selection", title: opts.fileName, sections });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${opts.fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
