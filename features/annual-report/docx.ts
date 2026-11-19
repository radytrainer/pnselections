/**
 * Word (.docx) version of the Annual Report — same chapters, figures, tables
 * and photos as the printable page. Bar charts are drawn on a canvas and
 * placed as images. docx is loaded only when someone clicks "Download Word".
 */
import type { IBorderOptions, ITableCellOptions, Paragraph as TParagraph, Table as TTable, TextRun as TTextRun, ImageRun as TImageRun } from "docx";
import { fetchReportImage, type ReportImage } from "@/app/report/students/[studentId]/reportImages";
import { reportPhotoUrl } from "@/services/annualReportService";
import { STAGES, type StageKey } from "./content";
import { fmt, lines, paragraphs, pct, usd, type Bar, type Count, type ProvinceRow, type ReportModel } from "./model";


type Png = { data: ArrayBuffer; width: number; height: number };

/** Horizontal bar chart as a PNG (drawn at 2× for sharp printing). */
async function barChart(items: Bar[], color: string, total?: number): Promise<Png | null> {
  const shown = items.filter((b) => b.value > 0);
  if (!shown.length || typeof document === "undefined") return null;
  const W = 620;
  const rowH = 26;
  const H = shown.length * rowH + 8;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const labelW = 210;
  const max = Math.max(...shown.map((b) => b.value));
  ctx.textBaseline = "middle";
  shown.forEach((b, i) => {
    const y = 4 + i * rowH;
    ctx.fillStyle = "#1E293B";
    ctx.font = "13px Calibri, Arial, sans-serif";
    let label = b.label;
    while (ctx.measureText(label).width > labelW - 10 && label.length > 4) label = `${label.slice(0, -2)}…`;
    ctx.fillText(label, 0, y + rowH / 2);
    const bw = Math.max(3, ((W - labelW - 90) * b.value) / max);
    ctx.fillStyle = `#${color}`;
    ctx.beginPath();
    ctx.roundRect(labelW, y + 6, bw, rowH - 12, 3);
    ctx.fill();
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 13px Calibri, Arial, sans-serif";
    const value = `${fmt(b.value)}${total ? ` (${pct(b.value, total)}%)` : ""}`;
    ctx.fillText(value, labelW + bw + 6, y + rowH / 2);
  });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return null;
  return { data: await blob.arrayBuffer(), width: W, height: H };
}

export async function downloadAnnualReportDocx(m: ReportModel) {
  const d = await import("docx");
  const {
    AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table,
    TableCell, TableRow, TextRun, WidthType,
  } = d;
  const th = m.theme;
  const NAVY = th.primary;
  const CYAN = th.second;
  const ORANGE = th.accent;
  const MUTED = th.muted;
  const LINE = th.line;
  const SOFT = th.soft;
  /** First font of the template's CSS stack (Calibri, Segoe UI or Georgia). */
  const font = th.font.split(",")[0].replace(/'/g, "").trim();
  const ruled = th.tableHead === "rule";
  const line: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: none, bottom: none, left: none, right: none };
  const tableNoBorders = { ...noBorders, insideHorizontal: none, insideVertical: none };
  type Block = TParagraph | TTable;
  type Run = TTextRun | TImageRun;

  const t = (text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
    new TextRun({ text, font, size: o.size ?? 21, bold: o.bold, color: o.color, italics: o.italics });
  const p = (children: Run[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; shade?: string } = {}) =>
    new Paragraph({
      alignment: o.align,
      spacing: { before: o.before ?? 0, after: o.after ?? 120, line: 288 },
      shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined,
      children,
    });
  const para = (text: string, o: { bold?: boolean; italics?: boolean; color?: string } = {}) =>
    p([t(text, o)], { align: AlignmentType.JUSTIFIED });
  const cell = (children: TParagraph[], o: { width?: number; fill?: string; borders?: ITableCellOptions["borders"]; margin?: number; vAlign?: ITableCellOptions["verticalAlign"]; span?: number } = {}) =>
    new TableCell({
      width: o.width != null ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
      borders: o.borders ?? { top: line, bottom: line, left: none, right: none },
      shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
      margins: { top: o.margin ?? 60, bottom: o.margin ?? 60, left: 100, right: 100 },
      verticalAlign: o.vAlign,
      columnSpan: o.span,
      children,
    });
  const img = (im: { data: ArrayBuffer; width: number; height: number }, maxW: number, maxH: number, type: "png" | "jpg" = "jpg") => {
    const s = Math.min(maxW / im.width, maxH / im.height);
    return new ImageRun({ type, data: im.data, transformation: { width: Math.round(im.width * s), height: Math.round(im.height * s) } });
  };

  // ---- Pieces --------------------------------------------------------------
  let firstChapter = true;
  const chapter = (number: string, title: string, lead?: string): Block[] => {
    const out: Block[] = [];
    if (!firstChapter) out.push(new Paragraph({ children: [new PageBreak()] }));
    firstChapter = false;
    if (th.head === "number") {
      // Modern: big accent number, "CHAPTER" label, title, short accent bar.
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${number}  `, font, size: 72, bold: true, color: ORANGE }),
            new TextRun({ text: title, font, size: 46, bold: true, color: NAVY }),
          ],
        }),
        new Paragraph({ spacing: { after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 30, color: ORANGE, space: 1 } }, indent: { right: 8000 }, children: [] }),
      );
      if (lead) out.push(p([t(lead, { color: MUTED, size: 22 })], { before: 140, after: 220 }));
      else out.push(p([], { after: 120 }));
      return out;
    }
    if (th.head === "centered") {
      // Formal: centered "CHAPTER 02", title, double rule.
      out.push(
        p([t(`CHAPTER ${number}`, { color: ORANGE, size: 18 })], { align: AlignmentType.CENTER, after: 60 }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: NAVY, space: 6 } },
          indent: { left: 2600, right: 2600 },
          children: [new TextRun({ text: title, font, size: 44, color: NAVY })],
        }),
      );
      if (lead) out.push(p([t(lead, { italics: true, color: MUTED })], { before: 160, after: 220, align: AlignmentType.CENTER }));
      else out.push(p([], { after: 160 }));
      return out;
    }
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: NAVY, space: 4 } },
        children: [
          new TextRun({ text: ` ${number} `, font, size: 30, bold: true, color: "FFFFFF", shading: { type: ShadingType.CLEAR, color: "auto", fill: ORANGE } }),
          new TextRun({ text: `  ${title}`, font, size: 40, bold: true, color: NAVY }),
        ],
      }),
    );
    if (lead) out.push(p([t(lead, { italics: true, color: MUTED })], { before: 120, after: 200 }));
    else out.push(p([], { after: 120 }));
    return out;
  };
  const h3 = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text, font, size: 25, bold: true, color: NAVY })] });
  const body = (summary?: string, text?: string): Block[] => [
    ...(summary ? [para(summary, { bold: false })] : []),
    ...(text ? paragraphs(text).map((x) => para(x)) : []),
  ];
  const callout = (title: string, text: string, color = ORANGE, fill = "FFF5EB"): Block[] =>
    text.trim()
      ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableNoBorders,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  cell([p([t(title.toUpperCase(), { bold: true, color, size: 19 })], { after: 60 }), ...paragraphs(text).map((x) => p([t(x)], { align: AlignmentType.JUSTIFIED, after: 80 }))], {
                    fill,
                    borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 24, color } },
                    margin: 120,
                  }),
                ],
              }),
            ],
          }),
          p([], { after: 120 }),
        ]
      : [];
  const tiles = (items: { value: string; label: string; accent?: boolean }[]): Block[] => {
    const shown = items.filter((x) => x.value !== "—" && x.value !== "0");
    if (!shown.length) return [];
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { ...tableNoBorders, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" } },
        rows: [
          new TableRow({
            cantSplit: true,
            children: shown.map((x) =>
              th.tiles === "outline"
                ? cell(
                    [p([t(x.value, { bold: th.head !== "centered", size: 38, color: x.accent ? ORANGE : NAVY })], { after: 0 }), p([t(x.label, { size: 17, color: MUTED })], { after: 0 })],
                    {
                      width: 100 / shown.length,
                      fill: x.accent ? SOFT : undefined,
                      borders: { top: line, bottom: line, right: line, left: { style: BorderStyle.SINGLE, size: 24, color: x.accent ? ORANGE : NAVY } },
                      margin: 110,
                    },
                  )
                : cell(
                [p([t(x.value, { bold: true, size: 38, color: x.accent ? "FFFFFF" : NAVY })], { after: 0 }), p([t(x.label, { size: 17, color: x.accent ? "FFFFFF" : MUTED })], { after: 0 })],
                { width: 100 / shown.length, fill: x.accent ? NAVY : SOFT, borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 18, color: x.accent ? ORANGE : CYAN } }, margin: 110 },
              ),
            ),
          }),
        ],
      }),
      p([], { after: 160 }),
    ];
  };
  const genderLine = (c: Count, label: string): Block[] =>
    c.total
      ? [
          p(
            [
              t(`${label}: `, { color: MUTED, size: 19 }),
              t(`Female ${fmt(c.female)} (${pct(c.female, c.total)}%)`, { bold: true, color: ORANGE, size: 19 }),
              t("   ·   ", { color: MUTED, size: 19 }),
              t(`Male ${fmt(c.male)} (${pct(c.male, c.total)}%)`, { bold: true, color: NAVY, size: 19 }),
              ...(c.other ? [t(`   ·   LGBTQIA+ / not recorded ${fmt(c.other)}`, { color: MUTED, size: 19 })] : []),
            ],
            { after: 160 },
          ),
        ]
      : [];
  const table = (head: string[], rows: string[][], o: { foot?: string[]; numeric?: number[]; widths?: number[] } = {}): Block[] => {
    const num = new Set(o.numeric ?? []);
    const mk = (cells: string[], kind: "head" | "body" | "foot", zebra = false) =>
      new TableRow({
        tableHeader: kind === "head",
        cantSplit: true,
        children: cells.map((c, i) =>
          cell([p([t(c, { bold: kind !== "body", color: kind === "head" ? (ruled ? NAVY : "FFFFFF") : undefined, size: 18 })], { after: 0, align: num.has(i) ? AlignmentType.RIGHT : AlignmentType.LEFT })], {
            width: o.widths?.[i],
            fill: kind === "head" ? (ruled ? undefined : NAVY) : kind === "foot" ? SOFT : zebra ? "F8FAFC" : undefined,
            borders:
              kind === "foot"
                ? { top: { style: BorderStyle.SINGLE, size: 10, color: NAVY }, bottom: none, left: none, right: none }
                : kind === "head" && ruled
                  ? { top: { style: BorderStyle.SINGLE, size: 10, color: NAVY }, bottom: { style: BorderStyle.SINGLE, size: 10, color: NAVY }, left: none, right: none }
                  : undefined,
          }),
        ),
      });
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableNoBorders,
        rows: [mk(head, "head"), ...rows.map((r, i) => mk(r, "body", i % 2 === 1)), ...(o.foot ? [mk(o.foot, "foot")] : [])],
      }),
      p([], { after: 160 }),
    ];
  };
  const provinceTable = (rows: ProvinceRow[], extraLabel?: string, extra?: (r: ProvinceRow) => number): Block[] => {
    if (!rows.length) return [para("No data recorded in the app for this cycle.", { italics: true, color: MUTED })];
    const sum = (f: (r: ProvinceRow) => number) => fmt(rows.reduce((a, r) => a + f(r), 0));
    const head = ["No", "Province", ...(extraLabel ? [extraLabel] : []), "Female", "Male", "Total"];
    return table(
      head,
      rows.map((r, i) => [String(i + 1), r.province, ...(extra ? [fmt(extra(r))] : []), fmt(r.female), fmt(r.male), fmt(r.total)]),
      {
        foot: ["", "Total", ...(extra ? [sum(extra)] : []), sum((r) => r.female), sum((r) => r.male), sum((r) => r.total)],
        numeric: extraLabel ? [2, 3, 4, 5] : [2, 3, 4],
        widths: extraLabel ? [7, 41, 13, 13, 13, 13] : [7, 48, 15, 15, 15],
      },
    );
  };
  const chart = async (items: Bar[], color: string, total?: number): Promise<Block[]> => {
    const png = await barChart(items, color, total);
    return png ? [p([img(png, 600, 400, "png")], { after: 160 })] : [para("No data recorded in the app for this cycle.", { italics: true, color: MUTED })];
  };

  // Photos are fetched once, resized, and laid out two per row.
  const photoCache = new Map<string, ReportImage | null>();
  const loadPhoto = async (path: string) => {
    if (!photoCache.has(path)) photoCache.set(path, await fetchReportImage(reportPhotoUrl(path, 768), 1000));
    return photoCache.get(path) ?? null;
  };
  const photos = async (paths: string[] | undefined, max = 4): Promise<Block[]> => {
    const ims = (await Promise.all((paths ?? []).slice(0, max).map(loadPhoto))).filter((x): x is ReportImage => !!x);
    if (!ims.length) return [];
    if (ims.length === 1) return [p([img(ims[0], 600, 330)], { align: AlignmentType.CENTER, after: 200 })];
    const rows: InstanceType<typeof TableRow>[] = [];
    for (let i = 0; i < ims.length; i += 2) {
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [ims[i], ims[i + 1]].map((im) => cell(im ? [p([img(im, 290, 200)], { align: AlignmentType.CENTER, after: 0 })] : [p([])], { width: 50, borders: noBorders, margin: 40 })),
        }),
      );
    }
    return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableNoBorders, rows }), p([], { after: 160 })];
  };

  const logo = await fetch("/brand/pn-logo.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const logoWhite = await fetch("/brand/pn-logo-white.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const f = m.fig;
  const shown = new Set(m.chapters.map((c) => c.key));
  const num = (k: string) => m.chapters.find((c) => c.key === k)?.number ?? "";
  const stageLabel = (k: StageKey) => STAGES.find((s) => s.key === k)?.label ?? k;

  // ---- Cover ---------------------------------------------------------------
  const supportedBlock = (align?: (typeof AlignmentType)[keyof typeof AlignmentType]): Block[] =>
    m.supportedBy.length
      ? [p([t("SUPPORTED BY", { bold: true, color: NAVY, size: 18 })], { before: 300, after: 60, align }), p([t(m.supportedBy.join("   ·   "), { size: 20 })], { align })]
      : [];
  const banner = (children: TParagraph[], o: { fill: string; rule?: string; margin?: number }) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableNoBorders,
      rows: [new TableRow({ children: [cell(children, { fill: o.fill, borders: { ...noBorders, ...(o.rule ? { bottom: { style: BorderStyle.SINGLE, size: 36, color: o.rule } } : {}) }, margin: o.margin ?? 400 })] })],
    });
  let cover: Block[];
  if (th.cover === "formal") {
    // Formal: white, centered, thin rules, framed photo.
    cover = [
      ...(logo ? [p([new ImageRun({ type: "png", data: logo, transformation: { width: 200, height: 85 } })], { align: AlignmentType.CENTER, before: 400, after: 500 })] : []),
      p([t(m.cycleName.toUpperCase(), { color: ORANGE, size: 20 })], { align: AlignmentType.CENTER, after: 120 }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 10 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 10 } },
        indent: { left: 1400, right: 1400 },
        children: [new TextRun({ text: m.title, font, size: 64, color: NAVY })],
      }),
      p([t(m.subtitle, { italics: true, size: 30 })], { align: AlignmentType.CENTER, before: 200, after: 40 }),
      p([t(m.generation, { color: MUTED, size: 26 })], { align: AlignmentType.CENTER, after: 300 }),
      ...(await photos(m.photos.cover, 1)),
      p([t(m.tagline, { italics: true, color: MUTED, size: 20 })], { align: AlignmentType.CENTER, before: 200 }),
      ...supportedBlock(AlignmentType.CENTER),
    ];
  } else if (th.cover === "photo") {
    // Modern: big photo, then a dark block with the title.
    cover = [
      ...(logo ? [p([new ImageRun({ type: "png", data: logo, transformation: { width: 150, height: 64 } })], { after: 240 })] : []),
      ...(await photos(m.photos.cover, 1)),
      banner(
        [
          p([t(m.cycleName.toUpperCase(), { color: "CBD5E1", size: 20 })], { after: 80 }),
          p([t(m.title, { bold: true, color: "FFFFFF", size: 72 })], { after: 120 }),
          p([t(m.subtitle, { bold: true, color: ORANGE, size: 32 })], { after: 40 }),
          p([t(m.generation, { color: "FFFFFF", size: 26 })], { after: 200 }),
          p([t(m.tagline, { color: "CBD5E1", size: 20 })], { after: 0 }),
        ],
        { fill: NAVY, rule: ORANGE },
      ),
      ...supportedBlock(),
      p([t("Passerelles numériques Cambodia", { color: MUTED, size: 18 })], { before: 200 }),
    ];
  } else {
    cover = [
      banner(
        [
          ...(logoWhite ? [p([new ImageRun({ type: "png", data: logoWhite, transformation: { width: 190, height: 81 } })], { after: 500 })] : []),
          p([t(m.cycleName.toUpperCase(), { color: "D6E9F8", size: 22 })], { after: 60 }),
          p([t(m.title.toUpperCase(), { bold: true, color: "FFFFFF", size: 64 })], { after: 120 }),
          p([t(m.subtitle, { bold: true, italics: true, color: "FFD3A6", size: 34 })], { after: 40 }),
          p([t(m.generation, { bold: true, italics: true, color: "FFFFFF", size: 30 })], { after: 240 }),
          p([t(m.tagline, { color: "E2EEF8", size: 21 })], { after: 200 }),
        ],
        { fill: NAVY, rule: ORANGE },
      ),
      p([], { after: 200 }),
      ...(await photos(m.photos.cover, 1)),
      ...supportedBlock(),
      p([t("Passerelles numériques Cambodia", { color: MUTED, size: 18 })], { before: 200 }),
    ];
  }

  // ---- Chapters --------------------------------------------------------------
  const out: Block[] = [];
  if (shown.has("about")) {
    if (logo) out.push(p([new ImageRun({ type: "png", data: logo, transformation: { width: 140, height: 59 } })], { after: 240 }));
    out.push(...chapter(num("about"), "All about the Report"));
    out.push(
      ...(m.text.intro
        ? paragraphs(m.text.intro).map((x) => para(x))
        : [
            para(
              `The ${m.title} presents the complete journey of choosing the future scholars of Passerelles numériques Cambodia, from the first Information Session through the Qualifying Exam, Motivation Interviews and Home Visits, to the Final Selection Committee and contract signing. It also brings together the overall selection figures, the timeline, staff participation, the budget, recommendations for the coming year and the profile of the new class.`,
            ),
          ]),
    );
    out.push(h3("Table of Contents"));
    out.push(
      ...table(
        ["No", "Chapter"],
        m.chapters.filter((c) => c.key !== "about").map((c) => [c.number, c.label]),
        { widths: [12, 88] },
      ),
    );
  }

  if (shown.has("info_sessions")) {
    out.push(...chapter(num("info_sessions"), "Information Sessions", "Our first encounter with potential students: we introduce PN, set clear expectations, spark their interest in IT and answer their questions before they proceed to the exam."));
    out.push(
      ...tiles([
        { value: fmt(m.is.attendees.total), label: "attendees", accent: true },
        { value: fmt(f.is_sessions), label: `information sessions${f.is_online ? ` (${fmt(f.is_online)} online)` : ""}` },
        { value: `${pct(m.is.attendees.female, m.is.attendees.total)}%`, label: `girls${f.is_target_female ? ` · target ${f.is_target_female}%` : ""}` },
        { value: fmt(f.is_schools), label: "high schools / venues reached" },
      ]),
      ...genderLine(m.is.attendees, "Attendees"),
      ...body(m.summary.info_sessions, m.text.is_text),
      ...(await photos(m.photos.info_sessions)),
    );
    if (f.is_indigenous || f.is_disability || m.is.ngoRegistrations) {
      out.push(h3("Special categories"), ...tiles([
        { value: fmt(f.is_indigenous), label: "indigenous participants" },
        { value: fmt(f.is_disability), label: "persons with different abilities" },
        { value: fmt(m.is.ngoRegistrations), label: "registrations from NGO beneficiaries" },
      ]));
    }
    out.push(...callout("The challenge", m.text.is_challenges));
    if (m.is.byProvince.length) out.push(h3("Registrations by province"), ...provinceTable(m.is.byProvince, "Sessions", (r) => r.extra ?? 0));
    if (m.is.byPresenter.some((b) => b.label !== "Not recorded")) out.push(h3("Sessions presented by"), ...(await chart(m.is.byPresenter, NAVY, m.is.sessions.length)));
    if (m.text.collaboration || f.partner_schools || f.partner_ngos) {
      out.push(h3("Collaboration highlight"), ...tiles([{ value: fmt(f.partner_schools), label: "partner high schools" }, { value: fmt(f.partner_ngos), label: "NGO partners" }]), ...body(undefined, m.text.collaboration));
    }
  }

  if (shown.has("exams")) {
    out.push(...chapter(num("exams"), "Examinations", "A measure not of skills alone, but of determination and readiness to move forward. The exam assesses each applicant's capacity to follow PN's intensive IT training."));
    out.push(
      ...tiles([
        { value: fmt(f.exam_takers), label: "exam takers", accent: true },
        { value: fmt(f.exam_count), label: "exam sessions" },
        { value: fmt(f.exam_provinces), label: "provinces" },
        { value: fmt(f.exam_passed), label: `passed${f.exam_takers ? ` (${pct(f.exam_passed ?? 0, f.exam_takers)}%)` : ""}` },
      ]),
      ...genderLine({ total: f.exam_takers ?? 0, female: f.exam_female ?? 0, male: f.exam_male ?? 0, other: Math.max(0, (f.exam_takers ?? 0) - (f.exam_female ?? 0) - (f.exam_male ?? 0)) }, "Exam takers"),
      ...body(m.summary.exams, m.text.exam_text),
      ...(await photos(m.photos.exams)),
    );
    const protocol = lines(m.text.exam_protocol);
    if (protocol.length) {
      out.push(h3("Administration of the tests"));
      protocol.forEach((l) => out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [t(l)] })));
      out.push(p([], { after: 120 }));
    }
    out.push(...callout("Challenges", m.text.exam_challenges));
    if (m.exam.byProvince.length) {
      out.push(
        h3("Exam figures by province"),
        ...table(
          ["No", "Province", "Female", "Male", "Takers", "Passed", "Pass rate"],
          m.exam.byProvince.map((r, i) => [String(i + 1), r.province, fmt(r.female), fmt(r.male), fmt(r.total), fmt(r.passed), `${pct(r.passed, r.total)}%`]),
          {
            foot: ["", "Total", fmt(m.exam.takers.female), fmt(m.exam.takers.male), fmt(m.exam.takers.total), fmt(m.exam.passed.total), `${pct(m.exam.passed.total, m.exam.takers.total)}%`],
            numeric: [2, 3, 4, 5, 6],
            widths: [7, 33, 12, 12, 12, 12, 12],
          },
        ),
      );
    }
    if (m.exam.subjects.length) {
      out.push(
        h3(`Exam scores analysis${m.exam.selectedWithScores ? ` — all exam takers vs. ${fmt(m.exam.selectedWithScores)} selected students` : ""}`),
        ...table(
          ["Subject", "Max", "Min", "Highest", "Average", "Median", "Selected avg"],
          m.exam.subjects.map((s) => [
            s.subject,
            fmt(s.max),
            s.overall ? fmt(s.overall.min) : "—",
            s.overall ? fmt(s.overall.max) : "—",
            s.overall ? `${fmt(s.overall.avg)} (${pct(s.overall.avg, s.max)}%)` : "—",
            s.overall ? fmt(s.overall.median) : "—",
            s.selected ? `${fmt(s.selected.avg)} (${pct(s.selected.avg, s.max)}%)` : "—",
          ]),
          { numeric: [1, 2, 3, 4, 5, 6], widths: [24, 9, 9, 11, 17, 11, 19] },
        ),
        ...(await chart(m.exam.subjects.filter((s) => s.overall && s.max).map((s) => ({ label: `${s.subject} — average %`, value: pct(s.overall!.avg, s.max) })), CYAN)),
      );
    }
    out.push(...body(undefined, m.text.exam_analysis), ...callout("What next?", m.text.exam_next, CYAN, "EAF6FD"));
  }

  if (shown.has("interviews")) {
    out.push(...chapter(num("interviews"), "Motivation Interviews", "Each answer reflects not just knowledge, but a student's determination to embrace the challenges of the PN journey."));
    out.push(
      ...tiles([
        { value: fmt(f.mi_passed), label: "passed the interview", accent: true },
        { value: fmt(f.mi_interviewed), label: "students interviewed" },
        { value: fmt(f.mi_online), label: "interviewed online" },
        { value: `${pct(m.mi.passed.female, m.mi.passed.total)}%`, label: "female among passers" },
      ]),
      ...genderLine(m.mi.passed, "Interview passers"),
      ...body(m.summary.interviews, m.text.mi_text),
      ...(await photos(m.photos.interviews, 3)),
      ...callout("Challenges", m.text.mi_challenges),
    );
    if (m.mi.byProvince.length) out.push(h3("Interview passers by province"), ...provinceTable(m.mi.byProvince));
  }

  if (shown.has("home_visits")) {
    out.push(...chapter(num("home_visits"), "Home Visits", "Each student who passed the interview is visited to meet their family, explain PN and training life, clarify parents' responsibilities and confirm the family's economic situation."));
    out.push(
      ...tiles([
        { value: fmt(f.hv_visited), label: "families visited", accent: true },
        { value: fmt(m.hv.visited.other), label: "LGBTQIA+ / not recorded" },
        { value: fmt(f.hv_indigenous), label: "indigenous students" },
        { value: fmt(f.hv_youth_war), label: "youth from conflict-affected areas" },
      ]),
      ...genderLine(m.hv.visited, "Students visited"),
      ...body(m.summary.home_visits, m.text.hv_text),
      ...(await photos(m.photos.home_visits)),
      ...callout("Challenges", m.text.hv_challenges),
      h3("Poverty category (social form)"),
      ...(await chart(m.hv.categories, ORANGE, m.hv.visited.total)),
      h3("Vulnerabilities found"),
      ...(await chart(m.hv.vulnerabilities, NAVY, m.hv.visited.total)),
    );
    if (m.hv.byProvince.length) out.push(h3("Home visits by province"), ...provinceTable(m.hv.byProvince));
  }

  if (shown.has("committee")) {
    out.push(...chapter(num("committee"), "Final Selection Committee", "Behind every deliberation was a story of challenges faced, strength shown, and an unwavering desire for success."));
    out.push(
      ...tiles([
        { value: fmt(f.fsc_cases), label: "cases presented", accent: true },
        { value: fmt(f.fsc_eligible), label: "eligible for the final list" },
        { value: fmt(f.fsc_indigenous), label: "indigenous students" },
        { value: fmt(f.fsc_muslim), label: "Muslim students" },
      ]),
      ...genderLine(m.fsc.cases, "Cases"),
      ...body(m.summary.committee, m.text.fsc_text),
      ...(await photos(m.photos.committee, 3)),
      h3("Committee decisions"),
      ...(await chart(m.fsc.decisions, NAVY, m.fsc.cases.total)),
      h3("Scoring guide (vulnerability)"),
      ...table(["Points", "Level"], [["12 – 18", "Low vulnerability"], ["19 – 25", "Moderate vulnerability"], ["26 – 36", "High vulnerability"]], { widths: [30, 70] }),
    );
    if (m.text.ranking) out.push(h3("Global ranking"), ...body(undefined, m.text.ranking));
    if (m.fsc.byProvince.length) out.push(h3("Cases by province"), ...provinceTable(m.fsc.byProvince));
  }

  if (shown.has("announcement")) {
    out.push(...chapter(num("announcement"), "Final Announcement", "The seal of commitment to education, excellence and responsibility."));
    out.push(
      ...tiles([
        { value: fmt(f.contracts), label: "contracts signed", accent: true },
        { value: fmt(m.klass.total.male), label: "males" },
        { value: fmt(m.klass.total.female), label: "females" },
        { value: fmt(m.declined.total.total), label: "declined before enrollment" },
      ]),
      ...body(m.summary.announcement, m.text.announcement),
      ...(await photos(m.photos.announcement, 3)),
    );
    if (m.declined.byProvince.length || m.text.registration_history) {
      out.push(h3("Registration history — students who declined"), ...body(undefined, m.text.registration_history));
      if (m.declined.byProvince.length) {
        out.push(
          ...table(
            ["Province", "Male", "Female", "Main reasons"],
            m.declined.byProvince.map((r) => [r.province, fmt(r.male), fmt(r.female), r.reasons.join("; ") || "—"]),
            { foot: ["Total", fmt(m.declined.total.male), fmt(m.declined.total.female), ""], numeric: [1, 2], widths: [24, 10, 10, 56] },
          ),
        );
      }
    }
    out.push(...callout("Contract signing & D-Day", m.text.dday, CYAN, "EAF6FD"));
    if (m.klass.byProvince.length) {
      out.push(
        h3("Contracts signed by province"),
        ...table(
          ["No", "Province", "Contracts", "M", "F", "LGBTQIA+", "Disability in family"],
          m.klass.byProvince.map((r, i) => [String(i + 1), r.province, fmt(r.total), fmt(r.male), fmt(r.female), r.lgbtq ? fmt(r.lgbtq) : "", r.disability ? fmt(r.disability) : ""]),
          {
            foot: ["", "Total", fmt(m.klass.total.total), fmt(m.klass.total.male), fmt(m.klass.total.female), fmt(m.klass.total.other), fmt(m.klass.disability)],
            numeric: [2, 3, 4, 5, 6],
            widths: [7, 31, 13, 9, 9, 13, 18],
          },
        ),
      );
    }
  }

  if (shown.has("figures")) {
    out.push(...chapter(num("figures"), "Overall Selection Figures"));
    const first = m.funnel[0]?.value || 0;
    out.push(
      ...table(
        ["Stage", "Number", "% of attendees"],
        m.funnel.map((x, i) => [x.label, fmt(x.value), i === 0 || !first ? "" : `${pct(x.value, first)}%`]),
        { numeric: [1, 2], widths: [56, 22, 22] },
      ),
      ...(await chart(m.funnel, NAVY)),
      ...body(m.summary.figures, m.text.overall_text),
    );
  }

  if (shown.has("timeline")) {
    out.push(...chapter(num("timeline"), `SP${m.year} Timeline`));
    const rows = m.timeline.filter((x) => x.start);
    if (!rows.length) out.push(para("No dates recorded yet.", { italics: true, color: MUTED }));
    else {
      const months: string[] = [];
      const from = rows.map((r) => r.start.slice(0, 7)).sort()[0];
      const to = rows.map((r) => (r.end || r.start).slice(0, 7)).sort().pop()!;
      for (let y = Number(from.slice(0, 4)), mo = Number(from.slice(5, 7)); `${y}-${String(mo).padStart(2, "0")}` <= to && months.length < 24; ) {
        months.push(`${y}-${String(mo).padStart(2, "0")}`);
        if (++mo > 12) {
          mo = 1;
          y++;
        }
      }
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const colors = [CYAN, NAVY, ORANGE, "0A5A9C", "E0663A", "22A39F"];
      const w = Math.floor(70 / months.length);
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cell([p([t("Stage", { bold: true, color: "FFFFFF", size: 17 })], { after: 0 })], { width: 30, fill: NAVY }),
                ...months.map((mo) => cell([p([t(MON[Number(mo.slice(5, 7)) - 1], { bold: true, color: "FFFFFF", size: 15 })], { after: 0, align: AlignmentType.CENTER })], { width: w, fill: NAVY, margin: 40 })),
              ],
            }),
            ...rows.map((r, i) => {
              const a = months.indexOf(r.start.slice(0, 7));
              const b = months.indexOf((r.end || r.start).slice(0, 7));
              return new TableRow({
                cantSplit: true,
                children: [
                  cell([p([t(r.stage, { size: 17, bold: true })], { after: 0 })], { width: 30 }),
                  ...months.map((_, j) => cell([p([], { after: 0 })], { width: w, fill: a >= 0 && j >= a && j <= b ? colors[i % colors.length] : undefined, margin: 40 })),
                ],
              });
            }),
          ],
        }),
        p([], { after: 160 }),
      );
      const fd = (s: string) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
      out.push(...table(["Stage", "From", "To"], rows.map((r) => [r.stage, fd(r.start), fd(r.end)]), { widths: [50, 25, 25] }));
    }
    out.push(...body(undefined, m.text.timeline_text));
  }

  if (shown.has("staff")) {
    out.push(...chapter(num("staff"), "Overall Staff Participation"), ...body(m.summary.staff, m.text.staff_text));
    const used = STAGES.filter((s) => m.staff.some((x) => x.stages.has(s.key)));
    if (m.staff.length) {
      out.push(
        ...tiles(used.map((s) => ({ value: fmt(m.staff.filter((x) => x.stages.has(s.key)).length), label: s.label }))),
        ...table(
          ["No", "Name", ...used.map((s) => s.label)],
          m.staff.map((x, i) => [String(i + 1), x.name, ...used.map((s) => (x.stages.has(s.key) ? "✓" : ""))]),
          { widths: [7, 33, ...used.map(() => Math.floor(60 / Math.max(1, used.length)))] },
        ),
      );
    } else out.push(para("No staff recorded yet.", { italics: true, color: MUTED }));
  }

  if (shown.has("budget")) {
    const b = m.budget;
    out.push(...chapter(num("budget"), "Overall Selection Budget"));
    if (b.rows.length) {
      out.push(
        ...tiles([{ value: `$${usd(b.grand)}`, label: "total expenses (USD)", accent: true }, ...b.columns.map((k) => ({ value: `${pct(b.totals[k], b.grand)}%`, label: stageLabel(k) }))]),
        ...table(
          ["Expense", ...b.columns.map(stageLabel), "Total (USD)"],
          b.rows.map((r) => [r.item, ...b.columns.map((k) => (Number(r.amounts[k]) ? usd(Number(r.amounts[k])) : "")), usd(r.total)]),
          { foot: ["Grand total", ...b.columns.map((k) => usd(b.totals[k])), usd(b.grand)], numeric: b.columns.map((_, i) => i + 1).concat(b.columns.length + 1) },
        ),
      );
    } else out.push(para("No budget entered yet.", { italics: true, color: MUTED }));
    out.push(...body(m.summary.budget, m.text.budget_text));
  }

  if (shown.has("recommendations")) {
    out.push(...chapter(num("recommendations"), "General Recommendations"));
    STAGES.forEach((s, i) => {
      const r = m.reviews[s.key];
      if (!r.strengths?.trim() && !r.challenges?.trim() && !r.recommendations?.trim()) return;
      const tone = i % 2 ? CYAN : ORANGE;
      const inner: TParagraph[] = [p([t(s.label, { bold: true, size: 25, color: NAVY })], { after: 80 })];
      if (r.strengths?.trim()) inner.push(p([t("Strengths observed: ", { bold: true, color: NAVY }), t(r.strengths.trim())], { align: AlignmentType.JUSTIFIED }));
      if (r.challenges?.trim()) inner.push(p([t("Challenges noted: ", { bold: true, color: NAVY }), t(r.challenges.trim())], { align: AlignmentType.JUSTIFIED }));
      if (r.recommendations?.trim()) {
        inner.push(p([t("RECOMMENDATIONS", { bold: true, color: tone, size: 19 })], { after: 40 }));
        lines(r.recommendations).forEach((l) => inner.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [t(l)] })));
      }
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableNoBorders,
          rows: [new TableRow({ cantSplit: true, children: [cell(inner, { borders: { top: { style: BorderStyle.SINGLE, size: 24, color: tone }, bottom: line, left: line, right: line }, margin: 140 })] })],
        }),
        p([], { after: 160 }),
      );
    });
    out.push(...callout("Overall recommendation", m.text.overall_recommendation, NAVY, SOFT));
  }

  if (shown.has("class")) {
    const k = m.klass;
    out.push(...chapter(num("class"), `Class ${m.year + 2} Profile`));
    out.push(
      ...tiles([
        { value: fmt(k.total.total), label: "new scholars", accent: true },
        { value: fmt(k.provinces), label: "provinces" },
        { value: fmt(k.districts), label: "districts" },
        { value: f.class_rural ? `${pct(f.class_rural, k.total.total)}%` : fmt(k.fromNgo), label: f.class_rural ? `from rural areas (${fmt(f.class_rural)})` : "referred by NGO partners" },
      ]),
      ...genderLine(k.total, "Class"),
      ...body(m.summary.class, m.text.class_text),
      ...(await photos(m.photos.class)),
      h3("Age"),
      ...(await chart(k.ages, CYAN, k.total.total)),
      h3("Position among siblings"),
      ...(await chart(k.childRank, NAVY, k.childRank.reduce((a, b) => a + b.value, 0))),
      h3("Parents"),
      ...(await chart(k.parents, ORANGE, k.parents.reduce((a, b) => a + b.value, 0))),
      h3("Household"),
      ...tiles([
        { value: k.household.avg != null ? fmt(k.household.avg) : "—", label: "average household size" },
        { value: k.household.max != null ? fmt(k.household.max) : "—", label: "largest household" },
      ]),
      h3("Monthly family income"),
      ...(await chart(k.income, ORANGE, k.income.reduce((a, b) => a + b.value, 0))),
      ...(f.poverty_line ? [para(`National poverty line: USD ${fmt(f.poverty_line)} per person per month.`, { color: MUTED })] : []),
      h3("Fathers' occupation"),
      ...(await chart(k.fatherJobs, NAVY)),
      h3("Mothers' occupation"),
      ...(await chart(k.motherJobs, CYAN)),
    );
  }

  if (shown.has("conclusion")) {
    out.push(...chapter(num("conclusion"), "Conclusion"), ...(await photos(m.photos.conclusion, 1)));
    const text = m.text.conclusion
      ? paragraphs(m.text.conclusion)
      : [`The ${m.year} Selection Process reached ${fmt(m.is.attendees.total || f.exam_takers)} young people; ${fmt(f.contracts)} of them were chosen — a reflection of PNC's commitment to providing quality opportunities for the most motivated and deserving candidates.`];
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableNoBorders,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [cell(text.map((x) => p([t(x, { bold: true, italics: true, color: "FFFFFF", size: 24 })], { after: 80 })), { fill: NAVY, borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 36, color: ORANGE } }, margin: 220 })],
          }),
        ],
      }),
      p([], { after: 400 }),
      ...(logo ? [p([new ImageRun({ type: "png", data: logo, transformation: { width: 110, height: 47 } })], { after: 60 })] : []),
      p([t(`Report generated on ${m.generated}`, { size: 17, color: MUTED })]),
    );
  }

  const margins = { top: 1000, bottom: 1000, left: 1000, right: 1000 };
  const doc = new Document({
    creator: "PNC Selection",
    title: `PNC ${m.title}`,
    styles: { default: { document: { run: { font, size: 21 } } } },
    features: { updateFields: false },
    sections: [
      { properties: { page: { margin: margins } }, children: cover },
      {
        properties: { page: { margin: margins } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
                tabStops: [{ type: "right", position: 9900 }],
                children: [
                  new TextRun({ font, size: 15, color: MUTED, text: `Passerelles numériques Cambodia · ${m.title}` }),
                  new TextRun({ font, size: 16, bold: true, color: NAVY, children: ["\t", PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: out,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `PNC ${m.title}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
