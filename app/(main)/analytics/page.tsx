import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, ShoppingCart, Users, BarChart3, PieChart, Calendar, Sparkles } from 'lucide-react';
import { AnalyticsCharts } from '@/components/analytics-charts';

async function getAnalyticsData(structureId: string, role: string) {
  const admin = getAdminSupabase();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString();

  if (role === 'SUPER_ADMIN') {
    const { data: globalPayments } = await admin
      .from('payments')
      .select('amount, payment_method')
      .eq('status', 'COMPLETED')
      .gte('created_at', startDate);

    let totalOrderRevenue = (globalPayments || []).reduce((sum, p) => sum + p.amount, 0);
    
    const { data: globalBookings } = await admin
      .from('bookings')
      .select('total_amount')
      .eq('status', 'COMPLETED')
      .gte('created_at', startDate);
    
    let totalHotelRevenue = (globalBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

    const paymentsByMethod: Record<string, number> = {};
    (globalPayments || []).forEach((p) => {
      const method = String(p.payment_method || 'UNKNOWN');
      paymentsByMethod[method] = (paymentsByMethod[method] || 0) + p.amount;
    });

    const { data: allOrders } = await admin
      .from('orders')
      .select('status')
      .gte('created_at', startDate);

    const ordersByStatus: Record<string, number> = {};
    (allOrders || []).forEach((order) => {
      const status = String(order.status || 'UNKNOWN');
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    const { count: newStructuresCount } = await admin
      .from('structures')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate);

    return {
      type: 'SUPER_ADMIN',
      totalRevenue: totalOrderRevenue + totalHotelRevenue,
      hotelRevenue: totalHotelRevenue,
      orderRevenue: totalOrderRevenue,
      completedOrdersCount: allOrders?.length || 0,
      averageOrderValue: allOrders && allOrders.length > 0 ? (totalOrderRevenue + totalHotelRevenue) / allOrders.length : 0,
      newStructuresCount: newStructuresCount || 0,
      paymentsByMethod,
      ordersByStatus,
    };
  }

  // Admin logic (specific to structure)
  const { data: orders } = await admin
    .from('orders')
    .select('*, payments(*)')
    .eq('structure_id', structureId)
    .gte('created_at', startDate)
    .eq('status', 'COMPLETED');

  const { data: bookings } = await admin
    .from('bookings')
    .select('total_amount')
    .eq('structure_id', structureId)
    .gte('created_at', startDate)
    .eq('status', 'COMPLETED');

  let orderRevenue = (orders || []).reduce((sum, order) => {
    const payments = order.payments || [];
    return sum + payments.reduce((pSum: number, p: any) => pSum + p.amount, 0);
  }, 0);

  let hotelRevenue = (bookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  let totalRevenue = orderRevenue + hotelRevenue;

  // Get products
  const { count: productCount } = await admin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId)
    .eq('is_deleted', false);

  const averageOrderValue = (orders?.length || 0) > 0 ? totalRevenue / (orders!.length) : 0;

  // Payment methods breakdown
  const paymentsByMethod: Record<string, number> = {};
  (orders || []).forEach((order) => {
    const payments = order.payments || [];
    payments.forEach((payment: any) => {
      const method = payment.payment_method || 'UNKNOWN';
      paymentsByMethod[method] = (paymentsByMethod[method] || 0) + payment.amount;
    });
  });

  // Orders by status
  const { data: allOrders } = await admin
    .from('orders')
    .select('status')
    .eq('structure_id', structureId)
    .gte('created_at', startDate);

  const ordersByStatus: Record<string, number> = {};
  (allOrders || []).forEach((order) => {
    const status = order.status || 'UNKNOWN';
    ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
  });

  return {
    type: 'ADMIN',
    totalRevenue,
    hotelRevenue,
    orderRevenue,
    completedOrdersCount: orders?.length || 0,
    averageOrderValue,
    productCount: productCount || 0,
    paymentsByMethod,
    ordersByStatus,
  };
}

export default async function AnalyticsPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const data = await getAnalyticsData(session.structureId!, session.role as string);

  let statCards: any[] = [];

  if (data.type === 'SUPER_ADMIN') {
    statCards = [
      {
        title: 'Revenu total (30j)',
        value: `${data.totalRevenue.toLocaleString()} FCFA`,
        icon: DollarSign,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: 'Commandes globales (30j)',
        value: data.completedOrdersCount.toString(),
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Panier moyen',
        value: `${data.averageOrderValue.toLocaleString()} FCFA`,
        icon: TrendingUp,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: 'Nouvelles structures (30j)',
        value: (data as any).newStructuresCount?.toString() || '0',
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
        title: 'Commandes complétées',
        value: data.completedOrdersCount.toString(),
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Panier moyen',
        value: `${data.averageOrderValue.toLocaleString()} FCFA`,
        icon: TrendingUp,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: 'Produits actifs',
        value: (data as any).productCount?.toString() || '0',
        icon: Users,
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
        <div className="mb-8">
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
              ? 'Performance globale de la plateforme sur les 30 derniers jours'
              : 'Performances de votre établissement sur les 30 derniers jours'}
          </p>
        </div>

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
                    <span>Derniers 30 jours</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="mb-8">
          <AnalyticsCharts
            paymentsByMethod={data.paymentsByMethod}
            ordersByStatus={data.ordersByStatus}
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
                  <span className="text-white font-medium">30 derniers jours</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>Données mises à jour :</span>
                  <span className="text-white font-medium">En temps réel</span>
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Les données sont actualisées automatiquement à chaque chargement de la page
          </p>
        </div>
      </div>
    </div>
  );
}