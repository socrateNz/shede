import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccountingScope } from '@/app/actions/accounting';
import { listFixedAssets } from '@/app/actions/closing';
import { AssetDialog, DepreciationButton } from '@/components/accounting/asset-dialog';
import { accountingDate } from '@/lib/accounting/posting';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const { asOf } = await searchParams;
  const [{ t, format }, data] = await Promise.all([getT(), listFixedAssets(asOf)]);
  if (!data) redirect('/accounting');
  const today = accountingDate();
  const total = (key: 'cost' | 'cumulative' | 'netBookValue' | 'pending') => data.assets.reduce((s, a) => s + Number(a[key]), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{t('accounting.assets.title')}</h2>
          <p className="text-sm text-slate-400">{t('accounting.assets.subtitle')}</p>
        </div>
        <AssetDialog today={today} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t('accounting.assets.totals.cost'), value: total('cost') },
          { label: t('accounting.assets.totals.cumulative'), value: total('cumulative') },
          { label: t('accounting.assets.totals.nbv'), value: total('netBookValue') },
          { label: t('accounting.assets.totals.pending'), value: data.pendingTotal, tone: data.pendingTotal > 0 ? 'text-amber-300' : 'text-emerald-300' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className={cn('mt-1 text-xl font-bold tabular-nums', card.tone ?? 'text-slate-50')}>{format.money(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2">
          <label className="text-sm text-slate-300">
            {t('accounting.assets.asOf')}{' '}
            <input type="date" name="asOf" defaultValue={data.asOf} className="ml-1 h-9 rounded-md border border-slate-600 bg-slate-900/50 px-2 text-slate-100" />
          </label>
          <button type="submit" className="h-9 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-200 hover:bg-slate-700">
            OK
          </button>
        </form>
        <DepreciationButton asOf={data.asOf} pendingTotal={data.pendingTotal} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('accounting.assets.columns.name')}</th>
              <th className="px-4 py-3">{t('accounting.assets.columns.inService')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.assets.columns.cost')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.assets.columns.cumulative')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.assets.columns.nbv')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.assets.columns.pending')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {data.assets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  {t('accounting.assets.empty')}
                </td>
              </tr>
            ) : (
              data.assets.map((a) => (
                <tr key={a.id} className="text-slate-200">
                  <td className="px-4 py-3">
                    <Link href={`/accounting/assets/${a.id}`} className="font-medium hover:text-emerald-300">
                      {a.name}
                    </Link>
                    <p className="text-xs text-slate-500">{t(`accounting.assets.categories.${a.category}`)}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{format.date(a.in_service_date)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{format.money(a.cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{format.money(a.cumulative)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{format.money(a.netBookValue)}</td>
                  <td className={cn('px-4 py-3 text-right tabular-nums', a.pending > 0 ? 'text-amber-300' : 'text-slate-500')}>{a.pending > 0 ? format.money(a.pending) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <AssetDialog asset={a} today={today} locked={a.posted > 0} />
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
