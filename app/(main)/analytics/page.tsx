import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react';
import { AnalyticsCharts } from '@/components/analytics-charts';

async function getAnalyticsData(structureId: string) {
  const admin = getAdminSupabase();

  // Get orders from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await admin
    .from('orders')
    .select('*, payments(*)')
    .eq('structure_id', structureId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .eq('status', 'COMPLETED');

  // Get products
  const { count: productCount } = await admin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId)
    .eq('is_deleted', false);

  // Calculate metrics
  const completedOrders = orders || [];
  const totalRevenue = completedOrders.reduce((sum, order) => {
    const payments = order.payments || [];
    return sum + payments.reduce((pSum: number, p: any) => pSum + p.amount, 0);
  }, 0);

  const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

  // Payment methods breakdown
  const paymentsByMethod: Record<string, number> = {};
  completedOrders.forEach((order) => {
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
    .gte('created_at', thirtyDaysAgo.toISOString());

  const ordersByStatus: Record<string, number> = {};
  (allOrders || []).forEach((order) => {
    const status = order.status || 'UNKNOWN';
    ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
  });

  return {
    totalRevenue,
    completedOrdersCount: completedOrders.length,
    averageOrderValue,
    productCount: productCount || 0,
    paymentsByMethod,
    ordersByStatus,
  };
}

export default async function AnalyticsPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN');
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const data = await getAnalyticsData(session.structureId);

  const statCards = [
    {
      title: 'Total Revenue',
      value: `$${data.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Completed Orders',
      value: data.completedOrdersCount.toString(),
      icon: ShoppingCart,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Average Order Value',
      value: `$${data.averageOrderValue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Active Products',
      value: data.productCount.toString(),
      icon: Users,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-50 mb-2">Analytics</h1>
        <p className="text-slate-400">Last 30 days performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-200">{card.title}</CardTitle>
                <div className={`${card.bgColor} p-2 rounded-lg`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-50">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <AnalyticsCharts paymentsByMethod={data.paymentsByMethod} ordersByStatus={data.ordersByStatus} />
    </div>
  );
}
