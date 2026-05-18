import * as XLSX from "xlsx";

export function downloadExcelTable(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
