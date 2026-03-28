import Link from 'next/link';
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-1 text-2xl font-bold text-slate-50 sm:mb-2 sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-slate-400 sm:text-base">
          Welcome back to Shede POS System
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="min-w-0 border-slate-700 bg-slate-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="truncate text-xs font-medium text-slate-200 sm:text-sm">
                  {card.title}
                </CardTitle>
                <div className={`shrink-0 rounded-lg p-2 ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                <div className="truncate text-xl font-bold tabular-nums text-slate-50 sm:text-2xl">
                  {card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-700 bg-slate-800">
        <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
          <CardTitle className="text-slate-50">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
            <Link
              href="/orders/new"
              className="flex min-h-11 items-center justify-center rounded-lg bg-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-50 transition-colors hover:bg-slate-600 sm:min-h-0 sm:justify-start sm:text-base"
            >
              Create New Order
            </Link>
            <Link
              href="/products"
              className="flex min-h-11 items-center justify-center rounded-lg bg-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-50 transition-colors hover:bg-slate-600 sm:min-h-0 sm:justify-start sm:text-base"
            >
              Manage Products
            </Link>
            <Link
              href="/users"
              className="flex min-h-11 items-center justify-center rounded-lg bg-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-50 transition-colors hover:bg-slate-600 sm:min-h-0 sm:justify-start sm:text-base"
            >
              Manage Team
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
