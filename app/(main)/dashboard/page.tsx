import { requireAuth } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, ShoppingCart, DollarSign } from 'lucide-react';

async function getDashboardStats(structureId: string) {
  const admin = getAdminSupabase();

  // Get orders count
  const { count: ordersCount } = await admin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId);

  // Get products count
  const { count: productsCount } = await admin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId)
    .eq('is_deleted', false);

  // Get users count
  const { count: usersCount } = await admin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId);

  // Get total revenue
  const { data: payments } = await admin
    .from('payments')
    .select('amount')
    .eq('status', 'COMPLETED')
    .in('order_id', (
      await admin
        .from('orders')
        .select('id')
        .eq('structure_id', structureId)
    ).data?.map((o: any) => o.id) || []);

  const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  return {
    ordersCount: ordersCount || 0,
    productsCount: productsCount || 0,
    usersCount: usersCount || 0,
    totalRevenue: totalRevenue,
  };
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const stats = await getDashboardStats(session.structureId);

  const statCards = [
    {
      title: 'Total Orders',
      value: stats.ordersCount.toString(),
      icon: ShoppingCart,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Products',
      value: stats.productsCount.toString(),
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Team Members',
      value: stats.usersCount.toString(),
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-50 mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome back to Shede POS System</p>
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

      {/* Recent Activity Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/orders/new" className="p-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-50 font-medium">
              Create New Order
            </a>
            <a href="/products" className="p-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-50 font-medium">
              Manage Products
            </a>
            <a href="/users" className="p-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-50 font-medium">
              Manage Team
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
