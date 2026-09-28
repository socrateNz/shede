import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getChartOfAccounts } from '@/app/actions/accounting';
import { EntryForm } from '@/components/accounting/entry-form';
import { getT } from '@/lib/i18n/server';

export default async function NewEntryPage() {
  const data = await getChartOfAccounts();
  if (!data?.scope.canPost) redirect('/accounting/journal');
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/journal" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400">
          <ArrowLeft className="h-4 w-4" />
          {t('accounting.newEntry.back')}
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">{t('accounting.newEntry.title')}</h2>
        <p className="text-sm text-slate-400">{t('accounting.newEntry.subtitle')}</p>
      </div>
      <EntryForm chart={data.chart} />
    </div>
  );
}
