/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, type ReactNode } from "react";
import { STAGES, type ChapterKey, type StageKey } from "@/features/annual-report/content";
import { fmt, lines, paragraphs, pct, usd, type Bar, type Count, type ProvinceRow, type ReportModel, type Stat } from "@/features/annual-report/model";
import { reportPhotoUrl } from "@/services/annualReportService";
import { TEMPLATES, type ReportTheme } from "@/features/annual-report/templates";

/**
 * The Annual Report as A4 pages. Used by the editor's preview and by the
 * print view (/report/annual/[cycleId]) whose "Save as PDF" gives the PDF.
 * Each chapter starts on a new page; long chapters flow onto the next.
 */

/** CSS colors of a template (navy/orange/cyan name the role each color plays in the Classic look). */
export type Palette = { navy: string; cyan: string; orange: string; ink: string; muted: string; line: string; soft: string; theme: ReportTheme };
export function paletteFor(theme: ReportTheme): Palette {
  return {
    navy: `#${theme.primary}`,
    cyan: `#${theme.second}`,
    orange: `#${theme.accent}`,
    ink: `#${theme.ink}`,
    muted: `#${theme.muted}`,
    line: `#${theme.line}`,
    soft: `#${theme.soft}`,
    theme,
  };
}
const ThemeContext = createContext<Palette>(paletteFor(TEMPLATES.classic));
const useT = () => useContext(ThemeContext);

function reportCss(T: Palette) {
  const rule = T.theme.tableHead === "rule";
  return `
.ar-doc { color: ${T.ink}; font-family: ${T.theme.font}; font-size: 10.5pt; line-height: 1.55; }
.ar-doc h1, .ar-doc h2, .ar-doc h3 { font-family: ${T.theme.headFont}; }
.ar-doc p { margin: 0 0 8pt; text-align: justify; hyphens: auto; }
.ar-sheet { background: #fff; width: 210mm; min-height: 297mm; padding: 16mm 16mm 18mm; margin: 0 auto 10mm; box-shadow: 0 1px 3px rgb(15 23 42 / .12), 0 8px 24px rgb(15 23 42 / .06); position: relative; box-sizing: border-box; }
.ar-cover { padding: 0; overflow: hidden; display: flex; flex-direction: column; height: 297mm; }
.ar-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 4pt 0 10pt; }
.ar-table th { background: ${rule ? "transparent" : T.navy}; color: ${rule ? T.navy : "#fff"}; font-weight: ${rule ? 700 : 600}; text-align: left; padding: 4pt 6pt; ${rule ? `border-top: 1.5px solid ${T.navy}; border-bottom: 1.5px solid ${T.navy};` : ""} }
.ar-table td { padding: 3.5pt 6pt; border-bottom: 1px solid ${T.line}; }
.ar-table tbody tr:nth-child(even) td { background: #F8FAFC; }
.ar-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ar-table tfoot td { font-weight: 700; border-top: 1.5px solid ${T.navy}; border-bottom: none; background: ${T.soft}; }
.ar-keep { break-inside: avoid; }
@media print {
  .ar-sheet { box-shadow: none; margin: 0; width: auto; min-height: 0; padding: 0; break-before: page; }
  .ar-sheet:first-child { break-before: auto; }
  .ar-cover { height: 266mm; margin: 0; border-radius: 6pt; }
  .ar-table thead { display: table-header-group; }
  .ar-table tr { break-inside: avoid; }
  .ar-doc h2, .ar-doc h3 { break-after: avoid; }
}
`;
}

/** A4 page setup for printing: running footer + page number (none on the cover). */
export function printPageCss(title: string) {
  const footer = `Passerelles numériques Cambodia · ${title}`.replace(/["\\]/g, "");
  return `
    @page {
      size: A4;
      margin: 14mm 14mm 16mm;
      @bottom-left { content: "${footer}"; font: 7.5pt system-ui, sans-serif; color: #64748b; }
      @bottom-right { content: counter(page); font: 700 8pt system-ui, sans-serif; color: #00427A; }
    }
    /* Same margins on every page — Chrome lays all pages out at one width. */
    @page :first { @bottom-left { content: none; } @bottom-right { content: none; } }
    @media print {
      html, body { background: #fff !important; }
      .ar-doc, .ar-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  `;
}

export function ReportDocument({ m }: { m: ReportModel }) {
  const T = paletteFor(m.theme);
  const shown = new Set(m.chapters.map((c) => c.key));
  const num = (k: ChapterKey) => m.chapters.find((c) => c.key === k)?.number ?? "";
  return (
    <ThemeContext.Provider value={T}>
    <div className="ar-doc">
      <style>{reportCss(T)}</style>
      <Cover m={m} />
      {shown.has("about") && <About m={m} />}
      {shown.has("info_sessions") && <InfoSessions m={m} n={num("info_sessions")} />}
      {shown.has("exams") && <Exams m={m} n={num("exams")} />}
      {shown.has("interviews") && <Interviews m={m} n={num("interviews")} />}
      {shown.has("home_visits") && <HomeVisits m={m} n={num("home_visits")} />}
      {shown.has("committee") && <Committee m={m} n={num("committee")} />}
      {shown.has("announcement") && <Announcement m={m} n={num("announcement")} />}
      {shown.has("figures") && <Figures m={m} n={num("figures")} />}
      {shown.has("timeline") && <Timeline m={m} n={num("timeline")} />}
      {shown.has("staff") && <Staff m={m} n={num("staff")} />}
      {shown.has("budget") && <Budget m={m} n={num("budget")} />}
      {shown.has("recommendations") && <Recommendations m={m} n={num("recommendations")} />}
      {shown.has("class") && <ClassProfile m={m} n={num("class")} />}
      {shown.has("conclusion") && <Conclusion m={m} n={num("conclusion")} />}
    </div>
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
function Sheet({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`ar-sheet ${className}`}>{children}</section>;
}

function ChapterHead({ n, title, lead }: { n: string; title: string; lead?: string }) {
  const T = useT();
  if (T.theme.head === "number") {
    // Modern: big light number, title beside it, short accent bar.
    return (
      <header style={{ marginBottom: "14pt" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12pt" }}>
          <span style={{ fontSize: "46pt", fontWeight: 800, lineHeight: 0.9, color: T.orange, opacity: 0.9, letterSpacing: "-0.04em" }}>{n}</span>
          <div>
            <div style={{ fontSize: "8pt", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: T.muted }}>Chapter {n}</div>
            <h2 style={{ margin: 0, fontSize: "24pt", lineHeight: 1.1, fontWeight: 800, color: T.navy, letterSpacing: "-0.02em" }}>{title}</h2>
          </div>
        </div>
        <div style={{ height: "4pt", width: "22mm", background: T.orange, borderRadius: "2pt", marginTop: "8pt" }} />
        {lead && <p style={{ marginTop: "9pt", color: T.muted, textAlign: "left", fontSize: "11pt" }}>{lead}</p>}
      </header>
    );
  }
  if (T.theme.head === "centered") {
    // Formal: centered small caps label, title, double rule.
    return (
      <header style={{ marginBottom: "14pt", textAlign: "center" }}>
        <div style={{ fontSize: "9pt", letterSpacing: "0.3em", textTransform: "uppercase", color: T.orange }}>Chapter {n}</div>
        <h2 style={{ margin: "4pt 0 8pt", fontSize: "22pt", lineHeight: 1.15, fontWeight: 400, color: T.navy }}>{title}</h2>
        <div style={{ borderTop: `1px solid ${T.navy}`, borderBottom: `1px solid ${T.navy}`, height: "2pt", width: "50mm", margin: "0 auto" }} />
        {lead && <p style={{ marginTop: "10pt", fontStyle: "italic", color: T.muted, textAlign: "center" }}>{lead}</p>}
      </header>
    );
  }
  return (
    <header style={{ marginBottom: "12pt" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "10pt", borderBottom: `2.5pt solid ${T.navy}`, paddingBottom: "6pt" }}>
        <span style={{ background: T.orange, color: "#fff", fontWeight: 800, fontSize: "15pt", lineHeight: 1, padding: "6pt 8pt", borderRadius: "4pt" }}>{n}</span>
        <h2 style={{ margin: 0, fontSize: "22pt", lineHeight: 1.1, fontWeight: 800, color: T.navy, letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      <div style={{ height: "2pt", width: "60mm", background: T.cyan }} />
      {lead && <p style={{ marginTop: "8pt", fontStyle: "italic", color: T.muted, textAlign: "left" }}>{lead}</p>}
    </header>
  );
}

function H3({ children }: { children: ReactNode }) {
  const T = useT();
  return <h3 style={{ margin: "12pt 0 5pt", fontSize: "12.5pt", fontWeight: 700, color: T.navy }}>{children}</h3>;
}

function Paras({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

/** Generated summary first (from the figures), then staff's own text. */
function Body({ summary, text }: { summary?: string; text?: string }) {
  if (!summary && !text) return null;
  return (
    <>
      {summary && <p style={{ fontWeight: 500 }}>{summary}</p>}
      {text && <Paras text={text} />}
    </>
  );
}

function Callout({ title, text, tone = "orange" }: { title: string; text: string; tone?: "orange" | "cyan" | "navy" }) {
  const T = useT();
  if (!text.trim()) return null;
  const color = tone === "orange" ? T.orange : tone === "cyan" ? T.cyan : T.navy;
  // A light tint of the tone color (8-digit hex = color + alpha).
  const bg = tone === "navy" ? T.soft : `${color}14`;
  return (
    <div className="ar-keep" style={{ borderLeft: `3pt solid ${color}`, background: bg, padding: "7pt 10pt", margin: "8pt 0 10pt", borderRadius: "0 4pt 4pt 0" }}>
      <div style={{ fontWeight: 700, color, fontSize: "10pt", marginBottom: "3pt", textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</div>
      <Paras text={text} />
    </div>
  );
}

function Tiles({ items }: { items: { value: string; label: string; accent?: boolean }[] }) {
  const T = useT();
  const shown = items.filter((t) => t.value !== "—" && t.value !== "0");
  if (!shown.length) return null;
  return (
    <div className="ar-keep" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(shown.length, 4)}, 1fr)`, gap: "6pt", margin: "6pt 0 12pt" }}>
      {shown.map((t, i) =>
        T.theme.tiles === "outline" ? (
          <div key={i} style={{ border: `1px solid ${T.line}`, borderLeft: `3pt solid ${t.accent ? T.orange : T.navy}`, borderRadius: T.theme.head === "centered" ? 0 : "5pt", padding: "8pt 10pt", background: t.accent ? T.soft : "#fff" }}>
            <div style={{ fontSize: "20pt", fontWeight: T.theme.head === "centered" ? 400 : 800, lineHeight: 1.1, color: t.accent ? T.orange : T.navy }}>{t.value}</div>
            <div style={{ fontSize: "8.5pt", color: T.muted, marginTop: "2pt", lineHeight: 1.3 }}>{t.label}</div>
          </div>
        ) : (
        <div key={i} style={{ background: t.accent ? T.navy : T.soft, color: t.accent ? "#fff" : T.navy, borderRadius: "5pt", padding: "8pt 10pt", borderTop: `3pt solid ${t.accent ? T.orange : T.cyan}` }}>
          <div style={{ fontSize: "20pt", fontWeight: 800, lineHeight: 1.1 }}>{t.value}</div>
          <div style={{ fontSize: "8.5pt", opacity: t.accent ? 0.9 : 1, color: t.accent ? "#fff" : T.muted, marginTop: "2pt", lineHeight: 1.3 }}>{t.label}</div>
        </div>
        ),
      )}
    </div>
  );
}

function GenderSplit({ c, label }: { c: Count; label?: string }) {
  const T = useT();
  if (!c.total) return null;
  const f = pct(c.female, c.total);
  const mm = pct(c.male, c.total);
  return (
    <div className="ar-keep" style={{ margin: "4pt 0 10pt" }}>
      {label && <div style={{ fontSize: "9pt", color: T.muted, marginBottom: "3pt" }}>{label}</div>}
      <div style={{ display: "flex", height: "14pt", borderRadius: "3pt", overflow: "hidden", fontSize: "8pt", color: "#fff", fontWeight: 700 }}>
        <div style={{ width: `${f}%`, background: T.orange, display: "flex", alignItems: "center", paddingLeft: "5pt", whiteSpace: "nowrap" }}>{f >= 12 ? `Female ${f}%` : ""}</div>
        <div style={{ width: `${mm}%`, background: T.navy, display: "flex", alignItems: "center", paddingLeft: "5pt", whiteSpace: "nowrap" }}>{mm >= 12 ? `Male ${mm}%` : ""}</div>
        {c.other > 0 && <div style={{ flex: 1, background: T.cyan }} />}
      </div>
      <div style={{ fontSize: "8.5pt", color: T.muted, marginTop: "2pt" }}>
        {fmt(c.female)} female · {fmt(c.male)} male{c.other ? ` · ${fmt(c.other)} LGBTQIA+ / not recorded` : ""}
      </div>
    </div>
  );
}

function BarList({ items, color: colorProp, total }: { items: Bar[]; color?: string; total?: number }) {
  const T = useT();
  const color = colorProp ?? T.cyan;
  const shown = items.filter((b) => b.value > 0);
  if (!shown.length) return <Empty />;
  const max = Math.max(...shown.map((b) => b.value));
  return (
    <div className="ar-keep" style={{ display: "grid", gap: "3pt", margin: "4pt 0 10pt" }}>
      {shown.map((b) => (
        <div key={b.label} style={{ display: "grid", gridTemplateColumns: "38% 1fr", alignItems: "center", gap: "6pt", fontSize: "9pt" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "5pt" }}>
            <span style={{ height: "10pt", width: `${(b.value / max) * 82}%`, minWidth: "2pt", background: color, borderRadius: "2pt" }} />
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {fmt(b.value)}
              {total ? <span style={{ fontWeight: 400, color: T.muted }}> ({pct(b.value, total)}%)</span> : null}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Empty({ text = "No data recorded in the app for this cycle." }: { text?: string }) {
  const T = useT();
  return <p style={{ color: T.muted, fontStyle: "italic", fontSize: "9pt" }}>{text}</p>;
}

function ProvinceTable({ rows, extra, extraLabel }: { rows: ProvinceRow[]; extra?: (r: ProvinceRow) => number; extraLabel?: string }) {
  if (!rows.length) return <Empty />;
  const tot = rows.reduce((a, r) => ({ total: a.total + r.total, female: a.female + r.female, male: a.male + r.male, x: a.x + (extra ? extra(r) : 0) }), { total: 0, female: 0, male: 0, x: 0 });
  return (
    <table className="ar-table">
      <thead>
        <tr>
          <th style={{ width: "6%" }}>No</th>
          <th>Province</th>
          {extraLabel && <th className="num">{extraLabel}</th>}
          <th className="num">Female</th>
          <th className="num">Male</th>
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.province}>
            <td>{i + 1}</td>
            <td>{r.province}</td>
            {extraLabel && <td className="num">{fmt(extra!(r))}</td>}
            <td className="num">{fmt(r.female)}</td>
            <td className="num">{fmt(r.male)}</td>
            <td className="num">{fmt(r.total)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td />
          <td>Total</td>
          {extraLabel && <td className="num">{fmt(tot.x)}</td>}
          <td className="num">{fmt(tot.female)}</td>
          <td className="num">{fmt(tot.male)}</td>
          <td className="num">{fmt(tot.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Photos({ paths, max = 4 }: { paths?: string[]; max?: number }) {
  const list = (paths ?? []).slice(0, max);
  if (!list.length) return null;
  const cols = list.length === 1 ? 1 : 2;
  return (
    <div className="ar-keep" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "5pt", margin: "8pt 0 12pt" }}>
      {list.map((p) => (
        <img key={p} src={reportPhotoUrl(p, 768)} alt="" style={{ width: "100%", height: list.length === 1 ? "78mm" : list.length === 3 ? "42mm" : "50mm", objectFit: "cover", borderRadius: "5pt", display: "block" }} />
      ))}
    </div>
  );
}

function TwoCol({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", alignItems: "start" }}>{children}</div>;
}

const statCell = (s: Stat | null, key: keyof Stat) => (s ? fmt(s[key]) : "—");

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------
function Cover({ m }: { m: ReportModel }) {
  const T = useT();
  const photo = m.photos.cover?.[0];
  const supported = m.supportedBy.length > 0 && (
    <div>
      <div style={{ fontSize: "9pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "3pt" }}>Supported by</div>
      <div style={{ fontSize: "9.5pt" }}>{m.supportedBy.join("  ·  ")}</div>
    </div>
  );

  if (T.theme.cover === "photo") {
    // Modern: the photo fills the page, text on a dark gradient at the bottom.
    return (
      <Sheet className="ar-cover">
        <div style={{ position: "relative", flex: 1, background: T.navy, color: "#fff", display: "flex", flexDirection: "column" }}>
          {photo ? (
            <img src={reportPhotoUrl(photo, 768)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <img src="/brand/pn-mark.png" alt="" style={{ position: "absolute", right: "-20mm", top: "30mm", width: "150mm", opacity: 0.07 }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${T.navy}33 0%, ${T.navy}10 35%, ${T.navy}E6 70%, ${T.navy} 100%)` }} />
          <div style={{ position: "relative", padding: "14mm 16mm 0" }}>
            <img src="/brand/pn-logo-white.png" alt="Passerelles numériques" style={{ height: "17mm", width: "auto", display: "block" }} />
          </div>
          <div style={{ position: "relative", marginTop: "auto", padding: "0 16mm 14mm" }}>
            <div style={{ height: "4pt", width: "24mm", background: T.orange, borderRadius: "2pt", marginBottom: "10pt" }} />
            <div style={{ fontSize: "10pt", letterSpacing: "0.3em", textTransform: "uppercase", opacity: 0.85 }}>{m.cycleName}</div>
            <h1 style={{ margin: "6pt 0 0", fontSize: "44pt", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em" }}>{m.title}</h1>
            <div style={{ marginTop: "10pt", fontSize: "15pt", fontWeight: 600, color: T.orange }}>{m.subtitle}</div>
            <div style={{ fontSize: "13pt", fontWeight: 500, opacity: 0.95 }}>{m.generation}</div>
            <p style={{ marginTop: "10pt", maxWidth: "135mm", fontSize: "10pt", opacity: 0.85, textAlign: "left" }}>{m.tagline}</p>
            <div style={{ marginTop: "12mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "10mm", borderTop: "1px solid rgb(255 255 255 / .25)", paddingTop: "6mm" }}>
              {supported || <span />}
              <span style={{ fontSize: "8.5pt", opacity: 0.8, whiteSpace: "nowrap" }}>Passerelles numériques Cambodia</span>
            </div>
          </div>
        </div>
      </Sheet>
    );
  }

  if (T.theme.cover === "formal") {
    // Formal: white page, centered, thin double rules, framed photo.
    return (
      <Sheet className="ar-cover">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "18mm 20mm 14mm", border: `1px solid ${T.navy}`, outline: `3pt double ${T.navy}`, outlineOffset: "-8pt", margin: "8mm" }}>
          <img src="/brand/pn-logo.png" alt="Passerelles numériques" style={{ height: "22mm", width: "auto" }} />
          <div style={{ marginTop: "14mm", fontSize: "10pt", letterSpacing: "0.35em", textTransform: "uppercase", color: T.orange }}>{m.cycleName}</div>
          <div style={{ borderTop: `1px solid ${T.navy}`, width: "60mm", margin: "8pt 0" }} />
          <h1 style={{ margin: 0, fontSize: "34pt", fontWeight: 400, lineHeight: 1.15, color: T.navy }}>{m.title}</h1>
          <div style={{ borderTop: `1px solid ${T.navy}`, width: "60mm", margin: "10pt 0" }} />
          <div style={{ fontSize: "14pt", fontStyle: "italic", color: T.ink }}>{m.subtitle}</div>
          <div style={{ fontSize: "12.5pt", color: T.muted, marginTop: "2pt" }}>{m.generation}</div>
          {photo ? (
            <img src={reportPhotoUrl(photo, 768)} alt="" style={{ marginTop: "12mm", width: "120mm", height: "78mm", objectFit: "cover", border: `1px solid ${T.line}`, padding: "3pt", background: "#fff" }} />
          ) : (
            <img src="/brand/pn-mark.png" alt="" style={{ marginTop: "16mm", width: "40mm", opacity: 0.15 }} />
          )}
          <p style={{ marginTop: "10mm", maxWidth: "130mm", fontSize: "10pt", fontStyle: "italic", color: T.muted, textAlign: "center" }}>{m.tagline}</p>
          <div style={{ marginTop: "auto", color: T.navy }}>{supported}</div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet className="ar-cover">
      <div style={{ background: `linear-gradient(135deg, ${T.navy} 0%, #0A5A9C 60%, ${T.cyan} 100%)`, color: "#fff", padding: "16mm 16mm 12mm", position: "relative" }}>
        <img src="/brand/pn-logo-white.png" alt="Passerelles numériques" style={{ height: "20mm", width: "auto", display: "block" }} />
        <div style={{ marginTop: "18mm", fontSize: "11pt", letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.85 }}>{m.cycleName}</div>
        <h1 style={{ margin: "4pt 0 0", fontSize: "38pt", fontWeight: 800, lineHeight: 1.05, textTransform: "uppercase" }}>{m.title}</h1>
        <div style={{ marginTop: "6pt", fontSize: "17pt", fontWeight: 600, fontStyle: "italic", color: "#FFD3A6" }}>{m.subtitle}</div>
        <div style={{ fontSize: "15pt", fontWeight: 600, fontStyle: "italic" }}>{m.generation}</div>
        <p style={{ marginTop: "10pt", maxWidth: "140mm", fontSize: "10.5pt", opacity: 0.9, textAlign: "left" }}>{m.tagline}</p>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "3mm", background: T.orange }} />
      </div>
      <div style={{ flex: 1, position: "relative", background: T.soft, minHeight: 0 }}>
        {photo ? (
          <img src={reportPhotoUrl(photo, 768)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/brand/pn-mark.png" alt="" style={{ width: "55mm", opacity: 0.12 }} />
          </div>
        )}
      </div>
      <div style={{ padding: "8mm 16mm 10mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12mm" }}>
        <div>
          {m.supportedBy.length > 0 && (
            <>
              <div style={{ fontSize: "9pt", fontWeight: 700, color: T.navy, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "3pt" }}>Supported by</div>
              <div style={{ fontSize: "9.5pt", color: T.ink }}>{m.supportedBy.join("  ·  ")}</div>
            </>
          )}
        </div>
        <div style={{ fontSize: "8.5pt", color: T.muted, whiteSpace: "nowrap" }}>Passerelles numériques Cambodia</div>
      </div>
    </Sheet>
  );
}

function About({ m }: { m: ReportModel }) {
  const T = useT();
  return (
    <Sheet>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10mm" }}>
        <img src="/brand/pn-logo.png" alt="Passerelles numériques" style={{ height: "14mm", width: "auto" }} />
        <span style={{ fontSize: "9pt", color: T.muted }}>{m.title}</span>
      </div>
      <ChapterHead n={m.chapters.find((c) => c.key === "about")?.number ?? "01"} title="All about the Report" />
      {m.text.intro ? (
        <Paras text={m.text.intro} />
      ) : (
        <p>
          The {m.title} presents the complete journey of choosing the future scholars of Passerelles numériques Cambodia, from the first
          Information Session through the Qualifying Exam, Motivation Interviews and Home Visits, to the Final Selection Committee and contract
          signing. It also brings together the overall selection figures, the timeline, staff participation, the budget, recommendations for
          the coming year and the profile of the new class.
        </p>
      )}
      <H3>Table of Contents</H3>
      <div style={{ marginTop: "4pt" }}>
        {m.chapters
          .filter((c) => c.key !== "about")
          .map((c) => (
            <div key={c.key} style={{ display: "flex", alignItems: "baseline", gap: "8pt", padding: "5pt 0", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontWeight: 800, color: T.orange, width: "20pt" }}>{c.number}</span>
              <span style={{ fontWeight: 600, color: T.navy }}>{c.label}</span>
            </div>
          ))}
      </div>
    </Sheet>
  );
}

function InfoSessions({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const f = m.fig;
  return (
    <Sheet>
      <ChapterHead n={n} title="Information Sessions" lead="Our first encounter with potential students: we introduce PN, set clear expectations, spark their interest in IT and answer their questions before they proceed to the exam." />
      <Tiles
        items={[
          { value: fmt(m.is.attendees.total), label: "attendees", accent: true },
          { value: fmt(f.is_sessions), label: `information sessions${f.is_online ? ` (${fmt(f.is_online)} online)` : ""}` },
          { value: `${pct(m.is.attendees.female, m.is.attendees.total)}%`, label: `girls${f.is_target_female ? ` · target ${f.is_target_female}%` : ""}` },
          { value: fmt(f.is_schools), label: "high schools / venues reached" },
        ]}
      />
      <GenderSplit c={m.is.attendees} label="Attendees by gender" />
      <Body summary={m.summary.info_sessions} text={m.text.is_text} />
      <Photos paths={m.photos.info_sessions} />
      {(f.is_indigenous || f.is_disability || m.is.ngoRegistrations > 0) && (
        <>
          <H3>Special categories</H3>
          <Tiles
            items={[
              { value: fmt(f.is_indigenous), label: "indigenous participants" },
              { value: fmt(f.is_disability), label: "persons with different abilities" },
              { value: fmt(m.is.ngoRegistrations), label: "registrations from NGO beneficiaries" },
            ]}
          />
        </>
      )}
      <Callout title="The challenge" text={m.text.is_challenges} />
      {m.is.byProvince.length > 0 && (
        <>
          <H3>Registrations by province</H3>
          <ProvinceTable rows={m.is.byProvince} extra={(r) => r.extra ?? 0} extraLabel="Sessions" />
        </>
      )}
      {m.is.byPresenter.length > 0 && m.is.byPresenter.some((b) => b.label !== "Not recorded") && (
        <>
          <H3>Sessions presented by</H3>
          <BarList items={m.is.byPresenter} color={T.navy} total={m.is.sessions.length} />
        </>
      )}
      {(m.text.collaboration || f.partner_schools || f.partner_ngos) && (
        <>
          <H3>Collaboration highlight</H3>
          <Tiles
            items={[
              { value: fmt(f.partner_schools), label: "partner high schools" },
              { value: fmt(f.partner_ngos), label: "NGO partners" },
            ]}
          />
          {m.text.collaboration && <Paras text={m.text.collaboration} />}
        </>
      )}
    </Sheet>
  );
}

function Exams({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const f = m.fig;
  const protocol = lines(m.text.exam_protocol);
  const takers: Count = { total: f.exam_takers ?? 0, female: f.exam_female ?? 0, male: f.exam_male ?? 0, other: Math.max(0, (f.exam_takers ?? 0) - (f.exam_female ?? 0) - (f.exam_male ?? 0)) };
  return (
    <Sheet>
      <ChapterHead n={n} title="Examinations" lead="A measure not of skills alone, but of determination and readiness to move forward. The exam assesses each applicant's capacity to follow PN's intensive IT training." />
      <Tiles
        items={[
          { value: fmt(f.exam_takers), label: "exam takers", accent: true },
          { value: fmt(f.exam_count), label: "exam sessions" },
          { value: fmt(f.exam_provinces), label: "provinces" },
          { value: fmt(f.exam_passed), label: `passed${f.exam_takers ? ` (${pct(f.exam_passed ?? 0, f.exam_takers)}%)` : ""}` },
        ]}
      />
      <GenderSplit c={takers} label="Exam takers by gender" />
      <Body summary={m.summary.exams} text={m.text.exam_text} />
      <Photos paths={m.photos.exams} />
      {protocol.length > 0 && (
        <div className="ar-keep">
          <H3>Administration of the tests</H3>
          <ul style={{ margin: "0 0 10pt", paddingLeft: "14pt", columns: protocol.length > 5 ? 2 : 1, columnGap: "16pt" }}>
            {protocol.map((l, i) => (
              <li key={i} style={{ marginBottom: "2pt", breakInside: "avoid" }}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Callout title="Challenges" text={m.text.exam_challenges} />
      {m.exam.byProvince.length > 0 && (
        <>
          <H3>Exam figures by province</H3>
          <table className="ar-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Province</th>
                <th className="num">Female</th>
                <th className="num">Male</th>
                <th className="num">Takers</th>
                <th className="num">Passed</th>
                <th className="num">Pass rate</th>
              </tr>
            </thead>
            <tbody>
              {m.exam.byProvince.map((r, i) => (
                <tr key={r.province}>
                  <td>{i + 1}</td>
                  <td>{r.province}</td>
                  <td className="num">{fmt(r.female)}</td>
                  <td className="num">{fmt(r.male)}</td>
                  <td className="num">{fmt(r.total)}</td>
                  <td className="num">{fmt(r.passed)}</td>
                  <td className="num">{pct(r.passed, r.total)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>Total</td>
                <td className="num">{fmt(m.exam.takers.female)}</td>
                <td className="num">{fmt(m.exam.takers.male)}</td>
                <td className="num">{fmt(m.exam.takers.total)}</td>
                <td className="num">{fmt(m.exam.passed.total)}</td>
                <td className="num">{pct(m.exam.passed.total, m.exam.takers.total)}%</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
      {m.exam.subjects.length > 0 && (
        <>
          <H3>Exam scores analysis{m.exam.selectedWithScores ? ` — all exam takers vs. ${fmt(m.exam.selectedWithScores)} selected students` : ""}</H3>
          <table className="ar-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="num">Max</th>
                <th className="num">Min</th>
                <th className="num">Highest</th>
                <th className="num">Average</th>
                <th className="num">Median</th>
                <th className="num">Avg % (selected)</th>
              </tr>
            </thead>
            <tbody>
              {m.exam.subjects.map((s) => (
                <tr key={s.subject}>
                  <td>
                    <strong>{s.subject}</strong>
                    {s.selected && <div style={{ fontSize: "8pt", color: T.muted }}>Selected: avg {fmt(s.selected.avg)} · min {fmt(s.selected.min)} · max {fmt(s.selected.max)}</div>}
                  </td>
                  <td className="num">{fmt(s.max)}</td>
                  <td className="num">{statCell(s.overall, "min")}</td>
                  <td className="num">{statCell(s.overall, "max")}</td>
                  <td className="num">
                    {statCell(s.overall, "avg")}
                    {s.overall && s.max ? <span style={{ color: T.muted }}> ({pct(s.overall.avg, s.max)}%)</span> : null}
                  </td>
                  <td className="num">{statCell(s.overall, "median")}</td>
                  <td className="num">{s.selected && s.max ? `${pct(s.selected.avg, s.max)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <BarList
            items={m.exam.subjects.filter((s) => s.overall && s.max).map((s) => ({ label: `${s.subject} — average % of max`, value: pct(s.overall!.avg, s.max) }))}
            color={T.cyan}
          />
        </>
      )}
      {m.text.exam_analysis && <Paras text={m.text.exam_analysis} />}
      <Callout title="What next?" text={m.text.exam_next} tone="cyan" />
    </Sheet>
  );
}

function Interviews({ m, n }: { m: ReportModel; n: string }) {
  const f = m.fig;
  return (
    <Sheet>
      <ChapterHead n={n} title="Motivation Interviews" lead="Each answer reflects not just knowledge, but a student's determination to embrace the challenges of the PN journey. The interview assesses motivation, aptitude and interest to study IT as a PN scholar." />
      <Tiles
        items={[
          { value: fmt(f.mi_passed), label: "passed the interview", accent: true },
          { value: fmt(f.mi_interviewed), label: "students interviewed" },
          { value: fmt(f.mi_online), label: "interviewed online" },
          { value: `${pct(m.mi.passed.female, m.mi.passed.total)}%`, label: "female among passers" },
        ]}
      />
      <GenderSplit c={m.mi.passed} label="Interview passers by gender" />
      <Body summary={m.summary.interviews} text={m.text.mi_text} />
      <Photos paths={m.photos.interviews} max={3} />
      <Callout title="Challenges" text={m.text.mi_challenges} />
      {m.mi.byProvince.length > 0 && (
        <>
          <H3>Interview passers by province</H3>
          <ProvinceTable rows={m.mi.byProvince} />
        </>
      )}
    </Sheet>
  );
}

function HomeVisits({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const f = m.fig;
  return (
    <Sheet>
      <ChapterHead n={n} title="Home Visits" lead="Each student who passed the interview is visited to meet their family, explain PN and training life, clarify parents' responsibilities and confirm the family's economic situation." />
      <Tiles
        items={[
          { value: fmt(f.hv_visited), label: "families visited", accent: true },
          { value: fmt(m.hv.visited.other), label: "LGBTQIA+ / not recorded" },
          { value: fmt(f.hv_indigenous), label: "indigenous students" },
          { value: fmt(f.hv_youth_war), label: "youth from conflict-affected areas" },
        ]}
      />
      <GenderSplit c={m.hv.visited} label="Students visited by gender" />
      <Body summary={m.summary.home_visits} text={m.text.hv_text} />
      <Photos paths={m.photos.home_visits} />
      <Callout title="Challenges" text={m.text.hv_challenges} />
      <TwoCol>
        <div>
          <H3>Poverty category (social form)</H3>
          <BarList items={m.hv.categories} color={T.orange} total={m.hv.visited.total} />
        </div>
        <div>
          <H3>Vulnerabilities found</H3>
          <BarList items={m.hv.vulnerabilities} color={T.navy} total={m.hv.visited.total} />
        </div>
      </TwoCol>
      {m.hv.byProvince.length > 0 && (
        <>
          <H3>Home visits by province</H3>
          <ProvinceTable rows={m.hv.byProvince} />
        </>
      )}
    </Sheet>
  );
}

function Committee({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const f = m.fig;
  return (
    <Sheet>
      <ChapterHead n={n} title="Final Selection Committee" lead="Behind every deliberation was a story of challenges faced, strength shown, and an unwavering desire for success. Each case was presented by the staff who visited the student and rated by the committee." />
      <Tiles
        items={[
          { value: fmt(f.fsc_cases), label: "cases presented", accent: true },
          { value: fmt(f.fsc_eligible), label: "eligible for the final list" },
          { value: fmt(f.fsc_indigenous), label: "indigenous students" },
          { value: fmt(f.fsc_muslim), label: "Muslim students" },
        ]}
      />
      <GenderSplit c={m.fsc.cases} label="Cases by gender" />
      <Body summary={m.summary.committee} text={m.text.fsc_text} />
      <Photos paths={m.photos.committee} max={3} />
      <TwoCol>
        <div>
          <H3>Committee decisions</H3>
          <BarList items={m.fsc.decisions} color={T.navy} total={m.fsc.cases.total} />
        </div>
        <div className="ar-keep">
          <H3>Scoring guide (vulnerability)</H3>
          <table className="ar-table">
            <tbody>
              <tr><td>12 – 18</td><td>Low vulnerability</td></tr>
              <tr><td>19 – 25</td><td>Moderate vulnerability</td></tr>
              <tr><td>26 – 36</td><td>High vulnerability</td></tr>
            </tbody>
          </table>
        </div>
      </TwoCol>
      {m.text.ranking && (
        <>
          <H3>Global ranking</H3>
          <Paras text={m.text.ranking} />
        </>
      )}
      {m.fsc.byProvince.length > 0 && (
        <>
          <H3>Cases by province</H3>
          <ProvinceTable rows={m.fsc.byProvince} />
        </>
      )}
    </Sheet>
  );
}

function Announcement({ m, n }: { m: ReportModel; n: string }) {
  return (
    <Sheet>
      <ChapterHead n={n} title="Final Announcement" lead="The seal of commitment to education, excellence and responsibility." />
      <Tiles
        items={[
          { value: fmt(m.fig.contracts), label: "contracts signed", accent: true },
          { value: fmt(m.klass.total.male), label: "males" },
          { value: fmt(m.klass.total.female), label: "females" },
          { value: fmt(m.declined.total.total), label: "declined before enrollment" },
        ]}
      />
      <Body summary={m.summary.announcement} text={m.text.announcement} />
      <Photos paths={m.photos.announcement} max={3} />
      {(m.declined.byProvince.length > 0 || m.text.registration_history) && (
        <>
          <H3>Registration history — students who declined</H3>
          {m.text.registration_history && <Paras text={m.text.registration_history} />}
          {m.declined.byProvince.length > 0 && (
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Province</th>
                  <th className="num">Male</th>
                  <th className="num">Female</th>
                  <th style={{ width: "50%" }}>Main reasons</th>
                </tr>
              </thead>
              <tbody>
                {m.declined.byProvince.map((r) => (
                  <tr key={r.province}>
                    <td>{r.province}</td>
                    <td className="num">{fmt(r.male)}</td>
                    <td className="num">{fmt(r.female)}</td>
                    <td style={{ fontSize: "8.5pt" }}>{r.reasons.join("; ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{fmt(m.declined.total.male)}</td>
                  <td className="num">{fmt(m.declined.total.female)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </>
      )}
      <Callout title="Contract signing & D-Day" text={m.text.dday} tone="cyan" />
      {m.klass.byProvince.length > 0 && (
        <>
          <H3>Contracts signed by province</H3>
          <table className="ar-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Province</th>
                <th className="num">Contracts</th>
                <th className="num">M</th>
                <th className="num">F</th>
                <th className="num">LGBTQIA+</th>
                <th className="num">Disability in family</th>
              </tr>
            </thead>
            <tbody>
              {m.klass.byProvince.map((r, i) => (
                <tr key={r.province}>
                  <td>{i + 1}</td>
                  <td>{r.province}</td>
                  <td className="num">{fmt(r.total)}</td>
                  <td className="num">{fmt(r.male)}</td>
                  <td className="num">{fmt(r.female)}</td>
                  <td className="num">{r.lgbtq ? fmt(r.lgbtq) : ""}</td>
                  <td className="num">{r.disability ? fmt(r.disability) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>Total</td>
                <td className="num">{fmt(m.klass.total.total)}</td>
                <td className="num">{fmt(m.klass.total.male)}</td>
                <td className="num">{fmt(m.klass.total.female)}</td>
                <td className="num">{fmt(m.klass.total.other)}</td>
                <td className="num">{fmt(m.klass.disability)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </Sheet>
  );
}

function Figures({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const first = m.funnel[0]?.value || 0;
  const max = Math.max(1, ...m.funnel.map((f) => f.value));
  return (
    <Sheet>
      <ChapterHead n={n} title="Overall Selection Figures" />
      <div className="ar-keep" style={{ display: "grid", gap: "5pt", margin: "6pt 0 14pt" }}>
        {m.funnel.map((f, i) => {
          const w = Math.max(1.5, (f.value / max) * 100);
          return (
            <div key={f.label} style={{ display: "grid", gridTemplateColumns: "48mm 1fr", alignItems: "center", gap: "8pt" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6pt" }}>
                <span style={{ background: T.soft, color: T.navy, fontWeight: 800, fontSize: "9pt", borderRadius: "50%", width: "16pt", height: "16pt", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: "9.5pt", fontWeight: 600 }}>{f.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6pt" }}>
                <div style={{ width: `${w * 0.78}%`, height: "20pt", background: i === m.funnel.length - 1 ? T.orange : i % 2 ? T.cyan : T.navy, borderRadius: "3pt" }} />
                <span style={{ fontWeight: 800, fontSize: "14pt", color: T.navy, whiteSpace: "nowrap" }}>
                  {fmt(f.value)}
                  {i > 0 && first ? <span style={{ fontSize: "8pt", fontWeight: 500, color: T.muted }}> {pct(f.value, first)}%</span> : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Body summary={m.summary.figures} text={m.text.overall_text} />
    </Sheet>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Timeline({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const rows = m.timeline.filter((t) => t.start);
  // Months from the earliest start to the latest end (at least the calendar year).
  const starts = rows.map((r) => r.start.slice(0, 7)).sort();
  const ends = rows.map((r) => (r.end || r.start).slice(0, 7)).sort();
  const from = starts[0] ?? `${m.year}-01`;
  const to = ends[ends.length - 1] ?? `${m.year}-12`;
  const months: string[] = [];
  for (let y = Number(from.slice(0, 4)), mo = Number(from.slice(5, 7)); `${y}-${String(mo).padStart(2, "0")}` <= to && months.length < 24; ) {
    months.push(`${y}-${String(mo).padStart(2, "0")}`);
    mo++;
    if (mo > 12) {
      mo = 1;
      y++;
    }
  }
  const colors = [T.cyan, T.navy, T.orange, "#0A5A9C", "#E0663A", "#22A39F"];
  const fmtDate = (d: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
  return (
    <Sheet>
      <ChapterHead n={n} title={`SP${m.year} Timeline`} />
      {rows.length === 0 ? (
        <Empty text="No dates recorded yet — add the timeline in the editor." />
      ) : (
        <>
          <div className="ar-keep" style={{ display: "grid", gridTemplateColumns: `42mm repeat(${months.length}, 1fr)`, fontSize: "8pt", margin: "4pt 0 12pt", border: `1px solid ${T.line}`, borderRadius: "4pt", overflow: "hidden" }}>
            <div style={{ background: T.navy, color: "#fff", fontWeight: 700, padding: "4pt 6pt" }}>Stage</div>
            {months.map((mo) => (
              <div key={mo} style={{ background: T.navy, color: "#fff", fontWeight: 700, padding: "4pt 0", textAlign: "center", borderLeft: "1px solid rgb(255 255 255 / .2)" }}>
                {MONTHS[Number(mo.slice(5, 7)) - 1]}
              </div>
            ))}
            {rows.map((r, i) => {
              const a = months.indexOf(r.start.slice(0, 7));
              const b = months.indexOf((r.end || r.start).slice(0, 7));
              return [
                <div key={`${i}-l`} style={{ padding: "5pt 6pt", borderTop: `1px solid ${T.line}`, fontWeight: 600 }}>{r.stage}</div>,
                ...months.map((mo, j) => (
                  <div key={`${i}-${mo}`} style={{ borderTop: `1px solid ${T.line}`, borderLeft: `1px solid ${T.line}`, padding: "4pt 0", display: "flex", alignItems: "center" }}>
                    {j >= a && j <= b && a >= 0 && (
                      <div style={{ height: "9pt", width: "100%", background: colors[i % colors.length], borderRadius: `${j === a ? "4pt" : 0} ${j === b ? "4pt" : 0} ${j === b ? "4pt" : 0} ${j === a ? "4pt" : 0}` }} />
                    )}
                  </div>
                )),
              ];
            })}
          </div>
          <table className="ar-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.stage}</td>
                  <td>{fmtDate(r.start)}</td>
                  <td>{fmtDate(r.end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {m.text.timeline_text && <Paras text={m.text.timeline_text} />}
    </Sheet>
  );
}

function Staff({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const used = STAGES.filter((s) => m.staff.some((p) => p.stages.has(s.key)));
  return (
    <Sheet>
      <ChapterHead n={n} title="Overall Staff Participation" />
      <Body summary={m.summary.staff} text={m.text.staff_text} />
      {m.staff.length === 0 ? (
        <Empty text="No staff recorded yet." />
      ) : (
        <>
          <Tiles items={used.map((s) => ({ value: fmt(m.staff.filter((p) => p.stages.has(s.key)).length), label: s.label }))} />
          <table className="ar-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Name</th>
                {used.map((s) => (
                  <th key={s.key} style={{ textAlign: "center" }}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.staff.map((p, i) => (
                <tr key={p.name}>
                  <td>{i + 1}</td>
                  <td>{p.name}</td>
                  {used.map((s) => (
                    <td key={s.key} style={{ textAlign: "center", color: T.navy, fontWeight: 700 }}>
                      {p.stages.has(s.key) ? "✓" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Sheet>
  );
}

const stageLabel = (k: StageKey) => STAGES.find((s) => s.key === k)?.label ?? k;

function Budget({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const b = m.budget;
  return (
    <Sheet>
      <ChapterHead n={n} title="Overall Selection Budget" />
      {b.rows.length === 0 ? (
        <Empty text="No budget entered yet — add the expenses in the editor." />
      ) : (
        <>
          <Tiles items={[{ value: `$${usd(b.grand)}`, label: "total expenses (USD)", accent: true }, ...b.columns.map((k) => ({ value: `${pct(b.totals[k], b.grand)}%`, label: stageLabel(k) }))]} />
          <table className="ar-table">
            <thead>
              <tr>
                <th>Expense</th>
                {b.columns.map((k) => (
                  <th key={k} className="num">
                    {stageLabel(k)}
                  </th>
                ))}
                <th className="num">Total (USD)</th>
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r) => (
                <tr key={r.item}>
                  <td>{r.item}</td>
                  {b.columns.map((k) => (
                    <td key={k} className="num">
                      {Number(r.amounts[k]) ? usd(Number(r.amounts[k])) : ""}
                    </td>
                  ))}
                  <td className="num">{usd(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Grand total</td>
                {b.columns.map((k) => (
                  <td key={k} className="num">
                    {usd(b.totals[k])}
                  </td>
                ))}
                <td className="num">{usd(b.grand)}</td>
              </tr>
            </tfoot>
          </table>
          <BarList items={b.columns.map((k) => ({ label: stageLabel(k), value: Math.round(b.totals[k]) }))} color={T.orange} total={Math.round(b.grand)} />
        </>
      )}
      <Body summary={m.summary.budget} text={m.text.budget_text} />
    </Sheet>
  );
}

function Recommendations({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const stages = STAGES.filter((s) => {
    const r = m.reviews[s.key];
    return r.strengths?.trim() || r.challenges?.trim() || r.recommendations?.trim();
  });
  return (
    <Sheet>
      <ChapterHead n={n} title="General Recommendations" />
      {stages.length === 0 && !m.text.overall_recommendation && <Empty text="No recommendations entered yet." />}
      {stages.map((s, i) => {
        const r = m.reviews[s.key];
        const tone = i % 2 ? T.cyan : T.orange;
        return (
          <div key={s.key} className="ar-keep" style={{ border: `1px solid ${T.line}`, borderTop: `4pt solid ${tone}`, borderRadius: "5pt", padding: "8pt 11pt", marginBottom: "9pt" }}>
            <div style={{ fontWeight: 800, color: T.navy, fontSize: "12pt", marginBottom: "4pt" }}>{s.label}</div>
            {r.strengths?.trim() && (
              <p>
                <strong style={{ color: T.navy }}>Strengths observed: </strong>
                {r.strengths.trim()}
              </p>
            )}
            {r.challenges?.trim() && (
              <p>
                <strong style={{ color: T.navy }}>Challenges noted: </strong>
                {r.challenges.trim()}
              </p>
            )}
            {r.recommendations?.trim() && (
              <>
                <div style={{ fontWeight: 700, color: tone, fontSize: "9.5pt", textTransform: "uppercase", letterSpacing: "0.04em" }}>Recommendations</div>
                <ul style={{ margin: "2pt 0 0", paddingLeft: "14pt" }}>
                  {lines(r.recommendations).map((l, j) => (
                    <li key={j} style={{ marginBottom: "2pt" }}>
                      {l}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })}
      <Callout title="Overall recommendation" text={m.text.overall_recommendation} tone="navy" />
    </Sheet>
  );
}

function ClassProfile({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const k = m.klass;
  const f = m.fig;
  const rankTotal = k.childRank.reduce((a, b) => a + b.value, 0);
  return (
    <Sheet>
      <ChapterHead n={n} title={`Class ${m.year + 2} Profile`} />
      <Tiles
        items={[
          { value: fmt(k.total.total), label: "new scholars", accent: true },
          { value: fmt(k.provinces), label: "provinces" },
          { value: fmt(k.districts), label: "districts" },
          { value: f.class_rural ? `${pct(f.class_rural, k.total.total)}%` : fmt(k.fromNgo), label: f.class_rural ? `from rural areas (${fmt(f.class_rural)})` : "referred by NGO partners" },
        ]}
      />
      <GenderSplit c={k.total} label="Class by gender" />
      <Body summary={m.summary.class} text={m.text.class_text} />
      <Photos paths={m.photos.class} />
      <TwoCol>
        <div>
          <H3>Age</H3>
          <BarList items={k.ages} color={T.cyan} total={k.total.total} />
          <H3>Position among siblings</H3>
          <BarList items={k.childRank} color={T.navy} total={rankTotal} />
          <H3>Parents</H3>
          <BarList items={k.parents} color={T.orange} total={k.parents.reduce((a, b) => a + b.value, 0)} />
        </div>
        <div>
          <H3>Household</H3>
          <Tiles
            items={[
              { value: k.household.avg != null ? fmt(k.household.avg) : "—", label: "average household size" },
              { value: k.household.max != null ? fmt(k.household.max) : "—", label: "largest household" },
            ]}
          />
          <H3>Monthly family income</H3>
          <BarList items={k.income} color={T.orange} total={k.income.reduce((a, b) => a + b.value, 0)} />
          {f.poverty_line ? (
            <p style={{ fontSize: "9pt", color: T.muted }}>National poverty line: USD {fmt(f.poverty_line)} per person per month.</p>
          ) : null}
        </div>
      </TwoCol>
      <TwoCol>
        <div>
          <H3>Fathers&apos; occupation</H3>
          <BarList items={k.fatherJobs} color={T.navy} />
        </div>
        <div>
          <H3>Mothers&apos; occupation</H3>
          <BarList items={k.motherJobs} color={T.cyan} />
        </div>
      </TwoCol>
    </Sheet>
  );
}

function Conclusion({ m, n }: { m: ReportModel; n: string }) {
  const T = useT();
  const photo = m.photos.conclusion?.[0];
  return (
    <Sheet>
      <ChapterHead n={n} title="Conclusion" />
      <Photos paths={photo ? [photo] : []} max={1} />
      <div className="ar-keep" style={{ background: T.navy, color: "#fff", borderRadius: "6pt", padding: "14pt 16pt", borderLeft: `6pt solid ${T.orange}` }}>
        {m.text.conclusion ? (
          paragraphs(m.text.conclusion).map((p, i) => (
            <p key={i} style={{ fontSize: "12pt", fontStyle: "italic", fontWeight: 600, textAlign: "left", marginBottom: "6pt" }}>
              {p}
            </p>
          ))
        ) : (
          <p style={{ fontSize: "12pt", fontStyle: "italic", fontWeight: 600, textAlign: "left", margin: 0 }}>
            The {m.year} Selection Process reached {fmt(m.is.attendees.total || m.fig.exam_takers)} young people; {fmt(m.fig.contracts)} of them were chosen — a
            reflection of PNC&apos;s commitment to providing quality opportunities for the most motivated and deserving candidates.
          </p>
        )}
      </div>
      <div style={{ marginTop: "14mm", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.line}`, paddingTop: "6pt" }}>
        <img src="/brand/pn-logo.png" alt="Passerelles numériques" style={{ height: "11mm", width: "auto" }} />
        <span style={{ fontSize: "8.5pt", color: T.muted }}>Report generated on {m.generated}</span>
      </div>
    </Sheet>
  );
}
