'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Info, Loader2, PartyPopper, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteForecastEvent, saveForecastEvent } from '@/app/actions/forecasts';
import type { AccuracyDay, DayForecast, ForecastEvent, ForecastProduct } from '@/lib/forecast';
import { useT } from '@/lib/i18n/client';

const TOP_PRODUCTS = 15;
type HolidayKey = 'newYear' | 'youthDay' | 'goodFriday' | 'labourDay' | 'nationalDay' | 'ascension' | 'assumption' | 'christmas';

/** Prévisions des 7 prochains jours, fiabilité mesurée et événements. */
export function ForecastsDashboard({
  today,
  days,
  products,
  events,
  trend,
  openDays,
  accuracy,
  todayActual,
}: {
  today: string;
  days: DayForecast[];
  products: ForecastProduct[];
  events: (ForecastEvent & { id: string })[];
  trend: number;
  openDays: number;
  accuracy: { accuracy: number | null; days: AccuracyDay[] };
  todayActual: { revenue: number; byProduct: Record<string, number> };
}) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: today, label: '', impact: '30' });

  // Produits classés par volume prévu sur la semaine
  const ranked = useMemo(() => {
    const weekly = new Map<string, number>();
    for (const day of days) for (const p of day.products) weekly.set(p.product_id, (weekly.get(p.product_id) ?? 0) + p.quantity);
    return products.filter((p) => (weekly.get(p.id) ?? 0) > 0).sort((a, b) => (weekly.get(b.id) ?? 0) - (weekly.get(a.id) ?? 0));
  }, [days, products]);
  const visible = showAll ? ranked : ranked.slice(0, TOP_PRODUCTS);
  const quantityOf = (day: DayForecast, productId: string) => day.products.find((p) => p.product_id === productId)?.quantity ?? 0;

  const weekRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const trendPercent = Math.round((trend - 1) * 1000) / 10;
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const dayLabel = (date: string) =>
    date === today ? t('forecasts.today') : format.date(`${date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' });

  function addEvent(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveForecastEvent({ date: eventForm.date, label: eventForm.label, impact: Number(eventForm.impact) });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('forecasts.eventSaved'));
      setDialogOpen(false);
      router.refresh();
    });
  }

  function removeEvent(id: string) {
    startTransition(async () => {
      const result = await deleteForecastEvent(id);
      if (!result.success) toast.error(result.error);
      else {
        toast.success(t('forecasts.eventDeleted'));
        router.refresh();
      }
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2">
          <TrendingUp className="h-4 w-4 text-indigo-300" />
          <span className="text-sm font-medium text-indigo-300">{t('forecasts.badge')}</span>
        </div>
        <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('forecasts.title')}</h1>
        <p className="max-w-3xl text-slate-400">{t('forecasts.subtitle')}</p>
      </div>

      {/* Indicateurs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('forecasts.kpiToday')}</p>
          <p className="mt-1 text-2xl font-bold text-white">{format.money(days[0]?.revenue ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-500">{t('forecasts.kpiTodayActual', { amount: format.money(todayActual.revenue) })}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('forecasts.kpiWeek')}</p>
          <p className="mt-1 text-2xl font-bold text-white">{format.money(weekRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('forecasts.kpiAccuracy')}</p>
          {accuracy.accuracy === null ? (
            <p className="mt-2 text-sm text-slate-500">{t('forecasts.kpiAccuracyEmpty')}</p>
          ) : (
            <p className={`mt-1 text-2xl font-bold ${accuracy.accuracy >= 75 ? 'text-emerald-400' : accuracy.accuracy >= 55 ? 'text-amber-300' : 'text-red-400'}`}>
              {format.number(accuracy.accuracy)} %
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5" title={t('forecasts.trendHint')}>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('forecasts.kpiTrend')}</p>
          <p className={`mt-1 flex items-center gap-1.5 text-2xl font-bold ${trendPercent > 0 ? 'text-emerald-400' : trendPercent < 0 ? 'text-red-400' : 'text-white'}`}>
            {trendPercent > 0 ? <TrendingUp className="h-5 w-5" /> : trendPercent < 0 ? <TrendingDown className="h-5 w-5" /> : null}
            {trendPercent > 0 ? '+' : ''}
            {format.number(trendPercent)} %
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{t('forecasts.trendHint')}</p>
        </div>
      </div>

      {openDays < 7 && <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{t('forecasts.noHistory')}</p>}

      {/* Prévisions par produit et par jour */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/60">
              <tr>
                <th className="sticky left-0 bg-slate-800 px-4 py-3 text-left font-semibold text-slate-300">{t('forecasts.colProduct')}</th>
                {days.map((day) => (
                  <th key={day.date} className={`px-3 py-3 text-right font-semibold ${day.date === today ? 'text-indigo-300' : 'text-slate-300'}`}>
                    <span className="block capitalize">{dayLabel(day.date)}</span>
                    {day.event && (
                      <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-normal text-pink-300" title={day.event.label}>
                        <PartyPopper className="h-3 w-3" /> {day.event.impact > 0 ? '+' : ''}
                        {day.event.impact} %
                      </span>
                    )}
                    {day.holiday && !day.event && (
                      <span className="mt-0.5 block text-[10px] font-normal text-amber-300" title={t('forecasts.holidayHint')}>
                        {t(`forecasts.holidays.${day.holiday as HolidayKey}`)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {visible.map((product) => (
                <tr key={product.id} className="hover:bg-slate-800/50">
                  <td className="sticky left-0 bg-slate-900/80 px-4 py-2 font-medium text-slate-100">{product.name}</td>
                  {days.map((day) => {
                    const qty = quantityOf(day, product.id);
                    const sold = day.date === today ? todayActual.byProduct[product.id] : undefined;
                    return (
                      <td key={day.date} className={`px-3 py-2 text-right tabular-nums ${qty === 0 ? 'text-slate-600' : 'text-slate-100'}`}>
                        {qty === 0 ? '—' : format.number(qty, { maximumFractionDigits: 1 })}
                        {sold !== undefined && <span className="block text-[10px] text-slate-500">{format.number(sold)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-slate-800/70 font-semibold">
                <td className="sticky left-0 bg-slate-800 px-4 py-2 text-slate-300">{t('forecasts.revenue')}</td>
                {days.map((day) => (
                  <td key={day.date} className="px-3 py-2 text-right tabular-nums text-white">{format.money(day.revenue)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {ranked.length > TOP_PRODUCTS && (
          <div className="border-t border-slate-700/50 p-3 text-center">
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-indigo-300 hover:underline">
              {showAll ? t('forecasts.showLess') : t('forecasts.showAll', { count: ranked.length })}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prévu / réalisé */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="font-semibold text-white">{t('forecasts.accuracyTitle')}</p>
          <p className="mb-3 text-xs text-slate-500">{t('forecasts.accuracyHint')}</p>
          {accuracy.days.length === 0 ? (
            <p className="text-sm text-slate-400">{t('forecasts.accuracyEmpty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr>
                  <th className="pb-2 font-medium">{t('forecasts.colDate')}</th>
                  <th className="pb-2 text-right font-medium">{t('forecasts.colForecast')}</th>
                  <th className="pb-2 text-right font-medium">{t('forecasts.colActual')}</th>
                  <th className="pb-2 text-right font-medium">{t('forecasts.colGap')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {accuracy.days.slice(-14).reverse().map((d) => {
                  const gap = d.forecastRevenue > 0 ? Math.round(((d.actualRevenue - d.forecastRevenue) / d.forecastRevenue) * 100) : null;
                  return (
                    <tr key={d.date}>
                      <td className="py-1.5 capitalize text-slate-300">{format.date(`${d.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-300">{format.money(d.forecastRevenue)}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-100">{format.money(d.actualRevenue)}</td>
                      <td className={`py-1.5 text-right tabular-nums ${gap === null ? 'text-slate-500' : Math.abs(gap) <= 15 ? 'text-emerald-400' : 'text-amber-300'}`}>
                        {gap === null ? '—' : `${gap > 0 ? '+' : ''}${gap} %`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Événements */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="font-semibold text-white">{t('forecasts.eventsTitle')}</p>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEventForm({ date: today, label: '', impact: '30' });
                setDialogOpen(true);
              }}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" /> {t('forecasts.addEvent')}
            </Button>
          </div>
          <p className="mb-3 text-xs text-slate-500">{t('forecasts.eventsHint')}</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400">{t('forecasts.eventsEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((event) => (
                <li key={event.id} className="flex items-center gap-3 rounded-lg bg-slate-900/40 px-3 py-2">
                  <span className="w-28 text-sm capitalize text-slate-300">{format.date(`${event.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="flex-1 text-sm text-slate-100">{event.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${event.impact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {event.impact > 0 ? '+' : ''}
                    {event.impact} %
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeEvent(event.id)} disabled={pending} className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10" aria-label={t('forecasts.deleteEvent')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-sm text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong className="text-slate-300">{t('forecasts.methodTitle')} : </strong>
          {t('forecasts.method')}
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !pending && setDialogOpen(open)}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('forecasts.addEvent')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={addEvent} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="ev-date" className="text-sm text-slate-300">{t('forecasts.eventDate')}</label>
                <Input id="ev-date" type="date" value={eventForm.date} min={today} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} required className="border-slate-600 bg-slate-900/50 text-slate-50" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ev-impact" className="text-sm text-slate-300">{t('forecasts.eventImpact')}</label>
                <Input id="ev-impact" type="number" min="-100" max="500" step="5" value={eventForm.impact} onChange={(e) => setEventForm({ ...eventForm, impact: e.target.value })} required className="border-slate-600 bg-slate-900/50 text-slate-50" />
              </div>
            </div>
            <p className="-mt-2 text-xs text-slate-500">{t('forecasts.eventImpactHint')}</p>
            <div className="space-y-1.5">
              <label htmlFor="ev-label" className="text-sm text-slate-300">{t('forecasts.eventLabel')}</label>
              <Input id="ev-label" value={eventForm.label} onChange={(e) => setEventForm({ ...eventForm, label: e.target.value })} maxLength={120} placeholder={t('forecasts.eventLabelPlaceholder')} required className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={pending} className="text-slate-300 hover:bg-slate-700">
                {t('forecasts.cancel')}
              </Button>
              <Button type="submit" disabled={pending || !eventForm.label.trim()} className="bg-indigo-600 text-white hover:bg-indigo-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('forecasts.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
