'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export type OwnerExportSheets = Record<string, Record<string, string | number>[]>;

/** Exporte le rapport propriétaire en un classeur Excel (une feuille par section). */
export function OwnerExportButton({ sheets, filename }: { sheets: OwnerExportSheets; filename: string }) {
  const [pending, setPending] = useState(false);

  async function handleExport() {
    setPending(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(sheets)) {
        const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucune donnée' }]);
        XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
      }
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Erreur lors de l'export.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={pending}
      className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      Exporter (Excel)
    </Button>
  );
}
