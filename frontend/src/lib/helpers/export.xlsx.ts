import * as XLSX from 'xlsx';

export function exportToXLSX(data: Record<string, any>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}