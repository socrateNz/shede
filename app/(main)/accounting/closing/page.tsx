import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { getAccountingScope } from '@/app/actions/accounting';
import { getClosingPreview, getFiscalYears } from '@/app/actions/closing';
import { CloseYearButton, ReopenYearButton } from '@/components/accounting/closing-actions';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function ClosingPage({ searchParams }: { searchParams: Promise<{ end?: string }> }) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const [{ t, format }, years, query] = await Promise.all([getT(), getFiscalYears(), searchParams]);
  if (!years) redirect('/accounting');
  const start = years.current.start;
  // Fin modifiable (premier exercice plus court ou plus long que 12 mois)
  const end = query.end && /^\d{4}-\d{2}-\d{2}$/.test(query.end) && query.end >= start ? query.end : years.current.end;
  const preview = await getClosingPreview(start, end);
  const closed = years.years.filter((y) => y.status === 'CLOSED');
  const warnings = preview?.checks.filter((c) => c.count > 0) ?? [];
  const blocked = warnings.some((c) => c.blocking);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">{t('accounting.closing.title')}</h2>
        <p className="text-sm text-slate-400">{t('accounting.closing.subtitle')}</p>
      </div>

      {preview && (
        <section className="space-y-5 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">{t('accounting.closing.current')}</p>
              <p className="text-lg font-semibold text-slate-50">{t('accounting.closing.period', { from: format.date(start), to: format.date(end) })}</p>
            </div>
            <form className="flex items-end gap-2">
              <label className="text-sm text-slate-300">
                {t('accounting.closing.end')}{' '}
                <input type="date" name="end" min={start} defaultValue={end} className="ml-1 h-9 rounded-md border border-slate-600 bg-slate-900/50 px-2 text-slate-100" />
              </label>
              <button type="submit" className="h-9 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-200 hover:bg-slate-700">
                OK
              </button>
            </form>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-900/40 p-4">
              <dt className="text-sm text-slate-400">{t('accounting.closing.products')}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-50">{format.money(preview.products)}</dd>
            </div>
            <div className="rounded-lg bg-slate-900/40 p-4">
              <dt className="text-sm text-slate-400">{t('accounting.closing.charges')}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-50">{format.money(preview.charges)}</dd>
            </div>
            <div className="rounded-lg bg-slate-900/40 p-4">
              <dt className="text-sm text-slate-400">
                {t('accounting.closing.result')} · {preview.result >= 0 ? t('accounting.closing.profit') : t('accounting.closing.loss')}
              </dt>
              <dd className={cn('mt-1 text-xl font-bold tabular-nums', preview.result >= 0 ? 'text-emerald-300' : 'text-red-300')}>{format.money(preview.result)}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-200">{t('accounting.closing.checks')}</p>
            {warnings.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> {t('accounting.closing.checksOk')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {warnings.map((c) => (
                  <li key={c.key} className={cn('flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm', c.blocking ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300')}>
                    <span className="flex items-center gap-2">
                      <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
                      {t(`accounting.closing.check.${c.key}` as 'accounting.closing.check.drafts', { count: c.count, amount: format.money(c.amount ?? 0) })}
                    </span>
                    <Link href={c.href} className="shrink-0 text-xs font-semibold underline">
                      {t('accounting.closing.fix')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex gap-2 rounded-lg bg-slate-900/40 p-3 text-xs text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t('accounting.closing.explain')}
          </p>
          <div className="flex justify-end">
            <CloseYearButton start={start} end={end} result={preview.result} disabled={blocked} />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">{t('accounting.closing.history')}</h3>
        {closed.length === 0 ? (
          <p className="text-sm text-slate-500">{t('accounting.closing.noHistory')}</p>
        ) : (
          <ul className="divide-y divide-slate-700/60">
            {closed.map((y, i) => (
              <li key={y.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-100">{t('accounting.closing.period', { from: format.date(y.start_date), to: format.date(y.end_date) })}</p>
                  <p className="text-xs text-slate-500">{y.closed_at ? t('accounting.closing.closedOn', { date: format.date(y.closed_at) }) : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('font-semibold tabular-nums', (y.result ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300')}>{format.money(y.result ?? 0)}</span>
                  {i === 0 && scope.role === 'ADMIN' && <ReopenYearButton id={y.id} start={y.start_date} end={y.end_date} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
