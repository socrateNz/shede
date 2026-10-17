import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { getAccountingScope } from '@/app/actions/accounting';
import { listBankAccounts } from '@/app/actions/bank';
import { BankAccountDialog } from '@/components/accounting/bank-account-dialog';
import { accountingDate } from '@/lib/accounting/posting';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function BankPage() {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const { t, format } = await getT();
  const accounts = await listBankAccounts().catch(() => []);
  const today = accountingDate();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{t('accounting.bank.title')}</h2>
          <p className="text-sm text-slate-400">{t('accounting.bank.subtitle')}</p>
        </div>
        <BankAccountDialog today={today} />
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-12 text-center text-slate-500">{t('accounting.bank.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className={cn('rounded-xl border border-slate-700/50 bg-slate-800/50 p-5', !a.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
                    <Landmark className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{a.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      <span className="font-mono">{a.account}</span>
                      {a.bank_name ? ` · ${a.bank_name}` : ''}
                      {a.account_number ? ` · ${a.account_number}` : ''}
                    </p>
                  </div>
                </div>
                <BankAccountDialog account={a} today={today} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">{t('accounting.bank.bookBalance')}</dt>
                  <dd className="font-bold tabular-nums text-slate-100">{format.money(a.bookBalance)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('accounting.bank.bankBalance')}</dt>
                  <dd className="font-bold tabular-nums text-slate-100">{format.money(a.bankBalance)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <span className={a.unmatched > 0 ? 'font-semibold text-amber-300' : 'text-emerald-300'}>
                  {a.unmatched > 0 ? t('accounting.bank.toReconcile', { count: a.unmatched }) : t('accounting.bank.allReconciled')}
                </span>
                <Link href={`/accounting/bank/${a.id}`} className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700">
                  {t('accounting.bank.open')}
                </Link>
              </div>
              <p className="mt-2 text-xs text-slate-500">{a.lastImport ? t('accounting.bank.lastImport', { date: format.date(a.lastImport) }) : t('accounting.bank.noImport')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
