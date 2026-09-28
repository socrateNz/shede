'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presets(today: Date) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const quarterStart = new Date(y, Math.floor(m / 3) * 3, 1);
  return {
    thisMonth: [iso(new Date(y, m, 1)), iso(today)],
    lastMonth: [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))],
    thisQuarter: [iso(quarterStart), iso(today)],
    thisYear: [iso(new Date(y, 0, 1)), iso(today)],
  } as const;
}

/** Choix de la période (paramètres `from` / `to` de l'URL). */
export function PeriodFilter({ from, to }: { from: string; to: string }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', nextFrom);
    params.set('to', nextTo);
    setStart(nextFrom);
    setEnd(nextTo);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const ranges = presets(new Date());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(ranges) as (keyof typeof ranges)[]).map((key) => {
          const [a, b] = ranges[key];
          const active = a === from && b === to;
          return (
            <button
              key={key}
              type="button"
              onClick={() => apply(a, b)}
              className={
                active
                  ? 'rounded-full border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs text-white'
                  : 'rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800'
              }
            >
              {t(`accounting.filters.${key}`)}
            </button>
          );
        })}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (start && end && start <= end) apply(start, end);
        }}
      >
        <label className="text-xs text-slate-400">
          {t('accounting.filters.from')}
          <Input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="mt-1 h-9 w-40 border-slate-600 bg-slate-900/50 text-slate-100 [color-scheme:dark]" />
        </label>
        <label className="text-xs text-slate-400">
          {t('accounting.filters.to')}
          <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-9 w-40 border-slate-600 bg-slate-900/50 text-slate-100 [color-scheme:dark]" />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-9 border-slate-600 text-slate-200 hover:bg-slate-700">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
          <span className="ml-1.5">{t('accounting.filters.apply')}</span>
        </Button>
      </form>
    </div>
  );
}
