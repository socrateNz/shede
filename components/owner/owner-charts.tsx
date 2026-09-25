'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { POINT_COLORS } from '@/lib/chart-colors';

const SURFACE = '#1e293b';
const GRID = '#334155';
const AXIS_TEXT = '#94a3b8';

function formatAmount(value: number, currency: string) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

type SeriesPoint = { id: string; name: string; color: string };

function RevenueTooltip({ active, payload, label, points, currency }: any) {
  if (!active || !payload?.length) return null;
  const rows = (points as SeriesPoint[])
    .map((p) => ({ ...p, value: Number(payload[0]?.payload?.[p.id]) || 0 }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-slate-100">{label}</p>
      {rows.length === 0 ? (
        <p className="text-slate-400">Aucune vente</p>
      ) : (
        <>
          {rows.map((r) => (
            <p key={r.id} className="flex items-center gap-2 text-slate-300">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: r.color }} />
              <span className="flex-1">{r.name}</span>
              <span className="font-medium text-slate-100">{formatAmount(r.value, currency)}</span>
            </p>
          ))}
          {rows.length > 1 && (
            <p className="mt-1 border-t border-slate-700 pt-1 text-right font-semibold text-slate-100">
              Total {formatAmount(total, currency)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** CA par tranche (heure ou jour), empilé par point. */
export function RevenueByPointChart({
  data,
  points,
  currency,
}: {
  data: Record<string, number | string>[];
  points: SeriesPoint[];
  currency: string;
}) {
  return (
    <div>
      {points.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300" aria-label="Légende">
          {points.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </li>
          ))}
        </ul>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={8} />
            <YAxis tickFormatter={formatCompact} tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              content={<RevenueTooltip points={points} currency={currency} />}
            />
            {points.map((p, i) => (
              <Bar
                key={p.id}
                dataKey={p.id}
                name={p.name}
                stackId="revenue"
                fill={p.color}
                stroke={SURFACE}
                strokeWidth={points.length > 1 ? 2 : 0}
                radius={i === points.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PeakTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-100">{label}</p>
      <p className="text-slate-300">{formatAmount(row.revenue, currency)}</p>
      <p className="text-slate-400">{row.orders} commande(s)</p>
    </div>
  );
}

/** Répartition du CA encaissé par heure de la journée. */
export function PeakHoursChart({
  data,
  currency,
}: {
  data: { hour: string; revenue: number; orders: number }[];
  currency: string;
}) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="hour" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
          <YAxis tickFormatter={formatCompact} tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<PeakTooltip currency={currency} />} />
          <Bar dataKey="revenue" fill={POINT_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
