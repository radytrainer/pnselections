/**
 * Report templates: the same content and figures, three different looks.
 * The chosen key is saved in the report content (`template`) and used by
 * the preview, the PDF and the Word file. Colors are hex without "#" so the
 * Word export can use them directly.
 */
export type TemplateKey = "classic" | "modern" | "formal";

export type ReportTheme = {
  key: TemplateKey;
  name: string;
  description: string;
  /** Main color (headings, table headers, accent tiles). */
  primary: string;
  /** Highlight color (chapter numbers, female bars, accent rules). */
  accent: string;
  /** Secondary color (thin rules, bars). */
  second: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  /** Font for body text and headings (CSS stack; first name is used in Word). */
  font: string;
  headFont: string;
  cover: "band" | "photo" | "formal";
  head: "chip" | "number" | "centered";
  tiles: "filled" | "outline";
  tableHead: "filled" | "rule";
};

export const TEMPLATES: Record<TemplateKey, ReportTheme> = {
  classic: {
    key: "classic",
    name: "Classic",
    description: "PN navy, orange and cyan — colorful bands like the printed report.",
    primary: "00427A",
    accent: "F28C28",
    second: "1BA1E2",
    ink: "1E293B",
    muted: "64748B",
    line: "E2E8F0",
    soft: "F1F7FC",
    font: "Calibri, 'Segoe UI', system-ui, sans-serif",
    headFont: "Calibri, 'Segoe UI', system-ui, sans-serif",
    cover: "band",
    head: "chip",
    tiles: "filled",
    tableHead: "filled",
  },
  modern: {
    key: "modern",
    name: "Modern",
    description: "Full-photo cover, teal accents and large chapter numbers.",
    primary: "0F2D52",
    accent: "0EA5A4",
    second: "F59E0B",
    ink: "0F172A",
    muted: "64748B",
    line: "E5E7EB",
    soft: "F0FDFA",
    font: "'Segoe UI', Arial, system-ui, sans-serif",
    headFont: "'Segoe UI', Arial, system-ui, sans-serif",
    cover: "photo",
    head: "number",
    tiles: "outline",
    tableHead: "filled",
  },
  formal: {
    key: "formal",
    name: "Formal",
    description: "Serif, document style — white cover, centered headings, ruled tables.",
    primary: "1F2A44",
    accent: "9A7B2F",
    second: "5B6B8C",
    ink: "1F2937",
    muted: "6B7280",
    line: "D1D5DB",
    soft: "F7F5EF",
    font: "Georgia, Cambria, 'Times New Roman', serif",
    headFont: "Georgia, Cambria, 'Times New Roman', serif",
    cover: "formal",
    head: "centered",
    tiles: "outline",
    tableHead: "rule",
  },
};

export const themeFor = (key: string | null | undefined): ReportTheme => TEMPLATES[(key as TemplateKey) ?? "classic"] ?? TEMPLATES.classic;
