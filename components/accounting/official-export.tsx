'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ExportSheet = { name: string; rows: (string | number)[][] };

/** Classeur Excel des états officiels : une feuille par état, références et montants en nombres. */
export function OfficialExport({ sheets, fileName, label }: { sheets: ExportSheet[]; fileName: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const XLSX = await import('xlsx');
          const book = XLSX.utils.book_new();
          for (const sheet of sheets) {
            const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
            ws['!cols'] = sheet.rows[0]?.map((_, i) => ({ wch: i === 1 ? 60 : i === 0 ? 8 : 16 }));
            XLSX.utils.book_append_sheet(book, ws, sheet.name.slice(0, 31));
          }
          XLSX.writeFile(book, fileName);
        } finally {
          setBusy(false);
        }
      }}
      className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-slate-50 print:hidden"
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}
