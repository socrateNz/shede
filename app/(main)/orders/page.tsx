import { requireRole } from '@/app/actions/auth';
import { getOrders } from '@/app/actions/orders';
import { getStructureActiveShift } from '@/app/actions/shifts';
import { getT } from '@/lib/i18n/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ShoppingCart, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { OrdersLiveList } from '@/components/orders-live-list';

async function getOrdersStats(orders: any[]) {
  const total = orders.length;
  const totalRev = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const pendingRev = orders.filter(o => o.status === 'PENDING').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  
  const inProgressCount = orders.filter(o => o.status === 'IN_PROGRESS').length;
  const inProgressRev = orders.filter(o => o.status === 'IN_PROGRESS').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  
  const completedCount = orders.filter(o => o.status === 'COMPLETED').length;
  const completedRev = orders.filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return { 
    total: { count: total, revenue: totalRev },
    pending: { count: pendingCount, revenue: pendingRev },
    inProgress: { count: inProgressCount, revenue: inProgressRev },
    completed: { count: completedCount, revenue: completedRev }
  };
}

export default async function OrdersPage() {
  const session = await requireRole('ADMIN', 'CAISSE', 'SERVEUR');
  const { t } = await getT();
  const orders = await getOrders(session.structureId!, undefined, 100);
  const activeShift = await getStructureActiveShift(session.structureId!);
  const stats = await getOrdersStats(orders);
  const canManageStatus = ['ADMIN', 'CAISSE'].includes(session.role!);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
              <ShoppingCart className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">{t('orders.list.badge')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              {t('orders.list.title')}
            </h1>
            <p className="text-slate-400">{t('orders.list.subtitle')}</p>
          </div>
          {activeShift ? (
            <Link href="/orders/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <Plus className="w-4 h-4 mr-2" />
                {t('orders.list.newOrder')}
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {t('orders.list.tillClosed')}
            </div>
          )}
        </div>

        {!activeShift && (
          <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-amber-500 font-semibold text-sm">{t('orders.list.tillClosedTitle')}</h3>
              <p className="text-amber-500/70 text-xs mt-1">
                {t('orders.list.tillClosedText')}
                {(session.role === 'ADMIN' || session.role === 'CAISSE') && (
                  <Link href="/shifts" className="underline ml-1 font-bold">{t('orders.list.openTill')}</Link>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">{t('orders.list.statTotal')}</div>
                <div className="text-2xl font-bold text-white">{stats.total.count}</div>
                <div className="text-xs font-semibold text-blue-400 mt-1">{stats.total.revenue.toLocaleString()} FCFA</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <ShoppingCart className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">{t('orders.list.statPending')}</div>
                <div className="text-2xl font-bold text-yellow-400">{stats.pending.count}</div>
                <div className="text-xs font-semibold text-yellow-500/80 mt-1">{stats.pending.revenue.toLocaleString()} FCFA</div>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">{t('orders.list.statInProgress')}</div>
                <div className="text-2xl font-bold text-purple-400">{stats.inProgress.count}</div>
                <div className="text-xs font-semibold text-purple-500/80 mt-1">{stats.inProgress.revenue.toLocaleString()} FCFA</div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">{t('orders.list.statPaid')}</div>
                <div className="text-2xl font-bold text-green-400">{stats.completed.count}</div>
                <div className="text-xs font-semibold text-green-500 mt-1">{stats.completed.revenue.toLocaleString()} FCFA</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Liste des commandes */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
              {t('orders.list.recent')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <ShoppingCart className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-lg">{t('orders.list.emptyTitle')}</p>
                <p className="text-sm mt-2 mb-6">{t('orders.list.emptyText')}</p>
                <Link href="/orders/new">
                  <Button variant="outline" className="border-slate-600 text-blue-400 hover:bg-slate-700 hover:text-blue-300">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('orders.list.create')}
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

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            {t('orders.list.realtime')}
          </p>
        </div>
      </div>
    </div>
  );
}