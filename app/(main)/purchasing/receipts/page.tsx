import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireModule } from '@/app/actions/auth';
import { listReceipts } from '@/app/actions/purchasing';
import { Button } from '@/components/ui/button';
import { PeriodTabs } from '@/components/period-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parsePeriod, periodRange } from '@/lib/periods';
import { getT } from '@/lib/i18n/server';
import { parsePage } from '@/lib/pagination';
import { PageNav } from '@/components/page-nav';

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ period?: string; page?: string }> }) {
  await requireModule('ACHATS');
  const { t, format } = await getT();
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const { from, to } = periodRange(period);
  // 20 réceptions par page ; total de la période calculé en SQL.
  const result = await listReceipts(from, to, { page: parsePage(params.page) });
  const receipts = result?.items ?? null;
  const total = result?.meta.stats.amount ?? 0;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('purchasing.receipts.title')}</h1>
          <p className="max-w-2xl text-slate-400">{t('purchasing.receipts.subtitle')}</p>
        </div>
        {receipts !== null && (
          <Link href="/purchasing/receipts/new">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700">
              <Plus className="mr-2 h-4 w-4" /> {t('purchasing.receipts.direct')}
            </Button>
          </Link>
        )}
      </div>

      {receipts === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('purchasing.notInstalled')}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <PeriodTabs
              basePath="/purchasing/receipts"
              current={period}
              labels={{
                d7: t('stockControl.periods.d7'),
                d30: t('stockControl.periods.d30'),
                month: t('stockControl.periods.month'),
                lastMonth: t('stockControl.periods.lastMonth'),
              }}
            />
            <p className="text-sm text-slate-300">
              {t('purchasing.receipts.colTotal')} : <strong className="tabular-nums text-white">{format.money(total)}</strong>
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
            {result!.meta.total === 0 ? (
              <p className="py-14 text-center text-sm text-slate-400">{t('purchasing.receipts.empty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-300">{t('purchasing.receipts.colNumber')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('purchasing.receipts.colDate')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('purchasing.receipts.colSupplier')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('purchasing.receipts.colOrder')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('purchasing.receipts.colInvoice')}</TableHead>
                    <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.receipts.colTotal')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('purchasing.receipts.colBy')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('purchasing.receipts.colAccounting')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className="font-mono text-sm text-slate-100">{r.number}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-300">{format.dateTime(r.received_at)}</TableCell>
                      <TableCell className="text-slate-200">{r.supplier_name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {r.order_id ? <Link href={`/purchasing/orders/${r.order_id}`} className="text-cyan-300 hover:underline">{r.order_number}</Link> : <span className="text-slate-500">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">{r.invoice_reference ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-100">{format.money(r.total_ht)}</TableCell>
                      <TableCell className="text-sm text-slate-400">{r.received_by ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {r.accounted ? <span className="rounded-full bg-lime-500/10 px-2 py-0.5 text-xs text-lime-300">{t('purchasing.receipts.accounted')}</span> : <span className="text-slate-500">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <PageNav meta={result!.meta} />
          </div>
        </>
      )}
    </div>
  );
}
