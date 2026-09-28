import { redirect } from 'next/navigation';
import { AlertTriangle, Info, Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { getAccountingData, getMissingSalesCount } from '@/app/actions/accounting';
import { FilterBar, SetupNotice } from '@/components/accounting/filter-bar';
import { GenerateMissingButton, LockForm } from '@/components/accounting/dashboard-actions';
import { accountBalance, computeIncomeStatement, computeVat } from '@/lib/accounting/reports';
import { SALES_ACCOUNTS, SUPPLIERS_ACCOUNT } from '@/lib/accounting/mapping';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function AccountingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; point?: string }>;
}) {
  const params = await searchParams;
  const data = await getAccountingData(params);
  if (!data) redirect('/accounting/expenses');
  const { t, format } = await getT();
  const { scope, period, lines } = data;

  const income = computeIncomeStatement(lines, period.from, period.to);
  const vat = computeVat(lines, period.from, period.to);
  const missing = scope.canPost && data.installed ? await getMissingSalesCount(period) : 0;

  const kpis = [
    { label: t('accounting.dashboard.revenue'), value: income.revenue, icon: TrendingUp, tone: 'text-emerald-400' },
    { label: t('accounting.dashboard.charges'), value: income.totalCharges, icon: TrendingDown, tone: 'text-rose-400' },
    {
      label: t('accounting.dashboard.result'),
      value: income.result,
      icon: Landmark,
      tone: income.result >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    { label: t('accounting.dashboard.vatDue'), value: vat.net, icon: AlertTriangle, tone: 'text-amber-300' },
  ];

  const treasury = [
    { label: t('accounting.dashboard.cash'), value: accountBalance(lines, '571', period.to) },
    { label: t('accounting.dashboard.mobile'), value: accountBalance(lines, '552', period.to) },
    { label: t('accounting.dashboard.bank'), value: accountBalance(lines, '521', period.to) },
    { label: t('accounting.dashboard.cheques'), value: accountBalance(lines, '513', period.to) },
  ];
  const payables = -accountBalance(lines, SUPPLIERS_ACCOUNT, period.to);
  const receivables = accountBalance(lines, SALES_ACCOUNTS.receivable, period.to);

  return (
    <div className="space-y-6">
      <FilterBar from={period.from} to={period.to} points={scope.points} pointId={scope.pointId} />
      {!data.installed && <SetupNotice title={t('accounting.setup.title')} text={t('accounting.setup.text')} />}

      {missing > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-amber-200">{t('accounting.dashboard.missingTitle', { count: missing })}</p>
            <p className="mt-1 text-sm text-amber-200/80">{t('accounting.dashboard.missingText')}</p>
          </div>
          <GenerateMissingButton from={period.from} to={period.to} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">{kpi.label}</p>
              <kpi.icon className={cn('h-5 w-5', kpi.tone)} />
            </div>
            <p className={cn('mt-2 text-2xl font-bold tabular-nums', kpi.tone)}>{format.money(kpi.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-100">
            <Wallet className="h-5 w-5 text-emerald-400" />
            {t('accounting.dashboard.treasury', { date: format.date(period.to) })}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {treasury.map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-900/50 p-3">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className={cn('mt-1 text-lg font-semibold tabular-nums', item.value < 0 ? 'text-rose-400' : 'text-slate-50')}>
                  {format.money(item.value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-xs text-slate-400">{t('accounting.dashboard.payables')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-rose-300">{format.money(payables)}</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-xs text-slate-400">{t('accounting.dashboard.receivables')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-sky-300">{format.money(receivables)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <h2 className="mb-3 font-semibold text-slate-100">{t('accounting.dashboard.lockTitle')}</h2>
          {scope.canPost ? (
            <LockForm lockedUntil={scope.lockedUntil} canUnlock={scope.role === 'ADMIN'} />
          ) : (
            <p className="text-sm text-slate-400">{t('accounting.common.readOnly')}</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-sm text-slate-300">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-blue-300">
          <Info className="h-4 w-4" />
          {t('accounting.dashboard.howTitle')}
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('accounting.dashboard.how1')}</li>
          <li>{t('accounting.dashboard.how2')}</li>
          <li>{t('accounting.dashboard.how3')}</li>
        </ul>
      </section>
    </div>
  );
}
