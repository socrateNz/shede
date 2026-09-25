import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Clock,
  Coins,
  CreditCard,
  Hotel,
  Minus,
  Percent,
  Receipt,
  ShoppingCart,
  Trophy,
  Wallet,
  XCircle,
} from 'lucide-react';
import { requireRole } from '@/app/actions/auth';
import { getOwnerDashboard, type OwnerDashboard } from '@/app/actions/owner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PeakHoursChart, RevenueByPointChart } from '@/components/owner/owner-charts';
import { pointColor } from '@/lib/chart-colors';
import { OwnerExportButton } from '@/components/owner/owner-export-button';
import { cn } from '@/lib/utils';

const RANGE_OPTIONS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
  CHEQUE: 'Chèque',
  TRANSFER: 'Virement',
  MOBILE: 'Mobile Money',
  AUTRE: 'Autre',
};

function money(value: number, currency: string) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

function percent(value: number) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value * 100)} %`;
}

/** Évolution vs période précédente : icône + texte, jamais la couleur seule. */
function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) {
    return <span className="text-xs text-slate-400">{current > 0 ? 'Pas de base de comparaison' : '—'}</span>;
  }
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Minus className="h-3 w-3" /> Stable
      </span>
    );
  }
  const good = invert ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', good ? 'text-emerald-400' : 'text-red-400')}>
      <Icon className="h-3.5 w-3.5" />
      {change > 0 ? '+' : ''}
      {percent(change)}
      <span className="font-normal text-slate-500">vs période préc.</span>
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </div>
      <p className="text-2xl font-bold text-slate-50">{value}</p>
      <div className="mt-1 min-h-4">{children}</div>
    </div>
  );
}

/** Barres de proportion (une seule teinte, magnitude). */
function ShareBars({ rows, currency }: { rows: { label: string; amount: number; hint?: string }[]; currency: string }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (rows.length === 0 || total === 0) {
    return <p className="text-sm text-slate-500">Aucune donnée sur la période.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const share = row.amount / total;
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-200">
                {row.label}
                {row.hint && <span className="ml-1 text-xs text-slate-500">{row.hint}</span>}
              </span>
              <span className="whitespace-nowrap text-slate-300">
                {money(row.amount, currency)} <span className="text-xs text-slate-500">· {percent(share)}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/60">
              <div className="h-2 rounded-full bg-[#3987e5]" style={{ width: `${Math.max(share * 100, 1)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function buildHref(params: { range: string; point?: string | null }) {
  const search = new URLSearchParams({ range: params.range });
  if (params.point) search.set('point', params.point);
  return `/organization?${search.toString()}`;
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-blue-500 bg-blue-600 text-white'
          : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
      )}
    >
      {children}
    </Link>
  );
}

function buildExportSheets(data: Extract<OwnerDashboard, { empty: false }>) {
  const c = data.currency;
  return {
    'Points': data.perPoint.map((p) => ({
      Point: p.name,
      [`CA (${c})`]: Math.round(p.revenue),
      [`CA période préc. (${c})`]: Math.round(p.previousRevenue),
      [`Restauration (${c})`]: Math.round(p.orderRevenue),
      [`Hébergement (${c})`]: Math.round(p.hotelRevenue),
      'Part du CA (%)': Math.round(p.share * 1000) / 10,
      Commandes: p.orders,
      [`Ticket moyen (${c})`]: Math.round(p.avgTicket),
      [`Écart de caisse (${c})`]: Math.round(p.cashDifference),
      'Articles en stock bas': p.lowStock,
    })),
    'Top produits': data.topProducts.map((p) => ({
      Produit: p.name,
      Quantité: p.quantity,
      [`CA (${c})`]: Math.round(p.revenue),
    })),
    'Paiements': data.paymentMethods.map((p) => ({
      'Moyen de paiement': PAYMENT_LABELS[p.method] ?? p.method,
      [`Montant (${c})`]: Math.round(p.amount),
    })),
    'Évolution': data.series.map((row) => {
      const line: Record<string, string | number> = { Période: String(row.label) };
      for (const p of data.scopePoints) line[p.name] = Math.round(Number(row[p.id]) || 0);
      return line;
    }),
  };
}

export default async function OwnerViewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; point?: string }>;
}) {
  await requireRole('ORG_ADMIN');
  const params = await searchParams;
  const data = await getOwnerDashboard({ range: params.range, pointId: params.point });
  if (!data) redirect('/login');

  const { currency } = data;
  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === data.range)?.label ?? '';
  // Couleur fixée par l'ordre des points dans l'organisation (jamais par le filtre ni le rang).
  const colorOf = new Map(data.points.map((p, i) => [p.id, pointColor(i)]));

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Vue propriétaire</span>
            </div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">{data.organization.name}</h1>
            <p className="mt-1 text-slate-400">
              {data.pointId ? data.points.find((p) => p.id === data.pointId)?.name : 'Tous les points'} · {rangeLabel} (du{' '}
              {new Date(data.period.start).toLocaleDateString('fr-FR')} au {new Date(data.period.end).toLocaleDateString('fr-FR')})
            </p>
          </div>
          {!data.empty && (
            <OwnerExportButton
              sheets={buildExportSheets(data)}
              filename={`rapport-${data.organization.name.replace(/\s+/g, '-').toLowerCase()}-${data.range}`}
            />
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Période">
            {RANGE_OPTIONS.map((r) => (
              <FilterChip key={r.value} href={buildHref({ range: r.value, point: data.pointId })} active={data.range === r.value}>
                {r.label}
              </FilterChip>
            ))}
          </div>
          {data.points.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Point">
              <FilterChip href={buildHref({ range: data.range })} active={!data.pointId}>
                Tous les points
              </FilterChip>
              {data.points.map((p) => (
                <FilterChip key={p.id} href={buildHref({ range: data.range, point: p.id })} active={data.pointId === p.id}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: colorOf.get(p.id) }} />
                  {p.name}
                </FilterChip>
              ))}
            </div>
          )}
        </div>

        {data.mixedCurrencies && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Vos points n&apos;utilisent pas tous la même devise : les totaux consolidés sont affichés en {currency}.
          </p>
        )}

        {data.empty ? (
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardContent className="py-16 text-center text-slate-400">
              <p className="text-lg">Aucun point pour le moment</p>
              <p className="mt-2 text-sm">Créez votre premier point pour suivre son activité ici.</p>
              <Link href="/organization/points/new">
                <Button className="mt-6 bg-blue-600 text-white hover:bg-blue-700">Créer un point</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Indicateurs clés */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi icon={Wallet} label="Chiffre d'affaires" value={money(data.kpis.revenue, currency)}>
                <Delta current={data.kpis.revenue} previous={data.kpis.previousRevenue} />
              </Kpi>
              <Kpi icon={ShoppingCart} label="Commandes encaissées" value={String(data.kpis.ordersCount)}>
                <Delta current={data.kpis.ordersCount} previous={data.kpis.previousOrdersCount} />
              </Kpi>
              <Kpi icon={Receipt} label="Ticket moyen" value={money(data.kpis.avgTicket, currency)}>
                <Delta current={data.kpis.avgTicket} previous={data.kpis.previousAvgTicket} />
              </Kpi>
              <Kpi icon={Hotel} label="Hébergement" value={money(data.kpis.hotelRevenue, currency)}>
                <span className="text-xs text-slate-400">{data.kpis.bookingsCount} réservation(s) payée(s)</span>
              </Kpi>
              <Kpi icon={Percent} label="Remises accordées" value={money(data.kpis.discounts, currency)}>
                <span className="text-xs text-slate-400">
                  {data.kpis.orderRevenue > 0 ? `${percent(data.kpis.discounts / (data.kpis.orderRevenue + data.kpis.discounts))} des ventes brutes` : '—'}
                </span>
              </Kpi>
              <Kpi icon={Coins} label="Pourboires" value={money(data.kpis.tips, currency)} />
              <Kpi icon={XCircle} label="Commandes annulées" value={String(data.kpis.cancelledCount)} />
              <Kpi icon={Wallet} label="Écart de caisse (sessions clôturées)" value={money(data.cash.difference, currency)}>
                <span className={cn('text-xs', data.cash.negativeCount > 0 ? 'text-red-400' : 'text-slate-400')}>
                  {data.cash.negativeCount > 0 && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                  {data.cash.negativeCount} session(s) en manque sur {data.cash.closedCount}
                </span>
              </Kpi>
            </div>

            {/* En direct */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                <ShoppingCart className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-400">Commandes en cours</p>
                  <p className="text-xl font-semibold text-slate-50">{data.activeOrdersCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                <CreditCard className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-400">Caisses ouvertes</p>
                  <p className="text-xl font-semibold text-slate-50">{data.cash.open.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                <Boxes className={cn('h-5 w-5', data.lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400')} />
                <div>
                  <p className="text-sm text-slate-400">Articles en stock bas</p>
                  <p className="text-xl font-semibold text-slate-50">{data.lowStockCount}</p>
                </div>
              </div>
            </div>

            {/* Évolution du CA */}
            <Card className="border-slate-700/50 bg-slate-800/50">
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="text-slate-50">
                  Évolution du chiffre d&apos;affaires {data.range === 'today' ? 'par heure' : 'par jour'}
                  {data.scopePoints.length > 1 ? ' et par point' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <RevenueByPointChart
                  data={data.series}
                  points={data.scopePoints.map((p) => ({ ...p, color: colorOf.get(p.id) ?? pointColor(0) }))}
                  currency={currency}
                />
              </CardContent>
            </Card>

            {/* Comparatif des points */}
            <Card className="border-slate-700/50 bg-slate-800/50">
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="text-slate-50">Comparatif des points</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-400">
                      <th className="px-4 py-3 font-medium">Point</th>
                      <th className="px-4 py-3 text-right font-medium">CA</th>
                      <th className="px-4 py-3 font-medium">Évolution</th>
                      <th className="px-4 py-3 text-right font-medium">Part</th>
                      <th className="px-4 py-3 text-right font-medium">Commandes</th>
                      <th className="px-4 py-3 text-right font-medium">Ticket moyen</th>
                      <th className="px-4 py-3 text-right font-medium">En cours</th>
                      <th className="px-4 py-3 text-right font-medium">Caisses ouvertes</th>
                      <th className="px-4 py-3 text-right font-medium">Écart caisse</th>
                      <th className="px-4 py-3 text-right font-medium">Stock bas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.perPoint]
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((p) => (
                        <tr key={p.id} className="border-b border-slate-700/50 last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf.get(p.id) }} />
                              <span className="font-medium text-slate-100">{p.name}</span>
                              {!p.isActive && <span className="text-xs text-red-400">(désactivé)</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-100">{money(p.revenue, currency)}</td>
                          <td className="px-4 py-3">
                            <Delta current={p.revenue} previous={p.previousRevenue} />
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{percent(p.share)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{p.orders}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{money(p.avgTicket, currency)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{p.activeOrders}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{p.openShifts}</td>
                          <td className={cn('px-4 py-3 text-right', p.cashDifference < 0 ? 'text-red-400' : 'text-slate-300')}>
                            {p.cashDifference > 0 ? '+' : ''}
                            {money(p.cashDifference, currency)}
                          </td>
                          <td className={cn('px-4 py-3 text-right', p.lowStock > 0 ? 'text-amber-400' : 'text-slate-300')}>
                            {p.lowStock}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Heures de pointe + paiements / canaux */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="border-slate-700/50 bg-slate-800/50">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="flex items-center gap-2 text-slate-50">
                    <Clock className="h-5 w-5 text-slate-400" />
                    Heures de pointe
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <PeakHoursChart data={data.byHour} currency={currency} />
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-slate-800/50">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50">Encaissements</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-300">Par moyen de paiement</p>
                    <ShareBars
                      currency={currency}
                      rows={data.paymentMethods.map((p) => ({ label: PAYMENT_LABELS[p.method] ?? p.method, amount: p.amount }))}
                    />
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-300">Par canal de vente</p>
                    <ShareBars
                      currency={currency}
                      rows={data.channels.map((ch) => ({ label: ch.name, amount: ch.amount, hint: `(${ch.count})` }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top produits + caisses */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="border-slate-700/50 bg-slate-800/50">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="flex items-center gap-2 text-slate-50">
                    <Trophy className="h-5 w-5 text-slate-400" />
                    Meilleures ventes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.topProducts.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">Aucune vente sur la période.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-slate-400">
                          <th className="px-4 py-3 font-medium">#</th>
                          <th className="px-4 py-3 font-medium">Produit</th>
                          <th className="px-4 py-3 text-right font-medium">Quantité</th>
                          <th className="px-4 py-3 text-right font-medium">CA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((p, i) => (
                          <tr key={p.name} className="border-b border-slate-700/50 last:border-0">
                            <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                            <td className="px-4 py-2.5 text-slate-100">{p.name}</td>
                            <td className="px-4 py-2.5 text-right text-slate-300">{p.quantity}</td>
                            <td className="px-4 py-2.5 text-right text-slate-100">{money(p.revenue, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-slate-800/50">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-700/50">
                  <CardTitle className="flex items-center gap-2 text-slate-50">
                    <CreditCard className="h-5 w-5 text-slate-400" />
                    Caisses
                  </CardTitle>
                  <Link
                    href={data.pointId ? `/organization/cash?point=${data.pointId}` : '/organization/cash'}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Rapports de caisse →
                  </Link>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">Attendu</p>
                      <p className="font-semibold text-slate-100">{money(data.cash.expected, currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Compté</p>
                      <p className="font-semibold text-slate-100">{money(data.cash.actual, currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Écart</p>
                      <p className={cn('font-semibold', data.cash.difference < 0 ? 'text-red-400' : 'text-slate-100')}>
                        {data.cash.difference > 0 ? '+' : ''}
                        {money(data.cash.difference, currency)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-300">Sessions ouvertes en ce moment</p>
                    {data.cash.open.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucune caisse ouverte.</p>
                    ) : (
                      <ul className="divide-y divide-slate-700/60 rounded-lg border border-slate-700/60">
                        {data.cash.open.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate text-slate-100">{s.cashier}</p>
                              <p className="truncate text-xs text-slate-500">{s.point}</p>
                            </div>
                            <div className="text-right text-xs text-slate-400">
                              <p>Depuis {new Date(s.openedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                              <p>Fond : {money(s.openingBalance, currency)}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stock bas */}
            {data.lowStock.length > 0 && (
              <Card className="border-slate-700/50 bg-slate-800/50">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="flex items-center gap-2 text-slate-50">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    Alertes de stock ({data.lowStockCount})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-slate-400">
                        <th className="px-4 py-3 font-medium">Article</th>
                        <th className="px-4 py-3 font-medium">Point</th>
                        <th className="px-4 py-3 text-right font-medium">Quantité</th>
                        <th className="px-4 py-3 text-right font-medium">Seuil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowStock.map((s) => (
                        <tr key={s.id} className="border-b border-slate-700/50 last:border-0">
                          <td className="px-4 py-2.5 text-slate-100">{s.name}</td>
                          <td className="px-4 py-2.5 text-slate-300">{s.point}</td>
                          <td className={cn('px-4 py-2.5 text-right font-medium', s.quantity <= 0 ? 'text-red-400' : 'text-amber-400')}>
                            {s.quantity <= 0 ? 'Rupture' : s.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-400">{s.threshold}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.lowStockCount > data.lowStock.length && (
                    <p className="border-t border-slate-700/50 px-4 py-2 text-xs text-slate-500">
                      {data.lowStockCount - data.lowStock.length} autre(s) article(s) en stock bas (seuls les 20 plus urgents sont affichés).
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
