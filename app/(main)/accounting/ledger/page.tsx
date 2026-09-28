import { redirect } from 'next/navigation';
import { getAccountingData } from '@/app/actions/accounting';
import { FilterBar, SetupNotice } from '@/components/accounting/filter-bar';
import { OwnerExportButton } from '@/components/owner/owner-export-button';
import { Button } from '@/components/ui/button';
import { accountLabel } from '@/lib/accounting/chart';
import { computeLedger } from '@/lib/accounting/reports';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; point?: string; account?: string }>;
}) {
  const params = await searchParams;
  const data = await getAccountingData(params);
  if (!data) redirect('/accounting/expenses');
  const { t, format } = await getT();
  const { scope, period, lines, chart } = data;

  // Comptes mouvementés (y compris sous-comptes) proposés dans la liste
  const used = [...new Set(lines.map((l) => l.account))].sort();
  const account = params.account && /^\d{2,12}$/.test(params.account) ? params.account : used[0] ?? '571';
  const ledger = computeLedger(lines, account, period.from);
  const signedLabel = (value: number) =>
    `${format.number(Math.abs(value))} ${value >= 0 ? t('accounting.common.debit') : t('accounting.common.credit')}`.trim();

  const exportRows = ledger.rows.map((r) => ({
    [t('accounting.common.date')]: r.entry_date,
    [t('accounting.common.journal')]: r.journal,
    [t('accounting.common.account')]: r.account,
    [t('accounting.common.label')]: r.label,
    [t('accounting.common.debit')]: r.debit,
    [t('accounting.common.credit')]: r.credit,
    [t('accounting.common.balance')]: r.balance,
  }));

  return (
    <div className="space-y-6">
      <FilterBar from={period.from} to={period.to} points={scope.points} pointId={scope.pointId}>
        <OwnerExportButton
          sheets={{ [account]: exportRows }}
          filename={t('accounting.ledger.exportFile', { account, from: period.from, to: period.to })}
        />
      </FilterBar>
      {!data.installed && <SetupNotice title={t('accounting.setup.title')} text={t('accounting.setup.text')} />}

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
        <input type="hidden" name="from" value={period.from} />
        <input type="hidden" name="to" value={period.to} />
        {scope.pointId && <input type="hidden" name="point" value={scope.pointId} />}
        <label className="flex-1 space-y-1 text-sm text-slate-300">
          {t('accounting.ledger.chooseAccount')}
          <select name="account" defaultValue={account} className="w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-100">
            {[...new Set([...used, ...chart.map((a) => a.number)])].sort().map((number) => (
              <option key={number} value={number}>
                {number} — {accountLabel(chart, number)}
                {used.includes(number) ? ' •' : ''}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
          {t('accounting.filters.apply')}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 px-4 py-3">
          <h2 className="font-semibold text-slate-100">
            <span className="font-mono">{account}</span> — {accountLabel(chart, account)}
          </h2>
          <span className="text-sm text-slate-400">
            {t('accounting.ledger.opening', { date: format.date(period.from) })} : {signedLabel(ledger.opening)}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">{t('accounting.common.date')}</th>
              <th className="px-4 py-2">{t('accounting.common.journal')}</th>
              <th className="px-4 py-2">{t('accounting.common.label')}</th>
              <th className="px-4 py-2 text-right">{t('accounting.common.debit')}</th>
              <th className="px-4 py-2 text-right">{t('accounting.common.credit')}</th>
              <th className="px-4 py-2 text-right">{t('accounting.common.balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {ledger.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  {t('accounting.ledger.empty')}
                </td>
              </tr>
            ) : (
              ledger.rows.map((r) => (
                <tr key={r.id} className="text-slate-300">
                  <td className="whitespace-nowrap px-4 py-2">{format.date(r.entry_date)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.journal}</td>
                  <td className="px-4 py-2">
                    {r.label}
                    {r.account !== account && <span className="ml-2 font-mono text-xs text-slate-500">{r.account}</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.debit ? format.number(r.debit) : ''}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.credit ? format.number(r.credit) : ''}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', r.balance < 0 && 'text-rose-300')}>{format.number(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t border-slate-700 font-semibold text-slate-100">
            <tr>
              <td colSpan={3} className="px-4 py-2">
                {t('accounting.ledger.closing', { date: format.date(period.to) })} : {signedLabel(ledger.closing)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(ledger.debit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{format.number(ledger.credit)}</td>
              <td className="px-4 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
