import { redirect } from 'next/navigation';
import { getAccountingScope, getSuppliers } from '@/app/actions/accounting';
import { SupplierDialog, SupplierToggle } from '@/components/accounting/supplier-dialog';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function SuppliersPage() {
  const scope = await getAccountingScope();
  if (!scope?.canExpense) redirect('/accounting');
  const { t } = await getT();
  let suppliers: Awaited<ReturnType<typeof getSuppliers>> = [];
  try {
    suppliers = await getSuppliers(true);
  } catch {
    suppliers = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{t('accounting.suppliers.title')}</h2>
          <p className="text-sm text-slate-400">{t('accounting.suppliers.subtitle')}</p>
        </div>
        <SupplierDialog />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('accounting.suppliers.name')}</th>
              <th className="px-4 py-3">{t('accounting.suppliers.phone')}</th>
              <th className="px-4 py-3">{t('accounting.suppliers.email')}</th>
              <th className="px-4 py-3">{t('accounting.suppliers.niu')}</th>
              <th className="px-4 py-3">{t('accounting.suppliers.status')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.suppliers.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  {t('accounting.suppliers.empty')}
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className={cn('text-slate-200', !s.is_active && 'opacity-60')}>
                  <td className="px-4 py-3 font-medium">
                    {s.name}
                    {s.address && <p className="text-xs text-slate-500">{s.address}</p>}
                  </td>
                  <td className="px-4 py-3">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.niu ?? '—'}</td>
                  <td className="px-4 py-3">
                    {s.is_active ? t('accounting.suppliers.active') : t('accounting.suppliers.inactive')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <SupplierDialog supplier={s} />
                      <SupplierToggle id={s.id} isActive={s.is_active} />
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
