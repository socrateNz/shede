import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccountingScope } from '@/app/actions/accounting';
import { listCustomers } from '@/app/actions/invoicing';
import { CustomerDialog, CustomerToggle } from '@/components/accounting/customer-dialog';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function CustomersPage() {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const { t, format } = await getT();
  const customers = await listCustomers(true).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{t('accounting.customers.title')}</h2>
          <p className="text-sm text-slate-400">{t('accounting.customers.subtitle')}</p>
        </div>
        <CustomerDialog />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('accounting.customers.name')}</th>
              <th className="px-4 py-3">{t('accounting.customers.phone')}</th>
              <th className="px-4 py-3">{t('accounting.customers.niu')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.customers.paymentTerms')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.customers.outstanding')}</th>
              <th className="px-4 py-3">{t('accounting.customers.status')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.customers.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  {t('accounting.customers.empty')}
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className={cn('text-slate-200', !c.is_active && 'opacity-60')}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/accounting/invoices?q=${encodeURIComponent(c.name)}`} className="hover:text-emerald-300">
                      {c.name}
                    </Link>
                    {(c.contact_name || c.city) && <p className="text-xs text-slate-500">{[c.contact_name, c.city].filter(Boolean).join(' · ')}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ?? '—'}
                    {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.niu ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t('accounting.customers.paymentTermsShort', { days: c.payment_terms_days })}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.outstanding > 0 ? format.money(c.outstanding) : '—'}
                    {c.overdue > 0 && (
                      <p className="text-xs font-semibold text-red-300">
                        {t('accounting.customers.overdue')} : {format.money(c.overdue)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.is_active ? t('accounting.customers.active') : t('accounting.customers.inactive')}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <CustomerDialog customer={c} />
                      <CustomerToggle id={c.id} isActive={c.is_active} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
