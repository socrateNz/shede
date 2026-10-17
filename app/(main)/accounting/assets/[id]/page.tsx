import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAccountingScope } from '@/app/actions/accounting';
import { getFixedAsset } from '@/app/actions/closing';
import { accountingDate } from '@/lib/accounting/posting';
import { cumulativeDepreciation } from '@/lib/fixed-assets';
import { getT } from '@/lib/i18n/server';

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const { id } = await params;
  const [{ t, format }, data] = await Promise.all([getT(), getFixedAsset(id)]);
  if (!data) notFound();
  const { asset, schedule, postings } = data;
  const today = accountingDate();
  const cumulative = cumulativeDepreciation(asset, today);

  return (
    <div className="space-y-5">
      <Link href="/accounting/assets" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('accounting.assets.back')}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-slate-50">{asset.name}</h2>
        <p className="text-sm text-slate-400">
          {t(`accounting.assets.categories.${asset.category}`)} · <span className="font-mono">{asset.asset_account}</span>
          {asset.depreciation_account ? <span className="font-mono"> / {asset.depreciation_account}</span> : null}
          {asset.reference ? ` · ${asset.reference}` : ''}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          [t('accounting.assets.acquisitionDate'), format.date(asset.acquisition_date)],
          [t('accounting.assets.inServiceDate'), format.date(asset.in_service_date)],
          [t('accounting.assets.cost'), format.money(asset.cost)],
          [t('accounting.assets.life'), asset.useful_life_months ? String(asset.useful_life_months) : t('accounting.assets.notDepreciable')],
          [t('accounting.assets.columns.nbv'), format.money(Math.round(asset.cost) - cumulative)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">{t('accounting.assets.schedule')}</h3>
          {schedule.length === 0 ? (
            <p className="text-sm text-slate-500">{t('accounting.assets.notDepreciable')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-3">{t('accounting.assets.year')}</th>
                  <th className="py-2 pr-3 text-right">{t('accounting.assets.opening')}</th>
                  <th className="py-2 pr-3 text-right">{t('accounting.assets.depreciation')}</th>
                  <th className="py-2 pr-3 text-right">{t('accounting.assets.cumulativeShort')}</th>
                  <th className="py-2 text-right">{t('accounting.assets.closing')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {schedule.map((r) => (
                  <tr key={r.year}>
                    <td className="py-2 pr-3">{r.year}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{format.money(r.opening)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{format.money(r.depreciation)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{format.money(r.cumulative)}</td>
                    <td className="py-2 text-right tabular-nums">{format.money(r.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">{t('accounting.assets.postings')}</h3>
          {postings.length === 0 ? (
            <p className="text-sm text-slate-500">{t('accounting.assets.noPostings')}</p>
          ) : (
            <ul className="divide-y divide-slate-700/60 text-sm">
              {postings.map((p) => (
                <li key={p.period_end} className="flex justify-between py-2 text-slate-300">
                  <span>{format.date(p.period_end)}</span>
                  <span className="tabular-nums">{format.money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {asset.notes && <p className="mt-4 whitespace-pre-line text-sm text-slate-400">{asset.notes}</p>}
        </section>
      </div>
    </div>
  );
}
