import Link from 'next/link';
import { PartyPopper } from 'lucide-react';
import { requireModule } from '@/app/actions/auth';
import { getProductionPlan } from '@/app/actions/planning';
import { PrintButton } from '@/components/planning/print-button';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type Station = 'CUISINE' | 'BAR';

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ day?: string; station?: string }> }) {
  await requireModule('PREVISIONS');
  const { t, format } = await getT();
  const params = await searchParams;
  const dayOffset = params.day === '1' ? 1 : 0;
  const plan = await getProductionPlan(dayOffset);
  if (!plan || !plan.installed) {
    return <p className="m-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('planning.production.notInstalled')}</p>;
  }

  // Poste imposé pour la cuisine et le bar ; choix libre pour les responsables
  const requested = params.station === 'CUISINE' || params.station === 'BAR' ? (params.station as Station) : null;
  const station: Station | null = plan.station ?? requested;
  const lines = station ? plan.lines.filter((l) => l.destination === station) : plan.lines;
  const isToday = dayOffset === 0;
  const link = (changes: { day?: number; station?: Station | null }) => {
    const day = changes.day ?? dayOffset;
    const st = changes.station === undefined ? station : changes.station;
    return `/production?day=${day}${st && !plan.station ? `&station=${st}` : ''}`;
  };
  const tab = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium ${active ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200' : 'border-slate-600 text-slate-300 hover:border-slate-500'}`;
  const n = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 print:bg-white print:p-0 print:text-black">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white print:text-black">
            {t('planning.production.title')} — <span className="capitalize">{format.date(`${plan.date}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </h1>
          <p className="mt-1 text-slate-400">{t('planning.production.subtitle')}</p>
          {plan.event && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-pink-300">
              <PartyPopper className="h-4 w-4" /> {t('planning.production.event', { label: plan.event.label, impact: plan.event.impact })}
            </p>
          )}
          {plan.holiday && !plan.event && <p className="mt-2 text-sm text-amber-300">{t('planning.production.holiday')}</p>}
        </div>
        <PrintButton label={t('planning.production.print')} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href={link({ day: 0 })} className={tab(isToday)}>{t('planning.production.today')}</Link>
        <Link href={link({ day: 1 })} className={tab(!isToday)}>{t('planning.production.tomorrow')}</Link>
        {!plan.station && (
          <>
            <span className="mx-1 w-px bg-slate-700" />
            <Link href={link({ station: null })} className={tab(!station)}>{t('planning.production.all')}</Link>
            <Link href={link({ station: 'CUISINE' })} className={tab(station === 'CUISINE')}>{t('planning.production.station.CUISINE')}</Link>
            <Link href={link({ station: 'BAR' })} className={tab(station === 'BAR')}>{t('planning.production.station.BAR')}</Link>
          </>
        )}
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40 print:border-black print:bg-white">
        {lines.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-400">{t('planning.production.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/60 text-left text-slate-300 print:bg-white print:text-black">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('planning.production.colProduct')}</th>
                  {plan.slots.map((slot) => (
                    <th key={slot.key} className="px-3 py-3 text-right font-semibold">
                      {t(`planning.production.slots.${slot.key}`)}
                      <span className="block text-[10px] font-normal text-slate-500">
                        {t('planning.production.slotHours', { from: slot.from, to: slot.to, share: slot.share })}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-semibold">{t('planning.production.colForecast')}</th>
                  {isToday && <th className="px-3 py-3 text-right font-semibold">{t('planning.production.colSold')}</th>}
                  {isToday && <th className="px-4 py-3 text-right font-semibold">{t('planning.production.colRemaining')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {lines.map((line) => (
                  <tr key={line.product_id}>
                    <td className="px-4 py-2 font-medium text-slate-100 print:text-black">{line.name}</td>
                    {plan.slots.map((slot) => (
                      <td key={slot.key} className="px-3 py-2 text-right tabular-nums text-slate-300 print:text-black">
                        {line.slots[slot.key] ? n(line.slots[slot.key]) : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-white print:text-black">{n(line.forecast)}</td>
                    {isToday && <td className="px-3 py-2 text-right tabular-nums text-slate-400">{n(line.sold)}</td>}
                    {isToday && (
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-indigo-300 print:text-black">
                        {n(Math.max(0, line.forecast - line.sold))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(!station || station === 'CUISINE') && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 print:border-black print:bg-white">
          <p className="font-semibold text-white print:text-black">{t('planning.production.ingredientsTitle')}</p>
          <p className="mb-3 text-xs text-slate-500">{t('planning.production.ingredientsHint')}</p>
          {plan.ingredients.length === 0 ? (
            <p className="text-sm text-slate-400">{t('planning.production.ingredientsEmpty')}</p>
          ) : (
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {plan.ingredients.map((ingredient) => (
                <li key={ingredient.name} className="flex justify-between border-b border-slate-700/40 py-1.5 text-sm">
                  <span className="text-slate-200 print:text-black">{ingredient.name}</span>
                  <span className="tabular-nums text-slate-100 print:text-black">
                    {format.number(ingredient.quantity, { maximumFractionDigits: 2 })} {ingredient.unit ? t(`ingredients.unitShort.${ingredient.unit as 'kg' | 'l' | 'piece'}`) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
