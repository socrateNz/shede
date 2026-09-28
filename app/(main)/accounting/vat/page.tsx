import { redirect } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { getAccountingData } from '@/app/actions/accounting';
import { FilterBar, SetupNotice } from '@/components/accounting/filter-bar';
import { OwnerExportButton } from '@/components/owner/owner-export-button';
import { accountLabel } from '@/lib/accounting/chart';
import { VAT_COLLECTED_ACCOUNTS, VAT_DEDUCTIBLE_ACCOUNTS } from '@/lib/accounting/mapping';
import { computeVat } from '@/lib/accounting/reports';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function VatPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; point?: string }>;
}) {
  const params = await searchParams;
  const data = await getAccountingData(params);
  if (!data) redirect('/accounting/expenses');
  const { t, format } = await getT();
  const { scope, period, lines, chart } = data;
  const vat = computeVat(lines, period.from, period.to);

  // Détail par compte de TVA sur la période
  const detail = [...VAT_COLLECTED_ACCOUNTS, ...VAT_DEDUCTIBLE_ACCOUNTS].map((account) => {
    const own = lines.filter((l) => l.account.startsWith(account) && l.entry_date >= period.from && l.entry_date <= period.to);
    return {
      account,
      debit: own.reduce((s, l) => s + l.debit, 0),
      credit: own.reduce((s, l) => s + l.credit, 0),
    };
  });

  const cards = [
    { label: t('accounting.vat.salesBase'), value: vat.salesBase, tone: 'text-slate-50' },
    { label: t('accounting.vat.collected'), value: vat.collected, tone: 'text-slate-50' },
    { label: t('accounting.vat.deductible'), value: vat.deductible, tone: 'text-slate-50' },
    vat.credit > 0
      ? { label: t('accounting.vat.credit'), value: vat.credit, tone: 'text-sky-300' }
      : { label: t('accounting.vat.toPay'), value: vat.toPay, tone: 'text-amber-300' },
  ];

  return (
    <div className="space-y-6">
      <FilterBar from={period.from} to={period.to} points={scope.points} pointId={scope.pointId}>
        <OwnerExportButton
          sheets={{
            [t('accounting.nav.vat')]: [
              ...cards.map((c) => ({ [t('accounting.common.label')]: c.label, [t('accounting.common.total')]: c.value })),
            ],
            [t('accounting.vat.detail')]: detail.map((d) => ({
              [t('accounting.common.account')]: d.account,
              [t('accounting.common.label')]: accountLabel(chart, d.account),
              [t('accounting.common.debit')]: d.debit,
              [t('accounting.common.credit')]: d.credit,
            })),
          }}
          filename={t('accounting.vat.exportFile', { from: period.from, to: period.to })}
        />
      </FilterBar>
      {!data.installed && <SetupNotice title={t('accounting.setup.title')} text={t('accounting.setup.text')} />}

      <div>
        <h2 className="text-xl font-semibold text-slate-50">{t('accounting.vat.title')}</h2>
        <p className="text-sm text-slate-400">{t('accounting.vat.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <p className="text-sm text-slate-400">{c.label}</p>
            <p className={cn('mt-2 text-2xl font-bold tabular-nums', c.tone)}>{format.money(c.value)}</p>
          </div>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        {t('accounting.vat.deadline')}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <div className="border-b border-slate-700/60 px-4 py-3 font-semibold text-slate-100">{t('accounting.vat.detail')}</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">{t('accounting.common.account')}</th>
              <th className="px-4 py-2 text-right">{t('accounting.common.debit')}</th>
              <th className="px-4 py-2 text-right">{t('accounting.common.credit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {detail.map((d) => (
              <tr key={d.account} className="text-slate-300">
                <td className="px-4 py-2">
                  <span className="font-mono text-slate-100">{d.account}</span>
                  <span className="ml-2 text-xs text-slate-500">{accountLabel(chart, d.account)}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{format.number(d.debit)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{format.number(d.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
