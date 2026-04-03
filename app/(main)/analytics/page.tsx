import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, ShoppingCart, Users, BarChart3, PieChart, Calendar, Sparkles, Hotel, UtensilsCrossed } from 'lucide-react';
import { AnalyticsCharts } from '@/components/analytics-charts';
import Link from 'next/link';

async function getAnalyticsData(structureId: string, role: string, range: string = '30') {
  const admin = getAdminSupabase();
  let startDate: string | null = null;

  if (range !== 'all') {
    const days = parseInt(range);
    const date = new Date();
    date.setDate(date.getDate() - days);
    startDate = date.toISOString();
  }

  if (role === 'SUPER_ADMIN') {
    let paymentsQuery = admin
      .from('payments')
      .select('amount, payment_method')
      .eq('status', 'COMPLETED');

    if (startDate) {
      paymentsQuery = paymentsQuery.gte('created_at', startDate);
    }

    const { data: globalPayments } = await paymentsQuery;

    let totalOrderRevenue = (globalPayments || []).reduce((sum, p) => sum + p.amount, 0);

    let bookingsRevenueQuery = admin
      .from('bookings')
      .select('total_amount, status, is_paid')
      .or(`status.eq.COMPLETED,is_paid.eq.true`);

    if (startDate) {
      bookingsRevenueQuery = bookingsRevenueQuery.gte('created_at', startDate);
    }

    const { data: globalBookings } = await bookingsRevenueQuery;

    let totalHotelRevenue = (globalBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

    const paymentsByMethod: Record<string, number> = {};
    (globalPayments || []).forEach((p) => {
      const method = String(p.payment_method || 'UNKNOWN');
      paymentsByMethod[method] = (paymentsByMethod[method] || 0) + p.amount;
    });

    let ordersQuery = admin.from('orders').select('status');
    if (startDate) ordersQuery = ordersQuery.gte('created_at', startDate);
    const { data: allOrders } = await ordersQuery;

    const ordersByStatus: Record<string, number> = {};
    (allOrders || []).forEach((order) => {
      const status = String(order.status || 'UNKNOWN');
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    let bookingsStatusQuery = admin.from('bookings').select('status');
    if (startDate) bookingsStatusQuery = bookingsStatusQuery.gte('created_at', startDate);
    const { data: allBookings } = await bookingsStatusQuery;

    const bookingsByStatus: Record<string, number> = {};
    (allBookings || []).forEach((booking) => {
      const status = String(booking.status || 'UNKNOWN');
      bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
    });

    let structuresQuery = admin.from('structures').select('*', { count: 'exact', head: true });
    if (startDate) structuresQuery = structuresQuery.gte('created_at', startDate);
    const { count: newStructuresCount } = await structuresQuery;

    return {
      type: 'SUPER_ADMIN',
      totalRevenue: totalOrderRevenue + totalHotelRevenue,
      hotelRevenue: totalHotelRevenue,
      orderRevenue: totalOrderRevenue,
      completedOrdersCount: allOrders?.length || 0,
      totalBookingsCount: allBookings?.length || 0,
      averageOrderValue: allOrders && allOrders.length > 0 ? (totalOrderRevenue + totalHotelRevenue) / allOrders.length : 0,
      newStructuresCount: newStructuresCount || 0,
      paymentsByMethod,
      ordersByStatus,
      bookingsByStatus,
    };
  }

  // Admin logic (specific to structure)
  let adminOrdersQuery = admin
    .from('orders')
    .select('*, payments(*)')
    .eq('structure_id', structureId)
    .eq('status', 'COMPLETED');

  if (startDate) adminOrdersQuery = adminOrdersQuery.gte('created_at', startDate);
  const { data: orders } = await adminOrdersQuery;

  let adminPaidBookingsQuery = admin
    .from('bookings')
    .select('total_amount, status, is_paid, rooms!inner(structure_id)')
    .eq('rooms.structure_id', structureId)
    .or(`status.eq.COMPLETED,is_paid.eq.true`);

  if (startDate) adminPaidBookingsQuery = adminPaidBookingsQuery.gte('created_at', startDate);
  const { data: paidBookings } = await adminPaidBookingsQuery;

  let orderRevenue = (orders || []).reduce((sum, order) => {
    const payments = order.payments || [];
    return sum + payments.reduce((pSum: number, p: any) => pSum + p.amount, 0);
  }, 0);

  let hotelRevenue = (paidBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  let totalRevenue = orderRevenue + hotelRevenue;

  let adminAllBookingsQuery = admin
    .from('bookings')
    .select('status, rooms!inner(structure_id)')
    .eq('rooms.structure_id', structureId);

  if (startDate) adminAllBookingsQuery = adminAllBookingsQuery.gte('created_at', startDate);
  const { data: allBookings } = await adminAllBookingsQuery;

  const bookingsByStatus: Record<string, number> = {};
  (allBookings || []).forEach((booking) => {
    const status = booking.status || 'UNKNOWN';
    bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
  });

  const { count: productCount } = await admin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId)
    .eq('is_deleted', false);

  const averageOrderValue = (orders?.length || 0) > 0 ? totalRevenue / (orders!.length) : 0;

  const paymentsByMethod: Record<string, number> = {};
  (orders || []).forEach((order) => {
    const payments = order.payments || [];
    payments.forEach((payment: any) => {
      const method = payment.payment_method || 'UNKNOWN';
      paymentsByMethod[method] = (paymentsByMethod[method] || 0) + payment.amount;
    });
  });

  let adminAllOrdersQuery = admin
    .from('orders')
    .select('status')
    .eq('structure_id', structureId);

  if (startDate) adminAllOrdersQuery = adminAllOrdersQuery.gte('created_at', startDate);
  const { data: allOrders } = await adminAllOrdersQuery;

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
    totalBookingsCount: allBookings?.length || 0,
    averageOrderValue,
    productCount: productCount || 0,
    paymentsByMethod,
    ordersByStatus,
    bookingsByStatus,
  };
}

const rangeOptions = [
  { label: '7 jours', value: '7' },
  { label: '30 jours', value: '30' },
  { label: '90 jours', value: '90' },
  { label: 'Tout', value: 'all' },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const currentRange = searchParams.range || '30';
  const data = await getAnalyticsData(session.structureId!, session.role as string, currentRange);

  const rangeLabel = rangeOptions.find(r => r.value === currentRange)?.label || '30 jours';

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
        value: (data as any).totalBookingsCount?.toString() || '0',
        icon: Calendar,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: `Nouvelles structures (${rangeLabel})`,
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
        title: 'Commandes',
        value: data.completedOrdersCount.toString(),
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Réservations',
        value: (data as any).totalBookingsCount?.toString() || '0',
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
          <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700 backdrop-blur-sm">
            {rangeOptions.map((option) => (
              <Link
                key={option.value}
                href={`/analytics?range=${option.value}`}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${currentRange === option.value
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
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
            bookingsByStatus={(data as any).bookingsByStatus || {}}
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
                  <span className="text-white font-medium">En temps réel</span>
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