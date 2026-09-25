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
  Landmark,
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
import { getT } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';

const RANGE_VALUES = ['today', '7', '30', '90'] as const;

type I18n = Awaited<ReturnType<typeof getT>>;

function money(i18n: I18n, value: number, currency: string) {
  return i18n.format.money(value, currency);
}

function percent(i18n: I18n, value: number) {
  return `${i18n.format.number(value * 100, { maximumFractionDigits: 1 })} %`;
}

/** Évolution vs période précédente : icône + texte, jamais la couleur seule. */
function Delta({ i18n, current, previous, invert = false }: { i18n: I18n; current: number; previous: number; invert?: boolean }) {
  const { t } = i18n;
  if (previous === 0) {
    return <span className="text-xs text-slate-400">{current > 0 ? t('org.owner.noComparison') : '—'}</span>;
  }
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Minus className="h-3 w-3" /> {t('org.owner.stable')}
      </span>
    );
  }
  const good = invert ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', good ? 'text-emerald-400' : 'text-red-400')}>
      <Icon className="h-3.5 w-3.5" />
      {change > 0 ? '+' : ''}
      {percent(i18n, change)}
      <span className="font-normal text-slate-500">{t('org.owner.vsPrevious')}</span>
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
function ShareBars({ i18n, rows, currency }: { i18n: I18n; rows: { label: string; amount: number; hint?: string }[]; currency: string }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (rows.length === 0 || total === 0) {
    return <p className="text-sm text-slate-500">{i18n.t('org.owner.noPeriodData')}</p>;
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
                {money(i18n, row.amount, currency)} <span className="text-xs text-slate-500">· {percent(i18n, share)}</span>
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

function paymentLabel(t: I18n['t'], method: string) {
  return method in PAYMENT_METHOD_KEYS ? t(`common.paymentMethods.${method as keyof typeof PAYMENT_METHOD_KEYS}`) : method;
}

const PAYMENT_METHOD_KEYS = { CASH: 1, CARD: 1, CHEQUE: 1, TRANSFER: 1, MOBILE: 1, AUTRE: 1 } as const;

const CHANNEL_KEYS = { DINE_IN: 1, TAKEAWAY: 1, DELIVERY: 1, CLIENT_APP: 1, HOTEL: 1 } as const;

function productName(t: I18n['t'], name: string) {
  return name === '__deleted__' ? t('org.owner.deletedProduct') : name;
}

function buildExportSheets(i18n: I18n, data: Extract<OwnerDashboard, { empty: false }>) {
  const { t } = i18n;
  const currency = data.currency;
  const x = (key: Parameters<I18n['t']>[0]) => t(key, { currency });
  return {
    [t('org.owner.export.sheetPoints')]: data.perPoint.map((p) => ({
      [x('org.owner.export.point')]: p.name,
      [x('org.owner.export.revenue')]: Math.round(p.revenue),
      [x('org.owner.export.previousRevenue')]: Math.round(p.previousRevenue),
      [x('org.owner.export.foodRevenue')]: Math.round(p.orderRevenue),
      [x('org.owner.export.hotelRevenue')]: Math.round(p.hotelRevenue),
      [x('org.owner.export.share')]: Math.round(p.share * 1000) / 10,
      [x('org.owner.export.orders')]: p.orders,
      [x('org.owner.export.avgTicket')]: Math.round(p.avgTicket),
      [x('org.owner.export.cashGap')]: Math.round(p.cashDifference),
      [x('org.owner.export.lowStock')]: p.lowStock,
    })),
    [t('org.owner.export.sheetSummary')]: [
      { [x('org.owner.export.indicator')]: x('org.owner.export.revenueTtc'), [x('org.owner.export.value')]: Math.round(data.kpis.revenue) },
      { [x('org.owner.export.indicator')]: x('org.owner.export.taxIncluded'), [x('org.owner.export.value')]: Math.round(data.kpis.tax) },
      { [x('org.owner.export.indicator')]: x('org.owner.export.discounts'), [x('org.owner.export.value')]: Math.round(data.kpis.discounts) },
      { [x('org.owner.export.indicator')]: x('org.owner.export.tips'), [x('org.owner.export.value')]: Math.round(data.kpis.tips) },
      { [x('org.owner.export.indicator')]: x('org.owner.export.ordersPaid'), [x('org.owner.export.value')]: data.kpis.ordersCount },
      { [x('org.owner.export.indicator')]: x('org.owner.export.ordersCancelled'), [x('org.owner.export.value')]: data.kpis.cancelledCount },
    ],
    [t('org.owner.export.sheetProducts')]: data.topProducts.map((p) => ({
      [x('org.owner.export.product')]: productName(t, p.name),
      [x('org.owner.export.quantity')]: p.quantity,
      [x('org.owner.export.revenue')]: Math.round(p.revenue),
    })),
    [t('org.owner.export.sheetPayments')]: data.paymentMethods.map((p) => ({
      [x('org.owner.export.method')]: paymentLabel(t, p.method),
      [x('org.owner.export.amount')]: Math.round(p.amount),
    })),
    [t('org.owner.export.sheetTrend')]: data.series.map((row) => {
      const line: Record<string, string | number> = { [x('org.owner.export.period')]: String(row.label) };
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
  const i18n = await getT();
  const { t, format } = i18n;
  const params = await searchParams;
  const data = await getOwnerDashboard({ range: params.range, pointId: params.point });
  if (!data) redirect('/login');

  const { currency } = data;
  const rangeLabel = t(`org.owner.ranges.${data.range}` as TranslationKey);
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
              <span className="text-sm font-medium text-blue-400">{t('org.owner.badge')}</span>
            </div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">{data.organization.name}</h1>
            <p className="mt-1 text-slate-400">
              {t('org.owner.periodLine', {
                scope: (data.pointId && data.points.find((p) => p.id === data.pointId)?.name) || t('org.owner.allPoints'),
                range: rangeLabel,
                from: format.date(data.period.start),
                to: format.date(data.period.end),
              })}
            </p>
          </div>
          {!data.empty && (
            <OwnerExportButton
              sheets={buildExportSheets(i18n, data)}
              filename={`rapport-${data.organization.name.replace(/\s+/g, '-').toLowerCase()}-${data.range}`}
            />
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2" aria-label={t('org.owner.rangeAria')}>
            {RANGE_VALUES.map((value) => (
              <FilterChip key={value} href={buildHref({ range: value, point: data.pointId })} active={data.range === value}>
                {t(`org.owner.ranges.${value}`)}
              </FilterChip>
            ))}
          </div>
          {data.points.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label={t('org.owner.pointAria')}>
              <FilterChip href={buildHref({ range: data.range })} active={!data.pointId}>
                {t('org.owner.allPoints')}
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
            {t('org.owner.mixedCurrencies', { currency })}
          </p>
        )}

        {data.empty ? (
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardContent className="py-16 text-center text-slate-400">
              <p className="text-lg">{t('org.owner.emptyTitle')}</p>
              <p className="mt-2 text-sm">{t('org.owner.emptyText')}</p>
              <Link href="/organization/points/new">
                <Button className="mt-6 bg-blue-600 text-white hover:bg-blue-700">{t('org.owner.createPoint')}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Indicateurs clés */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi icon={Wallet} label={t('org.owner.kpi.revenue')} value={money(i18n, data.kpis.revenue, currency)}>
                <Delta i18n={i18n} current={data.kpis.revenue} previous={data.kpis.previousRevenue} />
              </Kpi>
              <Kpi icon={ShoppingCart} label={t('org.owner.kpi.orders')} value={String(data.kpis.ordersCount)}>
                <Delta i18n={i18n} current={data.kpis.ordersCount} previous={data.kpis.previousOrdersCount} />
              </Kpi>
              <Kpi icon={Receipt} label={t('org.owner.kpi.avgTicket')} value={money(i18n, data.kpis.avgTicket, currency)}>
                <Delta i18n={i18n} current={data.kpis.avgTicket} previous={data.kpis.previousAvgTicket} />
              </Kpi>
              <Kpi icon={Hotel} label={t('org.owner.kpi.hotel')} value={money(i18n, data.kpis.hotelRevenue, currency)}>
                <span className="text-xs text-slate-400">{t('org.owner.kpi.paidBookings', { count: data.kpis.bookingsCount })}</span>
              </Kpi>
              <Kpi icon={Percent} label={t('org.owner.kpi.discounts')} value={money(i18n, data.kpis.discounts, currency)}>
                <span className="text-xs text-slate-400">
                  {data.kpis.orderRevenue > 0
                    ? t('org.owner.kpi.discountShare', { share: percent(i18n, data.kpis.discounts / (data.kpis.orderRevenue + data.kpis.discounts)) })
                    : '—'}
                </span>
              </Kpi>
              <Kpi icon={Coins} label={t('org.owner.kpi.tips')} value={money(i18n, data.kpis.tips, currency)} />
              <Kpi icon={Landmark} label={t('org.owner.kpi.tax')} value={money(i18n, data.kpis.tax, currency)}>
                <span className="text-xs text-slate-400">{t('org.owner.kpi.taxHint')}</span>
              </Kpi>
              <Kpi icon={XCircle} label={t('org.owner.kpi.cancelled')} value={String(data.kpis.cancelledCount)} />
              <Kpi icon={Wallet} label={t('org.owner.kpi.cashGap')} value={money(i18n, data.cash.difference, currency)}>
                <span className={cn('text-xs', data.cash.negativeCount > 0 ? 'text-red-400' : 'text-slate-400')}>
                  {data.cash.negativeCount > 0 && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                  {t('org.owner.kpi.shortSessions', { short: data.cash.negativeCount, total: data.cash.closedCount })}
                </span>
              </Kpi>
            </div>

            {/* En direct */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                <ShoppingCart className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-400">{t('org.owner.live.activeOrders')}</p>
                  <p className="text-xl font-semibold text-slate-50">{data.activeOrdersCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                <CreditCard className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-400">{t('org.owner.live.openTills')}</p>
                  <p className="text-xl font-semibold text-slate-50">{data.cash.open.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                <Boxes className={cn('h-5 w-5', data.lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400')} />
                <div>
                  <p className="text-sm text-slate-400">{t('org.owner.live.lowStock')}</p>
                  <p className="text-xl font-semibold text-slate-50">{data.lowStockCount}</p>
                </div>
              </div>
            </div>

            {/* Évolution du CA */}
            <Card className="border-slate-700/50 bg-slate-800/50">
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="text-slate-50">
                  {data.range === 'today' ? t('org.owner.chartTitleHour') : t('org.owner.chartTitleDay')}
                  {data.scopePoints.length > 1 ? t('org.owner.chartByPoint') : ''}
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
                <CardTitle className="text-slate-50">{t('org.owner.comparison.title')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-400">
                      <th className="px-4 py-3 font-medium">{t('org.owner.comparison.point')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.revenue')}</th>
                      <th className="px-4 py-3 font-medium">{t('org.owner.comparison.trend')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.share')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.orders')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.avgTicket')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.active')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.openTills')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.cashGap')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('org.owner.comparison.lowStock')}</th>
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
                              {!p.isActive && <span className="text-xs text-red-400">{t('org.owner.comparison.disabled')}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-100">{money(i18n, p.revenue, currency)}</td>
                          <td className="px-4 py-3">
                            <Delta i18n={i18n} current={p.revenue} previous={p.previousRevenue} />
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{percent(i18n, p.share)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{p.orders}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{money(i18n, p.avgTicket, currency)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{p.activeOrders}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{p.openShifts}</td>
                          <td className={cn('px-4 py-3 text-right', p.cashDifference < 0 ? 'text-red-400' : 'text-slate-300')}>
                            {p.cashDifference > 0 ? '+' : ''}
                            {money(i18n, p.cashDifference, currency)}
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
                    {t('org.owner.peakHours')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <PeakHoursChart data={data.byHour} currency={currency} />
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-slate-800/50">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50">{t('org.owner.payments')}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-300">{t('org.owner.byMethod')}</p>
                    <ShareBars
                      i18n={i18n}
                      currency={currency}
                      rows={data.paymentMethods.map((p) => ({ label: paymentLabel(t, p.method), amount: p.amount }))}
                    />
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-300">{t('org.owner.byChannel')}</p>
                    <ShareBars
                      i18n={i18n}
                      currency={currency}
                      rows={data.channels.map((ch) => ({
                        label: ch.name in CHANNEL_KEYS ? t(`org.owner.channels.${ch.name as keyof typeof CHANNEL_KEYS}`) : ch.name,
                        amount: ch.amount,
                        hint: `(${ch.count})`,
                      }))}
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
                    {t('org.owner.topProducts')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.topProducts.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">{t('org.owner.noSales')}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-slate-400">
                          <th className="px-4 py-3 font-medium">#</th>
                          <th className="px-4 py-3 font-medium">{t('org.owner.product')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('org.owner.quantity')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('org.owner.revenue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((p, i) => (
                          <tr key={p.name} className="border-b border-slate-700/50 last:border-0">
                            <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                            <td className="px-4 py-2.5 text-slate-100">{productName(t, p.name)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-300">{p.quantity}</td>
                            <td className="px-4 py-2.5 text-right text-slate-100">{money(i18n, p.revenue, currency)}</td>
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
                    {t('org.owner.tills')}
                  </CardTitle>
                  <Link
                    href={data.pointId ? `/organization/cash?point=${data.pointId}` : '/organization/cash'}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    {t('org.owner.cashReportsLink')}
                  </Link>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">{t('org.owner.expected')}</p>
                      <p className="font-semibold text-slate-100">{money(i18n, data.cash.expected, currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">{t('org.owner.counted')}</p>
                      <p className="font-semibold text-slate-100">{money(i18n, data.cash.actual, currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">{t('org.owner.gap')}</p>
                      <p className={cn('font-semibold', data.cash.difference < 0 ? 'text-red-400' : 'text-slate-100')}>
                        {data.cash.difference > 0 ? '+' : ''}
                        {money(i18n, data.cash.difference, currency)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-300">{t('org.owner.openNow')}</p>
                    {data.cash.open.length === 0 ? (
                      <p className="text-sm text-slate-500">{t('org.owner.noOpenTill')}</p>
                    ) : (
                      <ul className="divide-y divide-slate-700/60 rounded-lg border border-slate-700/60">
                        {data.cash.open.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate text-slate-100">{s.cashier}</p>
                              <p className="truncate text-xs text-slate-500">{s.point}</p>
                            </div>
                            <div className="text-right text-xs text-slate-400">
                              <p>{t('org.owner.since', { date: format.dateTime(s.openedAt) })}</p>
                              <p>{t('org.owner.float', { amount: money(i18n, s.openingBalance, currency) })}</p>
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
                    {t('org.owner.stockAlerts', { count: data.lowStockCount })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-slate-400">
                        <th className="px-4 py-3 font-medium">{t('org.owner.item')}</th>
                        <th className="px-4 py-3 font-medium">{t('org.owner.comparison.point')}</th>
                        <th className="px-4 py-3 text-right font-medium">{t('org.owner.quantity')}</th>
                        <th className="px-4 py-3 text-right font-medium">{t('org.owner.threshold')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowStock.map((s) => (
                        <tr key={s.id} className="border-b border-slate-700/50 last:border-0">
                          <td className="px-4 py-2.5 text-slate-100">{s.name}</td>
                          <td className="px-4 py-2.5 text-slate-300">{s.point}</td>
                          <td className={cn('px-4 py-2.5 text-right font-medium', s.quantity <= 0 ? 'text-red-400' : 'text-amber-400')}>
                            {s.quantity <= 0 ? t('org.owner.outOfStock') : s.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-400">{s.threshold}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.lowStockCount > data.lowStock.length && (
                    <p className="border-t border-slate-700/50 px-4 py-2 text-xs text-slate-500">
                      {t('org.owner.moreLowStock', { count: data.lowStockCount - data.lowStock.length })}
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
