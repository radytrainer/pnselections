/** Reads the first sheet of a CSV/XLS/XLSX file. xlsx is loaded on demand (large). */
export async function readSpreadsheet(file: File) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return {
    objects: XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }),
    matrix: XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }),
    /** Every sheet, for workbooks with one sheet per paper. */
    sheets: wb.SheetNames.map((name) => ({ name, matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" }) })),
  };
}

/** Saves rows as an .xlsx download. */
export async function downloadXlsx(fileName: string, sheetName: string, rows: (string | number | null)[][]) {
  await downloadXlsxBook(fileName, [{ name: sheetName, rows }]);
}

export type XlsxSheet = {
  name: string;
  rows: (string | number | null)[][];
  /** Column widths in characters. */
  widths?: number[];
  /** Turn on Excel's filter buttons on this header row (0-based). */
  filterRow?: number;
  /** Keep these columns as text so Excel doesn't strip leading zeros (e.g. "0001"). */
  textColumns?: number[];
};

/** Saves several sheets as one .xlsx download, with column widths and filters. */
export async function downloadXlsxBook(fileName: string, sheets: XlsxSheet[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.widths) ws["!cols"] = s.widths.map((wch) => ({ wch }));
    if (s.filterRow != null && s.rows[s.filterRow]) {
      const last = XLSX.utils.encode_cell({ r: s.rows.length - 1, c: s.rows[s.filterRow].length - 1 });
      ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: s.filterRow, c: 0 })}:${last}` };
    }
    for (const c of s.textColumns ?? []) {
      for (let r = 0; r < s.rows.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          cell.t = "s";
          cell.v = String(cell.v);
          cell.z = "@";
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}
