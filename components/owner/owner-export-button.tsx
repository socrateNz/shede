'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/client';

export type OwnerExportSheets = Record<string, Record<string, string | number>[]>;

/**
 * Exporte un classeur Excel (une feuille par section). `load` : données chargées au clic,
 * pour exporter toute une période quand l'écran n'en affiche qu'une page.
 */
export function OwnerExportButton({
  sheets,
  load,
  filename,
}: {
  sheets?: OwnerExportSheets;
  load?: () => Promise<OwnerExportSheets>;
  filename: string;
}) {
  const [pending, setPending] = useState(false);
  const { t } = useT();

  async function handleExport() {
    setPending(true);
    try {
      const XLSX = await import('xlsx');
      const data = load ? await load() : (sheets ?? {});
      const workbook = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(data)) {
        const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: t('org.owner.export.empty') }]);
        XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
      }
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('org.owner.export.error'));
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
      {t('org.owner.export.button')}
    </Button>
  );
}
