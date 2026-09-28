import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getAccountingData } from '@/app/actions/accounting';
import { FilterBar, SetupNotice } from '@/components/accounting/filter-bar';
import { OwnerExportButton } from '@/components/owner/owner-export-button';
import { accountLabel } from '@/lib/accounting/chart';
import { computeBalance } from '@/lib/accounting/reports';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8'];

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; point?: string; class?: string }>;
}) {
  const params = await searchParams;
  const data = await getAccountingData(params);
  if (!data) redirect('/accounting/expenses');
  const { t, format } = await getT();
  const { scope, period, lines, chart } = data;
  const selectedClass = CLASSES.includes(params.class ?? '') ? params.class! : null;

  const all = computeBalance(lines, period.from);
  const rows = selectedClass ? all.filter((r) => r.account.startsWith(selectedClass)) : all;
  const sum = (key: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + Number(r[key]), 0);
  const totals = {
    openingDebit: sum('openingDebit'),
    openingCredit: sum('openingCredit'),
    debit: sum('debit'),
    credit: sum('credit'),
    closingDebit: sum('closingDebit'),
    closingCredit: sum('closingCredit'),
  };
  const gap = Math.round((all.reduce((s, r) => s + r.debit - r.credit, 0)) * 100) / 100;

  const hrefFor = (cls: string | null) => {
    const search = new URLSearchParams({ from: period.from, to: period.to });
    if (scope.pointId) search.set('point', scope.pointId);
    if (cls) search.set('class', cls);
    return `/accounting/balance?${search.toString()}`;
  };

  const exportRows = rows.map((r) => ({
    [t('accounting.common.account')]: r.account,
    [t('accounting.common.label')]: accountLabel(chart, r.account),
    [`${t('accounting.balance.opening')} — ${t('accounting.common.debit')}`]: r.openingDebit,
    [`${t('accounting.balance.opening')} — ${t('accounting.common.credit')}`]: r.openingCredit,
    [`${t('accounting.balance.movements')} — ${t('accounting.common.debit')}`]: r.debit,
    [`${t('accounting.balance.movements')} — ${t('accounting.common.credit')}`]: r.credit,
    [`${t('accounting.balance.closing')} — ${t('accounting.common.debit')}`]: r.closingDebit,
    [`${t('accounting.balance.closing')} — ${t('accounting.common.credit')}`]: r.closingCredit,
  }));

  const n = (v: number) => (v ? format.number(v) : '');

  return (
    <div className="space-y-6">
      <FilterBar from={period.from} to={period.to} points={scope.points} pointId={scope.pointId}>
        <OwnerExportButton
          sheets={{ [t('accounting.nav.balance')]: exportRows }}
          filename={t('accounting.balance.exportFile', { from: period.from, to: period.to })}
        />
      </FilterBar>
      {!data.installed && <SetupNotice title={t('accounting.setup.title')} text={t('accounting.setup.text')} />}

      <div className="flex flex-wrap items-center gap-2">
        {[null, ...CLASSES].map((cls) => (
          <Link
            key={cls ?? 'all'}
            href={hrefFor(cls)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm',
              selectedClass === cls ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'
            )}
          >
            {cls ? t('accounting.balance.class', { number: cls }) : t('accounting.balance.allClasses')}
          </Link>
        ))}
        <span className={cn('ml-auto flex items-center gap-1.5 text-sm', gap === 0 ? 'text-emerald-400' : 'text-rose-400')}>
          {gap === 0 ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {gap === 0 ? t('accounting.balance.balanced') : t('accounting.balance.unbalanced', { amount: format.number(Math.abs(gap)) })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-700/60">
              <th rowSpan={2} className="px-4 py-2 text-left">{t('accounting.common.account')}</th>
              <th colSpan={2} className="px-4 py-2 text-center">{t('accounting.balance.opening')}</th>
              <th colSpan={2} className="px-4 py-2 text-center">{t('accounting.balance.movements')}</th>
              <th colSpan={2} className="px-4 py-2 text-center">{t('accounting.balance.closing')}</th>
            </tr>
            <tr className="border-b border-slate-700">
              {['opening', 'movements', 'closing'].flatMap((group) => [
                <th key={`${group}-d`} className="px-4 py-2 text-right">{t('accounting.common.debit')}</th>,
                <th key={`${group}-c`} className="px-4 py-2 text-right">{t('accounting.common.credit')}</th>,
              ])}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  {t('accounting.common.empty')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.account} className="text-slate-300 hover:bg-slate-700/20">
                  <td className="px-4 py-2">
                    <span className="font-mono text-slate-100">{r.account}</span>
                    <span className="ml-2 text-xs text-slate-500">{accountLabel(chart, r.account)}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{n(r.openingDebit)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{n(r.openingCredit)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{n(r.debit)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{n(r.credit)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-100">{n(r.closingDebit)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-100">{n(r.closingCredit)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t border-slate-700 font-semibold text-slate-100">
            <tr>
              <td className="px-4 py-2">{t('accounting.common.totals')}</td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(totals.openingDebit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(totals.openingCredit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(totals.debit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(totals.credit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(totals.closingDebit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(totals.closingCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
