import { requireRole } from '@/app/actions/auth';
import { getOrders } from '@/app/actions/orders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { OrdersLiveList } from '@/components/orders-live-list';

export default async function OrdersPage() {
  const session = await requireRole('ADMIN', 'CAISSE', 'SERVEUR');
  const orders = await getOrders(session.structureId!, undefined, 100);
  const canManageStatus = ['CAISSE'].includes(session.role!);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Orders</h1>
          <p className="text-slate-400">Manage restaurant orders</p>
        </div>
        <Link href="/orders/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </Link>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No orders yet</p>
              <Link href="/orders/new">
                <Button variant="outline" className="border-slate-600 text-blue-400 hover:bg-slate-700">
                  Create your first order
                </Button>
              </Link>
            </div>
          ) : (
            <OrdersLiveList
              initialOrders={orders}
              structureId={session.structureId!}
              canManageStatus={canManageStatus}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
