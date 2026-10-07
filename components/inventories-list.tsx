'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Loader2, Play, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { startInventory, type InventorySummary } from '@/app/actions/inventory';
import { useT } from '@/lib/i18n/client';

const STATUS_STYLES = {
  DRAFT: 'bg-sky-500/10 text-sky-300',
  VALIDATED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-slate-700/40 text-slate-400',
} as const;

/** Liste des inventaires et ouverture d'un nouveau comptage. */
export function InventoriesList({ inventories }: { inventories: InventorySummary[] | null }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const draft = inventories?.find((i) => i.status === 'DRAFT');

  function start() {
    startTransition(async () => {
      const result = await startInventory();
      if (!result.success || !result.id) {
        toast.error(result.error);
        return;
      }
      router.push(`/stock/inventories/${result.id}`);
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-2">
            <ClipboardCheck className="h-4 w-4 text-teal-300" />
            <span className="text-sm font-medium text-teal-300">{t('stockControl.inventory.badge')}</span>
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            {t('stockControl.inventory.title')}
          </h1>
          <p className="max-w-2xl text-slate-400">{t('stockControl.inventory.subtitle')}</p>
        </div>
        {inventories !== null &&
          (draft ? (
            <Link href={`/stock/inventories/${draft.id}`}>
              <Button className="bg-sky-600 text-white hover:bg-sky-700">
                <Play className="mr-2 h-4 w-4" />
                {t('stockControl.inventory.resume')}
              </Button>
            </Link>
          ) : (
            <Button type="button" onClick={start} disabled={pending} className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {t('stockControl.inventory.newButton')}
            </Button>
          ))}
      </div>

      {inventories === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('stockControl.inventory.notInstalled')}</p>
      ) : inventories.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 py-16 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-400">{t('stockControl.inventory.empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-300">{t('stockControl.inventory.colDate')}</TableHead>
                <TableHead className="font-semibold text-slate-300">{t('stockControl.inventory.colStatus')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.inventory.colProgress')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.inventory.colVariance')}</TableHead>
                <TableHead className="font-semibold text-slate-300">{t('stockControl.inventory.colBy')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.inventory.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventories.map((inventory) => (
                <TableRow key={inventory.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-slate-100">{format.dateTime(inventory.validated_at ?? inventory.created_at)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[inventory.status]}`}>
                      {t(`stockControl.inventory.status.${inventory.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-200">
                    {inventory.counted_lines} / {inventory.total_lines}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${(inventory.variance_value ?? 0) < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                    {inventory.variance_value === null ? '—' : format.money(inventory.variance_value)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-400">{inventory.validated_by ?? inventory.started_by ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/stock/inventories/${inventory.id}`}>
                      <Button size="sm" variant="ghost" className="text-teal-300 hover:bg-slate-700">
                        {inventory.status === 'DRAFT' ? t('stockControl.inventory.resume') : t('stockControl.inventory.open')}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
