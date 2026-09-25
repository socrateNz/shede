'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, AlertTriangle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  DailyRevenuePoint,
  TopProduct,
  LowStockItem,
} from '@/app/actions/dashboard';
import { useT } from '@/lib/i18n/client';

interface DashboardAdminChartsProps {
  dailyRevenue: DailyRevenuePoint[];
  topProducts: TopProduct[];
  lowStockItems: LowStockItem[];
  currency: string;
}


const CustomTooltip = ({
  active,
  payload,
  label,
  currency,
}: any) => {
  const { format } = useT();
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl text-sm">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-bold text-white">
          {format.money(payload[0].value, currency)}
        </p>
      </div>
    );
  }
  return null;
};

export function DashboardAdminCharts({
  dailyRevenue,
  topProducts,
  lowStockItems,
  currency,
}: DashboardAdminChartsProps) {
  const { t } = useT();
  const maxQty = Math.max(...topProducts.map((p) => p.quantity), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Graphique CA 7 jours ── */}
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl lg:col-span-2">
        <CardHeader className="border-b border-slate-700/50 pb-4">
          <CardTitle className="text-slate-50 flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            {t('dashboard.charts.revenue7Days')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {dailyRevenue.every((d) => d.revenue === 0) ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              {t('dashboard.charts.noSales7Days')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={dailyRevenue}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  width={45}
                />
                <Tooltip
                  content={<CustomTooltip currency={currency} />}
                  cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                />
                <Bar
                  dataKey="revenue"
                  fill="url(#barGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={60}
                />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Top 5 produits ── */}
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
        <CardHeader className="border-b border-slate-700/50 pb-4">
          <CardTitle className="text-slate-50 flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-emerald-400" />
            {t('dashboard.charts.top5')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {topProducts.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">
              {t('dashboard.charts.noSales')}
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={product.product_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 truncate max-w-[70%]">
                      <span className="text-slate-500 mr-2 tabular-nums">
                        #{idx + 1}
                      </span>
                      {product.name}
                    </span>
                    <span className="text-slate-400 tabular-nums shrink-0">
                      {t('dashboard.charts.sold', { count: product.quantity })}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                      style={{
                        width: `${Math.round((product.quantity / maxQty) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Alertes stock bas ── */}
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
        <CardHeader className="border-b border-slate-700/50 pb-4">
          <CardTitle className="text-slate-50 flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            {t('dashboard.charts.lowStock')}
            {lowStockItems.length > 0 && (
              <span className="ml-auto text-xs font-normal bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {lowStockItems.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="p-3 bg-emerald-500/10 rounded-full">
                <Package className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-slate-500 text-sm">{t('dashboard.charts.stockOk')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-slate-300 text-sm truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-amber-400 font-bold text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <span className="text-slate-600 text-xs">
                      / {item.threshold}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
