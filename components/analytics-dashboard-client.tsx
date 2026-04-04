'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, ShoppingCart, Users, BarChart3, PieChart, Calendar, Sparkles, Hotel, UtensilsCrossed, Loader2 } from 'lucide-react';
import { AnalyticsCharts } from '@/components/analytics-charts';
import { fetchClientAnalyticsData } from '@/app/actions/analytics';

const rangeOptions = [
  { label: '7 jours', value: '7' },
  { label: '30 jours', value: '30' },
  { label: '90 jours', value: '90' },
  { label: 'Tout', value: 'all' },
];

export function AnalyticsDashboardClient({ initialData, initialRange }: { initialData: any, initialRange: string }) {
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState(initialRange);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (range === initialRange && data === initialData) return; // skip initial load

    const loadData = async () => {
      setLoading(true);
      try {
        const newData = await fetchClientAnalyticsData(range);
        if (mounted && newData) {
          setData(newData);
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

  const rangeLabel = rangeOptions.find(r => r.value === range)?.label || '30 jours';

  let statCards: any[] = [];

  if (data.type === 'SUPER_ADMIN') {
    statCards = [
      {
        title: `Revenu total (${rangeLabel})`,
        value: `${data.totalRevenue.toLocaleString()} FCFA`,
        icon: DollarSign,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: `Commandes (${rangeLabel})`,
        value: data.completedOrdersCount.toString(),
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: `Réservations (${rangeLabel})`,
        value: data.totalBookingsCount?.toString() || '0',
        icon: Calendar,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: `Nouvelles structures (${rangeLabel})`,
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
        title: 'Revenu total',
        value: `${data.totalRevenue.toLocaleString()} FCFA`,
        icon: DollarSign,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: 'Commandes',
        value: data.completedOrdersCount.toString(),
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Réservations',
        value: data.totalBookingsCount?.toString() || '0',
        icon: Calendar,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: 'Panier moyen',
        value: `${data.averageOrderValue.toLocaleString()} FCFA`,
        icon: TrendingUp,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
    ];
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">
                {data.type === 'SUPER_ADMIN' ? 'Vue globale' : 'Analyses de performance'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Analyses
            </h1>
            <p className="text-slate-400">
              {data.type === 'SUPER_ADMIN'
                ? `Performance globale sur ${rangeLabel.toLowerCase()}`
                : `Performances de votre établissement sur ${rangeLabel.toLowerCase()}`}
            </p>
          </div>

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
                  <span className="text-lg">Revenus Restaurant</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-2">
                  {data.orderRevenue.toLocaleString()} FCFA
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ShoppingCart className="w-4 h-4" />
                  <span>{data.completedOrdersCount} commandes complétées</span>
                </div>
                <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${data.totalRevenue > 0 ? (data.orderRevenue / data.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {((data.orderRevenue / data.totalRevenue) * 100 || 0).toFixed(1)}% du revenu total
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
                  <span className="text-lg">Revenus Hôtel</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-2">
                  {data.hotelRevenue.toLocaleString()} FCFA
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>{data.totalBookingsCount} réservations</span>
                </div>
                <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${data.totalRevenue > 0 ? (data.hotelRevenue / data.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {((data.hotelRevenue / data.totalRevenue) * 100 || 0).toFixed(1)}% du revenu total
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
                <Sparkles className="w-5 h-5 text-blue-400" />
                Informations sur l'analyse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Période d'analyse :</span>
                    <span className="text-white font-medium">{rangeLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>Données mises à jour :</span>
                    <span className="text-white font-medium">À l'instant</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Revenu Restaurant :</span>
                    <span className="text-white font-medium">{data.orderRevenue.toLocaleString()} FCFA</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span>Méthodes de paiement :</span>
                    <span className="text-white font-medium">
                      {Object.keys(data.paymentsByMethod).length} active(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span>Statuts des commandes :</span>
                    <span className="text-white font-medium">
                      {Object.keys(data.ordersByStatus).length} type(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <span>Revenu Hôtel :</span>
                    <span className="text-white font-medium">{data.hotelRevenue.toLocaleString()} FCFA</span>
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
