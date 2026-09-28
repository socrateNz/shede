import { redirect } from 'next/navigation';
import { Info } from 'lucide-react';
import { getAccountingData } from '@/app/actions/accounting';
import { FilterBar, SetupNotice } from '@/components/accounting/filter-bar';
import { OwnerExportButton } from '@/components/owner/owner-export-button';
import { accountLabel, rubricLabel } from '@/lib/accounting/chart';
import { computeBalanceSheet, computeIncomeStatement, type StatementGroup } from '@/lib/accounting/reports';
import { getLocale, getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; point?: string }>;
}) {
  const params = await searchParams;
  const data = await getAccountingData(params);
  if (!data) redirect('/accounting/expenses');
  const { t, format } = await getT();
  const locale = await getLocale();
  const { scope, period, lines, chart } = data;

  const income = computeIncomeStatement(lines, period.from, period.to);
  const sheet = computeBalanceSheet(lines, period.to);

  function Groups({ groups }: { groups: StatementGroup[] }) {
    return (
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.rubric}>
            <div className="flex justify-between text-sm font-semibold text-slate-100">
              <span>
                <span className="font-mono text-slate-400">{g.rubric}</span> {rubricLabel(locale, g.rubric)}
              </span>
              <span className="tabular-nums">{format.number(g.total)}</span>
            </div>
            <ul className="mt-1 space-y-0.5 border-l border-slate-700 pl-3">
              {g.accounts.map((a) => (
                <li key={a.account} className="flex justify-between text-xs text-slate-400">
                  <span>
                    <span className="font-mono">{a.account}</span> {accountLabel(chart, a.account)}
                  </span>
                  <span className="tabular-nums">{format.number(a.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  const flatten = (groups: StatementGroup[], side: string) =>
    groups.flatMap((g) =>
      g.accounts.map((a) => ({
        [t('accounting.statements.income')]: side,
        [t('accounting.common.account')]: a.account,
        [t('accounting.common.label')]: accountLabel(chart, a.account),
        [t('accounting.common.total')]: a.amount,
      }))
    );

  return (
    <div className="space-y-6">
      <FilterBar from={period.from} to={period.to} points={scope.points} pointId={scope.pointId}>
        <OwnerExportButton
          sheets={{
            [t('accounting.statements.income')]: [
              ...flatten(income.charges, t('accounting.statements.charges')),
              ...flatten(income.products, t('accounting.statements.products')),
            ],
            [t('accounting.statements.balanceSheet', { date: period.to })]: [
              ...flatten(sheet.assets, t('accounting.statements.assets')),
              ...flatten(sheet.liabilities, t('accounting.statements.liabilities')),
            ],
          }}
          filename={t('accounting.statements.exportFile', { from: period.from, to: period.to })}
        />
      </FilterBar>
      {!data.installed && <SetupNotice title={t('accounting.setup.title')} text={t('accounting.setup.text')} />}

      <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
        <h2 className="text-lg font-semibold text-slate-50">{t('accounting.statements.income')}</h2>
        <p className="mb-4 text-sm text-slate-400">
          {t('accounting.common.period', { from: format.date(period.from), to: format.date(period.to) })}
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-rose-300">{t('accounting.statements.charges')}</h3>
            <Groups groups={income.charges} />
            <div className="mt-3 flex justify-between border-t border-slate-700 pt-2 font-semibold text-slate-100">
              <span>{t('accounting.statements.totalCharges')}</span>
              <span className="tabular-nums">{format.money(income.totalCharges)}</span>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-300">{t('accounting.statements.products')}</h3>
            <Groups groups={income.products} />
            <div className="mt-3 flex justify-between border-t border-slate-700 pt-2 font-semibold text-slate-100">
              <span>{t('accounting.statements.totalProducts')}</span>
              <span className="tabular-nums">{format.money(income.totalProducts)}</span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            'mt-5 flex justify-between rounded-lg px-4 py-3 text-lg font-bold',
            income.result >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
          )}
        >
          <span>{income.result >= 0 ? t('accounting.statements.profit') : t('accounting.statements.loss')}</span>
          <span className="tabular-nums">{format.money(Math.abs(income.result))}</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-50">
          {t('accounting.statements.balanceSheet', { date: format.date(period.to) })}
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-sky-300">{t('accounting.statements.assets')}</h3>
            <Groups groups={sheet.assets} />
            <div className="mt-3 flex justify-between border-t border-slate-700 pt-2 font-semibold text-slate-100">
              <span>{t('accounting.statements.totalAssets')}</span>
              <span className="tabular-nums">{format.money(sheet.totalAssets)}</span>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-violet-300">{t('accounting.statements.liabilities')}</h3>
            <Groups groups={sheet.liabilities} />
            <div className="mt-3 flex justify-between text-sm font-semibold text-slate-100">
              <span>{t('accounting.statements.equityResult')}</span>
              <span className={cn('tabular-nums', sheet.result < 0 && 'text-rose-300')}>{format.number(sheet.result)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-700 pt-2 font-semibold text-slate-100">
              <span>{t('accounting.statements.totalLiabilities')}</span>
              <span className="tabular-nums">{format.money(sheet.totalLiabilities)}</span>
            </div>
          </div>
        </div>
        <p className="mt-5 flex gap-2 text-xs text-slate-500">
          <Info className="h-4 w-4 shrink-0" />
          {t('accounting.statements.note')}
        </p>
      </section>
    </div>
  );
}
