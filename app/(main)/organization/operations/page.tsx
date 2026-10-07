import { AlertTriangle, Gauge, Info } from 'lucide-react';
import { requireRole } from '@/app/actions/auth';
import { getOperationsReport, type PointOperations } from '@/app/actions/operations';
import { PeriodTabs } from '@/components/period-tabs';
import { FOOD_COST_TARGET_PERCENT } from '@/lib/recipes';
import { parsePeriod } from '@/lib/periods';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const LOSSES_ALERT_PERCENT = 2;
const COVERAGE_ALERT_PERCENT = 80;
const ACCURACY_ALERT_PERCENT = 60;
const INVENTORY_MAX_AGE_DAYS = 30;

export default async function OperationsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireRole('ORG_ADMIN');
  const { t, format } = await getT();
  const period = parsePeriod((await searchParams).period);
  const report = await getOperationsReport(period);
  if (!report) return null;

  const money = (value: number) => format.money(value);
  const pct = (value: number | null) => (value === null ? '—' : `${format.number(value)} %`);
  const daysSince = (date: string | null) => (date ? Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000) : null);

  // Alertes : ce qui mérite l'attention du siège
  const alerts: string[] = [];
  for (const p of report.points) {
    if (p.foodCostPercent !== null && p.foodCostPercent > FOOD_COST_TARGET_PERCENT) {
      alerts.push(t('operations.alerts.foodCost', { point: p.name, percent: format.number(p.foodCostPercent), target: FOOD_COST_TARGET_PERCENT }));
    }
    if (p.costCoverage !== null && p.costCoverage < COVERAGE_ALERT_PERCENT) {
      alerts.push(t('operations.alerts.coverage', { point: p.name, percent: p.costCoverage }));
    }
    if (p.lossesPercent !== null && p.lossesPercent > LOSSES_ALERT_PERCENT) {
      alerts.push(t('operations.alerts.losses', { point: p.name, percent: format.number(p.lossesPercent) }));
    }
    if (p.inventoryGap < 0 && p.revenue > 0 && -p.inventoryGap / p.revenue > 0.01) {
      alerts.push(t('operations.alerts.gap', { point: p.name, amount: money(-p.inventoryGap) }));
    }
    if (p.modules.includes('STOCK')) {
      const age = daysSince(p.lastInventoryAt);
      if (age === null) alerts.push(t('operations.alerts.neverCounted', { point: p.name }));
      else if (age > INVENTORY_MAX_AGE_DAYS) alerts.push(t('operations.alerts.noInventory', { point: p.name }));
    }
    if (p.lowStock > 0) alerts.push(t('operations.alerts.lowStock', { point: p.name, count: p.lowStock }));
    if (p.forecastAccuracy !== null && p.forecastAccuracy < ACCURACY_ALERT_PERCENT) {
      alerts.push(t('operations.alerts.accuracy', { point: p.name, percent: format.number(p.forecastAccuracy) }));
    }
  }

  const foodCostTone = (value: number | null) =>
    value === null ? 'text-slate-500' : value > FOOD_COST_TARGET_PERCENT ? 'text-amber-300' : 'text-emerald-400';
  const Row = ({ p, total = false }: { p: PointOperations | (typeof report.totals & { name: string }); total?: boolean }) => {
    const point = p as PointOperations;
    return (
      <tr className={total ? 'bg-slate-800/70 font-semibold' : 'hover:bg-slate-800/50'}>
        <td className={`px-4 py-3 ${total ? 'text-white' : 'font-medium text-slate-100'}`}>
          {p.name}
          {!total && point.openOrders > 0 && <span className="block text-[11px] font-normal text-sky-300">{t('operations.openOrders', { count: point.openOrders })}</span>}
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-slate-100">{money(p.revenue)}</td>
        <td className="px-3 py-3 text-right tabular-nums">
          <span className={foodCostTone(p.foodCostPercent)}>{pct(p.foodCostPercent)}</span>
          <span className="block text-[11px] text-slate-500">{money(p.foodCost)}</span>
          {!total && point.costCoverage !== null && point.costCoverage < 100 && (
            <span className="block text-[10px] text-slate-500">{t('operations.coverageHint', { percent: point.costCoverage })}</span>
          )}
        </td>
        <td className="px-3 py-3 text-right tabular-nums">
          <span className={p.lossesPercent !== null && p.lossesPercent > LOSSES_ALERT_PERCENT ? 'text-red-300' : 'text-slate-200'}>{money(p.losses)}</span>
          <span className="block text-[11px] text-slate-500">{pct(p.lossesPercent)}</span>
        </td>
        <td className={`px-3 py-3 text-right tabular-nums ${p.inventoryGap < 0 ? 'text-red-400' : p.inventoryGap > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
          {p.inventories ? money(p.inventoryGap) : '—'}
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-slate-200">{p.purchases ? money(p.purchases) : '—'}</td>
        <td className="px-3 py-3 text-right tabular-nums text-slate-200">{money(p.stockValue)}</td>
        <td className={`px-3 py-3 text-right tabular-nums ${p.lowStock ? 'text-amber-300' : 'text-slate-400'}`}>{p.lowStock || '—'}</td>
        <td className="px-3 py-3 text-right tabular-nums text-slate-200">{total ? '' : pct(point.forecastAccuracy)}</td>
        <td className="px-4 py-3 text-right text-sm text-slate-400">
          {total ? '' : point.lastInventoryAt ? format.date(point.lastInventoryAt) : t('operations.never')}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2">
          <Gauge className="h-4 w-4 text-violet-300" />
          <span className="text-sm font-medium text-violet-300">{t('operations.badge')}</span>
        </div>
        <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('operations.title')}</h1>
        <p className="max-w-3xl text-slate-400">
          {report.organizationName} · {t('operations.subtitle')}
        </p>
      </div>

      <div className="mb-6">
        <PeriodTabs
          basePath="/organization/operations"
          current={period}
          labels={{
            d7: t('stockControl.periods.d7'),
            d30: t('stockControl.periods.d30'),
            month: t('stockControl.periods.month'),
            lastMonth: t('stockControl.periods.lastMonth'),
          }}
        />
      </div>

      {report.points.length === 0 ? (
        <p className="rounded-2xl border border-slate-700/50 bg-slate-800/40 py-16 text-center text-sm text-slate-400">{t('operations.empty')}</p>
      ) : (
        <>
          {/* Indicateurs de l'organisation */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: t('operations.kpiRevenue'), value: money(report.totals.revenue) },
              {
                label: t('operations.kpiFoodCost'),
                value: pct(report.totals.foodCostPercent),
                hint: t('operations.target', { percent: FOOD_COST_TARGET_PERCENT }),
                tone: foodCostTone(report.totals.foodCostPercent),
              },
              { label: t('operations.kpiLosses'), value: money(report.totals.losses), hint: report.totals.lossesPercent !== null ? t('operations.ofRevenue', { percent: format.number(report.totals.lossesPercent) }) : undefined },
              { label: t('operations.kpiGap'), value: money(report.totals.inventoryGap), tone: report.totals.inventoryGap < 0 ? 'text-red-400' : 'text-white' },
              { label: t('operations.kpiPurchases'), value: money(report.totals.purchases) },
              { label: t('operations.kpiStock'), value: money(report.totals.stockValue) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{kpi.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${kpi.tone ?? 'text-white'}`}>{kpi.value}</p>
                {kpi.hint && <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>}
              </div>
            ))}
          </div>

          {/* À surveiller */}
          <div className="mb-6 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" /> {t('operations.alertsTitle')}
            </p>
            {alerts.length === 0 ? (
              <p className="text-sm text-emerald-400">{t('operations.alertsEmpty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {alerts.map((alert) => (
                  <li key={alert} className="flex gap-2 text-sm text-slate-200">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {alert}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Comparaison des points */}
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="border-b border-slate-700 bg-slate-800/60 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">{t('operations.colPoint')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colRevenue')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colFoodCost')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colLosses')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colGap')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colPurchases')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colStock')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colLowStock')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t('operations.colAccuracy')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('operations.colLastInventory')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {report.points.map((p) => (
                    <Row key={p.id} p={p} />
                  ))}
                  {report.points.length > 1 && <Row p={{ ...report.totals, name: t('operations.total') }} total />}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-sm text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('operations.method')}</p>
          </div>
        </>
      )}
    </div>
  );
}
