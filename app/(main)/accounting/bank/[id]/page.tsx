import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Scale } from 'lucide-react';
import { getAccountingScope, getSuppliers } from '@/app/actions/accounting';
import { getBankAccount, listStatementLines } from '@/app/actions/bank';
import { listCustomers } from '@/app/actions/invoicing';
import { StatementImport } from '@/components/accounting/statement-import';
import { AutoMatchButton, StatementLineActions } from '@/components/accounting/statement-line-actions';
import { PageNav } from '@/components/page-nav';
import { getT } from '@/lib/i18n/server';
import { parsePage } from '@/lib/pagination';
import { cn } from '@/lib/utils';

const TABS = ['UNMATCHED', 'MATCHED', 'IGNORED', 'all'] as const;

export default async function BankAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const account = await getBankAccount(id);
  if (!account) notFound();
  const status = query.status === 'all' ? 'all' : TABS.includes(query.status as (typeof TABS)[number]) ? query.status! : 'UNMATCHED';
  const [{ t, format }, data, customers, suppliers] = await Promise.all([
    getT(),
    listStatementLines(id, { page: parsePage(query.page), status: status === 'all' ? null : status }),
    listCustomers(false).catch(() => []),
    getSuppliers(false).catch(() => []),
  ]);
  const { stats } = data.meta;
  const parties = (list: { id: string; name: string }[]) => list.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-5">
      <Link href="/accounting/bank" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('accounting.bank.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{account.name}</h2>
          <p className="text-sm text-slate-500">
            <span className="font-mono">{account.account}</span>
            {account.bank_name ? ` · ${account.bank_name}` : ''}
            {account.account_number ? ` · ${account.account_number}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatementImport bankAccountId={account.id} accountName={account.name} />
          <AutoMatchButton bankAccountId={account.id} />
          <Link href={`/accounting/bank/${account.id}/report`} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 text-sm font-medium text-slate-200 hover:bg-slate-700">
            <Scale className="h-4 w-4" aria-hidden /> {t('accounting.bank.report.title')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">{t('accounting.bank.stats.unmatched')}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums', stats.unmatched ? 'text-amber-300' : 'text-emerald-300')}>{stats.unmatched}</p>
          <p className="text-xs text-slate-500">{t('accounting.bank.stats.matched', { count: stats.matched })}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">{t('accounting.bank.stats.unmatchedIn')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">{format.money(stats.unmatchedIn)}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">{t('accounting.bank.stats.unmatchedOut')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-300">{format.money(stats.unmatchedOut)}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1" aria-label={t('accounting.bank.title')}>
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/accounting/bank/${account.id}?status=${tab}`}
            aria-current={status === tab ? 'page' : undefined}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', status === tab ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200')}
          >
            {t(`accounting.bank.tabs.${tab}`)}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('accounting.bank.columns.date')}</th>
              <th className="px-4 py-3">{t('accounting.bank.columns.label')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.bank.columns.amount')}</th>
              <th className="px-4 py-3">{t('accounting.bank.columns.match')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  {stats.unmatched + stats.matched + stats.ignored === 0 ? t('accounting.bank.noLines') : t('accounting.bank.noLinesFiltered')}
                </td>
              </tr>
            ) : (
              data.items.map((line) => (
                <tr key={line.id} className={cn('text-slate-200', line.status === 'IGNORED' && 'opacity-60')}>
                  <td className="whitespace-nowrap px-4 py-3">{format.date(line.value_date)}</td>
                  <td className="px-4 py-3">
                    {line.label}
                    {line.reference && <p className="text-xs text-slate-500">{line.reference}</p>}
                  </td>
                  <td className={cn('whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums', line.amount > 0 ? 'text-emerald-300' : 'text-red-300')}>
                    {format.money(line.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {line.match ? (
                      <span className="text-emerald-300">
                        {line.match.count > 1
                          ? t('accounting.bank.matchedMany', { number: line.match.entryNumber, date: format.date(line.match.entryDate), count: line.match.count - 1 })
                          : t('accounting.bank.matchedWith', { number: line.match.entryNumber, date: format.date(line.match.entryDate) })}
                        <span className="block max-w-xs truncate text-slate-500">{line.match.entryLabel}</span>
                      </span>
                    ) : line.status === 'IGNORED' ? (
                      <span className="text-slate-500">{t('accounting.bank.tabs.IGNORED')}</span>
                    ) : (
                      <span className="text-amber-300">{t('accounting.bank.tabs.UNMATCHED')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatementLineActions line={line} customers={parties(customers)} suppliers={parties(suppliers)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PageNav meta={data.meta} />
    </div>
  );
}
