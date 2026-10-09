import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Paperclip } from 'lucide-react';
import { getExpenses } from '@/app/actions/accounting';
import { PageNav } from '@/components/page-nav';
import { parsePage } from '@/lib/pagination';
import { FilterBar, SetupNotice } from '@/components/accounting/filter-bar';
import { ExpenseFormDialog } from '@/components/accounting/expense-form';
import { ExpenseActions } from '@/components/accounting/expense-actions';
import { isExpenseCategory } from '@/lib/accounting/mapping';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

const STATUSES = ['UNPAID', 'PAID', 'CANCELLED'] as const;
const STATUS_STYLE: Record<string, string> = {
  UNPAID: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  PAID: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'border-slate-600 bg-slate-700/40 text-slate-400 line-through',
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  // 20 dépenses par page ; totaux de la période calculés en SQL.
  const data = await getExpenses({ ...params, page: parsePage(params.page) });
  if (!data) redirect('/unauthorized');
  const { t, format } = await getT();
  const { scope, period, expenses, meta } = data;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number]) ? params.status : null;

  const total = meta.stats.total;

  const hrefFor = (next: string | null) => {
    const search = new URLSearchParams({ from: period.from, to: period.to });
    if (next) search.set('status', next);
    return `/accounting/expenses?${search.toString()}`;
  };

  return (
    <div className="space-y-6">
      <FilterBar from={period.from} to={period.to}>
        <ExpenseFormDialog suppliers={data.suppliers} />
      </FilterBar>
      {!data.installed && <SetupNotice title={t('accounting.setup.title')} text={t('accounting.setup.text')} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <p className="text-sm text-slate-400">{t('accounting.expenses.totalPeriod')}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-50">{format.money(total)}</p>
          <p className="mt-1 text-xs text-slate-500">{t('accounting.expenses.count', { count: meta.stats.count })}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <p className="text-sm text-slate-400">{t('accounting.expenses.unpaidTotal')}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-300">{format.money(data.unpaidTotal)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[null, ...STATUSES].map((s) => (
          <Link
            key={s ?? 'all'}
            href={hrefFor(s)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm',
              status === s ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'
            )}
          >
            {s ? t(`accounting.expenses.status.${s}`) : t('accounting.expenses.statusAll')}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('accounting.expenses.colDate')}</th>
              <th className="px-4 py-3">{t('accounting.expenses.colLabel')}</th>
              <th className="px-4 py-3">{t('accounting.expenses.colSupplier')}</th>
              <th className="px-4 py-3">{t('accounting.expenses.colCategory')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.expenses.colTtc')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.expenses.colTax')}</th>
              <th className="px-4 py-3">{t('accounting.expenses.colStatus')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.expenses.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  {t('accounting.expenses.empty')}
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="text-slate-200 hover:bg-slate-700/20">
                  <td className="whitespace-nowrap px-4 py-3">{format.date(e.expense_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{e.label}</span>
                      {e.attachment_url && (
                        <a href={e.attachment_url} target="_blank" rel="noopener noreferrer" title={t('accounting.expenses.attachment')} className="text-sky-400 hover:text-sky-300">
                          <Paperclip className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    {e.reference && <p className="text-xs text-slate-500">{e.reference}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{e.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {isExpenseCategory(e.category) ? t(`accounting.categories.${e.category}`) : e.category}
                    <span className="ml-1 font-mono text-xs text-slate-500">{e.account}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{format.money(e.amount_ttc)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-400">{format.money(e.tax_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs', STATUS_STYLE[e.status])}>
                      {t(`accounting.expenses.status.${e.status}`)}
                    </span>
                    {e.status === 'PAID' && e.payment_method && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t(`accounting.paymentMethods.${e.payment_method as 'CASH'}`)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ExpenseActions id={e.id} status={e.status} expenseDate={e.expense_date} canCancel={scope.canPost} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PageNav meta={meta} />
      </div>
    </div>
  );
}
