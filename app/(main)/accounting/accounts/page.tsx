import { redirect } from 'next/navigation';
import { getChartOfAccounts } from '@/app/actions/accounting';
import { AccountForm } from '@/components/accounting/account-form';
import { getT } from '@/lib/i18n/server';

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export default async function AccountsPage() {
  const data = await getChartOfAccounts();
  if (!data) redirect('/unauthorized');
  const { t } = await getT();
  const { scope, chart } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">{t('accounting.accounts.title')}</h2>
        <p className="text-sm text-slate-400">{t('accounting.accounts.subtitle')}</p>
      </div>
      {scope.canPost && <AccountForm />}

      <div className="grid gap-4 lg:grid-cols-2">
        {CLASSES.map((cls) => {
          const accounts = chart.filter((a) => a.number.startsWith(cls));
          if (!accounts.length) return null;
          return (
            <section key={cls} className="rounded-xl border border-slate-700/50 bg-slate-800/50">
              <h3 className="border-b border-slate-700/60 px-4 py-3 font-semibold text-slate-100">
                {t('accounting.accounts.class', { number: cls })} — {t(`accounting.accounts.classes.${cls}`)}
              </h3>
              <ul className="divide-y divide-slate-700/40">
                {accounts.map((a) => (
                  <li key={a.number} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-16 font-mono text-slate-100" style={{ paddingLeft: `${(a.number.length - 3) * 0.5}rem` }}>
                      {a.number}
                    </span>
                    <span className="flex-1 text-slate-300">{a.label}</span>
                    {a.custom && (
                      <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-300">
                        {t('accounting.accounts.custom')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
