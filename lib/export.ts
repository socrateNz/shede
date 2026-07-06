import * as XLSX from 'xlsx';

/**
 * Exporte un tableau d'objets JSON en fichier Excel (.xlsx)
 * @param data Le tableau de données
 * @param filename Le nom du fichier (sans extension)
 */
export function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Données');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Exporte un tableau d'objets JSON en fichier CSV (.csv)
 * @param data Le tableau de données
 * @param filename Le nom du fichier (sans extension)
 */
export function exportToCSV(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
