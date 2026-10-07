import Link from 'next/link';
import { PERIOD_KEYS, type PeriodKey } from '@/lib/periods';

/** Choix de la période d'un rapport (liens ?period=…). */
export function PeriodTabs({ basePath, current, labels }: { basePath: string; current: PeriodKey; labels: Record<PeriodKey, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIOD_KEYS.map((key) => (
        <Link
          key={key}
          href={`${basePath}?period=${key}`}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            current === key ? 'border-teal-500 bg-teal-500/20 text-teal-200' : 'border-slate-600 text-slate-300 hover:border-slate-500'
          }`}
        >
          {labels[key]}
        </Link>
      ))}
    </div>
  );
}
