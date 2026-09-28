import { PeriodFilter } from '@/components/accounting/period-filter';
import { PointSelect } from '@/components/owner/point-select';

/** Barre de filtres des états : période, et point de vente pour l'administrateur d'organisation. */
export function FilterBar({
  from,
  to,
  points = [],
  pointId = null,
  children,
}: {
  from: string;
  to: string;
  points?: { id: string; name: string }[];
  pointId?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
      <PeriodFilter from={from} to={to} />
      <div className="flex flex-wrap items-end gap-3">
        {points.length > 0 && <PointSelect points={points} value={pointId} />}
        {children}
      </div>
    </div>
  );
}

/** Message affiché tant que la migration docs/phase12-accounting.sql n'est pas exécutée. */
export function SetupNotice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-amber-200/80">{text}</p>
    </div>
  );
}
