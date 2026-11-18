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
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName);
}
