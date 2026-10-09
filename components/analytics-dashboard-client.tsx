'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, ShoppingCart, Users, Calendar, Hotel, UtensilsCrossed, Loader2, Download } from 'lucide-react';
import { AnalyticsCharts } from '@/components/analytics-charts';
import { fetchClientAnalyticsData } from '@/app/actions/analytics';
import { exportToExcel, exportToCSV } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/client';


export function AnalyticsDashboardClient({ initialData, initialRange }: { initialData: any, initialRange: string }) {
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState(initialRange);
  const [loading, setLoading] = useState(false);
  const { t, format } = useT();

  const rangeOptions = [
    { label: t('analytics.stats.range7'), value: '7' },
    { label: t('analytics.stats.range30'), value: '30' },
    { label: t('analytics.stats.range90'), value: '90' },
    { label: t('analytics.stats.rangeAll'), value: 'all' },
  ];
  const paymentMethodLabel = (method: string) =>
    ['CASH', 'CARD', 'CHEQUE', 'TRANSFER', 'MOBILE', 'AUTRE'].includes(method)
      ? t(`common.paymentMethods.${method as 'CASH'}`)
      : method;
  const share = (part: number) =>
    format.number(data.totalRevenue > 0 ? (part / data.totalRevenue) * 100 : 0, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  useEffect(() => {
    let mounted = true;
    if (range === initialRange && data === initialData) return; // skip initial load

    const loadData = async () => {
      setLoading(true);
      try {
        const newData = await fetchClientAnalyticsData(range);
        if (mounted && newData) {
          if (newData) setData(newData);
        }
      } catch(e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [range]);

  const rangeLabel = rangeOptions.find(r => r.value === range)?.label || t('analytics.stats.range30');
  const withRange = (label: string) => t('analytics.stats.withRange', { label, range: rangeLabel });

  let statCards: any[] = [];

  if (data.type === 'SUPER_ADMIN') {
    statCards = [
      {
        title: withRange(t('analytics.stats.totalRevenue')),
        value: format.money(data.totalRevenue),
        icon: DollarSign,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: withRange(t('analytics.stats.orders')),
        value: data.completedOrdersCount.toString(),
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: withRange(t('analytics.stats.bookings')),
        value: data.totalBookingsCount?.toString() || '0',
        icon: Calendar,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: withRange(t('analytics.stats.newStructures')),
        value: data.newStructuresCount?.toString() || '0',
        icon: Users,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
    ];
  } else {
    statCards = [
      {
        title: t('analytics.stats.totalRevenue'),
        value: format.money(data.totalRevenue),
        icon: DollarSign,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: t('analytics.stats.orders'),
        value: data.completedOrdersCount.toString(),
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: t('analytics.stats.bookings'),
        value: data.totalBookingsCount?.toString() || '0',
        icon: Calendar,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: t('analytics.stats.averageBasket'),
        value: format.money(data.averageOrderValue),
        icon: TrendingUp,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
    ];
  }

  const handleExport = (type: 'excel' | 'csv') => {
    const row = (metric: string, value: number, currency = '') => ({
      [t('analytics.stats.exportMetric')]: metric,
      [t('analytics.stats.exportValue')]: value,
      [t('analytics.stats.exportCurrency')]: currency,
    });
    const exportData = [
      row(t('analytics.stats.totalRevenue'), data.totalRevenue, 'FCFA'),
      row(t('analytics.stats.restaurantRevenue'), data.orderRevenue, 'FCFA'),
      row(t('analytics.stats.hotelRevenue'), data.hotelRevenue, 'FCFA'),
      row(t('analytics.stats.orders'), data.completedOrdersCount),
      row(t('analytics.stats.bookings'), data.totalBookingsCount || 0),
      row(t('analytics.stats.newStructures'), data.newStructuresCount || 0),
      row(t('analytics.stats.averageBasket'), data.averageOrderValue || 0, 'FCFA'),
    ];

    Object.entries(data.paymentsByMethod || {}).forEach(([method, count]) => {
      exportData.push(row(t('analytics.stats.exportPayment', { method: paymentMethodLabel(method) }), count as number));
    });

    const filename = t('analytics.stats.exportFile', { range: rangeLabel.replace(/\s+/g, '_') });
    
    if (type === 'excel') {
      exportToExcel(exportData, filename);
    } else {
      exportToCSV(exportData, filename);
    }
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              {t('analytics.stats.title')}
            </h1>
            <p className="text-slate-400">
              {data.type === 'SUPER_ADMIN'
                ? t('analytics.stats.globalSubtitle', { range: rangeLabel.toLowerCase() })
                : t('analytics.stats.subtitle', { range: rangeLabel.toLowerCase() })}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Range Selector */}
            <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700 backdrop-blur-sm relative">
              {loading && <div className="absolute -top-6 right-2 text-blue-400"><Loader2 className="w-4 h-4 animate-spin"/></div>}
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRange(option.value)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${range === option.value
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 cursor-pointer'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Export Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white bg-slate-800/50 backdrop-blur-sm">
                  <Download className="w-4 h-4 mr-2" />
                  {t('analytics.stats.export')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-slate-200">
                <DropdownMenuItem onClick={() => handleExport('excel')} className="hover:bg-slate-700 cursor-pointer">
                  {t('analytics.stats.exportExcel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')} className="hover:bg-slate-700 cursor-pointer">
                  {t('analytics.stats.exportCsv')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className={`transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card
                  key={index}
                  className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-slate-300">
                      {card.title}
                    </CardTitle>
                    <div className={`${card.bgColor} p-2 rounded-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-2xl font-bold text-white">{card.value}</div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>{rangeLabel}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Revenue Breakdown Cards - RESTAURANT & HOTEL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Restaurant Revenue Card */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border-blue-500/30 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-50 flex items-center gap-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <UtensilsCrossed className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-lg">{t('analytics.stats.restaurantRevenue')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-2">
                  {format.money(data.orderRevenue)}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ShoppingCart className="w-4 h-4" />
                  <span>{t('analytics.stats.completedOrders', { count: data.completedOrdersCount })}</span>
                </div>
                <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${data.totalRevenue > 0 ? (data.orderRevenue / data.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {t('analytics.stats.shareOfTotal', { percent: share(data.orderRevenue) })}
                </p>
              </CardContent>
            </Card>

            {/* Hotel Revenue Card */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border-purple-500/30 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-50 flex items-center gap-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Hotel className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-lg">{t('analytics.stats.hotelRevenue')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-2">
                  {format.money(data.hotelRevenue)}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>{t('analytics.stats.bookingCount', { count: data.totalBookingsCount ?? 0 })}</span>
                </div>
                <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${data.totalRevenue > 0 ? (data.hotelRevenue / data.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {t('analytics.stats.shareOfTotal', { percent: share(data.hotelRevenue) })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="mb-8">
            <AnalyticsCharts
              paymentsByMethod={data.paymentsByMethod}
              ordersByStatus={data.ordersByStatus}
              bookingsByStatus={data.bookingsByStatus || {}}
              orderRevenue={data.orderRevenue}
              hotelRevenue={data.hotelRevenue}
            />
          </div>

          {/* Additional Info Card */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5" />
            <CardHeader>
              <CardTitle className="text-slate-50 flex items-center gap-2">
                {t('analytics.stats.infoTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>{t('analytics.stats.period')}</span>
                    <span className="text-white font-medium">{rangeLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>{t('analytics.stats.updated')}</span>
                    <span className="text-white font-medium">{t('analytics.stats.justNow')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{t('analytics.stats.restaurantRevenueLabel')}</span>
                    <span className="text-white font-medium">{format.money(data.orderRevenue)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span>{t('analytics.stats.paymentMethods')}</span>
                    <span className="text-white font-medium">
                      {t('analytics.stats.activeCount', { count: Object.keys(data.paymentsByMethod).length })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span>{t('analytics.stats.orderStatuses')}</span>
                    <span className="text-white font-medium">
                      {t('analytics.stats.typeCount', { count: Object.keys(data.ordersByStatus).length })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <span>{t('analytics.stats.hotelRevenueLabel')}</span>
                    <span className="text-white font-medium">{format.money(data.hotelRevenue)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
