import Link from 'next/link';
import { Scale } from 'lucide-react';
import { requireModule } from '@/app/actions/auth';
import { getVarianceReport } from '@/app/actions/stock-control';
import { PeriodTabs } from '@/components/period-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parsePeriod, periodRange } from '@/lib/periods';
import { getT } from '@/lib/i18n/server';

export default async function VariancesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireModule('STOCK');
  const { t, format } = await getT();
  const period = parsePeriod((await searchParams).period);
  const { from, to } = periodRange(period);
  const report = await getVarianceReport(from, to);

  const unitShort = (unit: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : '');
  const qty = (value: number, unit: string | null) => `${format.number(value, { maximumFractionDigits: 3 })} ${unitShort(unit)}`.trim();
  // Écart inexpliqué rapporté à la consommation théorique (valeurs)
  const unexplained =
    report && report.totals.soldValue > 0 ? Math.round((-report.totals.inventoryGapValue / report.totals.soldValue) * 1000) / 10 : null;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-2">
          <Scale className="h-4 w-4 text-teal-300" />
          <span className="text-sm font-medium text-teal-300">{t('stockControl.variances.badge')}</span>
        </div>
        <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('stockControl.variances.title')}</h1>
        <p className="max-w-3xl text-slate-400">{t('stockControl.variances.subtitle')}</p>
      </div>

      {report === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('stockControl.variances.notInstalled')}</p>
      ) : (
        <>
          <div className="mb-4">
            <PeriodTabs
              basePath="/stock/variances"
              current={period}
              labels={{
                d7: t('stockControl.periods.d7'),
                d30: t('stockControl.periods.d30'),
                month: t('stockControl.periods.month'),
                lastMonth: t('stockControl.periods.lastMonth'),
              }}
            />
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('stockControl.variances.sold')}</p>
              <p className="mt-1 text-2xl font-bold text-white">{format.money(report.totals.soldValue)}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('stockControl.variances.lost')}</p>
              <p className="mt-1 text-2xl font-bold text-red-300">{format.money(report.totals.lostValue)}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('stockControl.variances.gap')}</p>
              <p className={`mt-1 text-2xl font-bold ${report.totals.inventoryGapValue < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {format.money(report.totals.inventoryGapValue)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{t('stockControl.variances.gapHint')}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('stockControl.variances.unexplained')}</p>
              <p className="mt-1 text-2xl font-bold text-white">{unexplained === null ? '—' : `${format.number(unexplained)} %`}</p>
            </div>
          </div>

          <p className="mb-4 text-sm text-slate-400">
            {report.inventories > 0 ? (
              t('stockControl.variances.inventories', { count: report.inventories })
            ) : (
              <>
                {t('stockControl.variances.noInventory')}{' '}
                <Link href="/stock/inventories" className="text-teal-300 hover:underline">{t('nav.inventories')}</Link>
              </>
            )}
          </p>

          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
            {report.rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">{t('stockControl.variances.empty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-300">{t('stockControl.variances.colItem')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('stockControl.variances.colType')}</TableHead>
                    <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.variances.colSold')}</TableHead>
                    <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.variances.colLost')}</TableHead>
                    <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.variances.colGap')}</TableHead>
                    <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.variances.colGapValue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={row.key} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className="font-medium text-slate-100">{row.name}</TableCell>
                      <TableCell className="text-slate-400">{t(`stock.itemType.${row.item_type}`)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-200">
                        {qty(row.sold, row.unit)}
                        {row.soldValue !== null && <p className="text-xs text-slate-500">{format.money(row.soldValue)}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-200">
                        {row.lost ? qty(row.lost, row.unit) : '—'}
                        {row.lost !== 0 && row.lostValue !== null && <p className="text-xs text-red-300">{format.money(row.lostValue)}</p>}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${row.inventoryGap < 0 ? 'text-red-400' : row.inventoryGap > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {row.inventoryGap ? `${row.inventoryGap > 0 ? '+' : ''}${qty(row.inventoryGap, row.unit)}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${(row.inventoryGapValue ?? 0) < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                        {row.inventoryGapValue === null || row.inventoryGap === 0 ? '—' : format.money(row.inventoryGapValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">{t('stockControl.variances.valuedHint')}</p>
        </>
      )}
    </div>
  );
}
