import { redirect } from 'next/navigation';

import { getAccountingScope } from '@/app/actions/accounting';
import { AccountingTabs } from '@/components/accounting/accounting-tabs';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('accounting.meta.title'), description: t('accounting.meta.description') };
}

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  const scope = await getAccountingScope();
  if (!scope) redirect('/unauthorized?error=module_required&module=COMPTABILITE');
  const { t } = await getT();

  const tabs = [
    { href: '/accounting', label: t('accounting.nav.dashboard'), show: scope.canReports },
    { href: '/accounting/expenses', label: t('accounting.nav.expenses'), show: scope.canExpense },
    { href: '/accounting/suppliers', label: t('accounting.nav.suppliers'), show: scope.canExpense },
    { href: '/accounting/journal', label: t('accounting.nav.journal'), show: scope.canReports },
    { href: '/accounting/ledger', label: t('accounting.nav.ledger'), show: scope.canReports },
    { href: '/accounting/balance', label: t('accounting.nav.balance'), show: scope.canReports },
    { href: '/accounting/statements', label: t('accounting.nav.statements'), show: scope.canReports },
    { href: '/accounting/vat', label: t('accounting.nav.vat'), show: scope.canReports },
    { href: '/accounting/accounts', label: t('accounting.nav.accounts'), show: true },
  ].filter((tab) => tab.show);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('accounting.header.title')}</h1>
          <p className="mt-1 text-slate-400">{t('accounting.header.subtitle')}</p>
        </div>
        <AccountingTabs items={tabs} />
        {children}
      </div>
    </div>
  );
}
