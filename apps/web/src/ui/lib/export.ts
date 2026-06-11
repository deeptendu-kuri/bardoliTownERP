import * as XLSX from 'xlsx';
import { sheetExportRows } from '@/backend';

/**
 * Build the .xlsx that mirrors the studio's original spreadsheet, column-for-column
 * (doc 03 §3 / excel-export skill). json_to_sheet keeps the key order of the first
 * row, which is exactly the legacy column order defined in SheetRow.
 */
export function exportSheet(): void {
  const rows = sheetExportRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Studio Sheet');
  XLSX.writeFile(wb, `studio-os-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
