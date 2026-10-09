import { requireRole } from '@/app/actions/auth';
import { listOrders } from '@/app/actions/orders';
import { parsePage } from '@/lib/pagination';
import { getStructureActiveShift } from '@/lib/shifts-server';
import { getT } from '@/lib/i18n/server';
import { Button } from '@/components/ui/button';
import { Plus, ShoppingCart, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { OrdersLiveList } from '@/components/orders-live-list';
import { getMarketplaceInbox } from '@/app/actions/marketplace-orders';
import { MarketplaceInbox } from '@/components/marketplace/marketplace-inbox';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const session = await requireRole('ADMIN', 'CAISSE', 'SERVEUR');
  const { t } = await getT();
  const params = await searchParams;
  const status = params.status ?? null;
  // 20 commandes par page ; les totaux viennent du SQL (toutes les commandes).
  const [initial, activeShift] = await Promise.all([
    listOrders({ page: parsePage(params.page), status }),
    getStructureActiveShift(session.structureId!),
  ]);
  const canManageStatus = ['ADMIN', 'CAISSE'].includes(session.role!);
  // Module API : commandes des marketplaces à accepter (null sans le module ou avant la migration)
  const marketplace = await getMarketplaceInbox();

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

        {marketplace && (
          <MarketplaceInbox orders={marketplace.orders} paused={marketplace.paused} canDecide={marketplace.canDecide} />
        )}

        {initial.meta.stats.total.count === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center text-slate-400">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-700/50">
              <ShoppingCart className="h-10 w-10 opacity-30" />
            </div>
            <p className="text-lg">{t('orders.list.emptyTitle')}</p>
            <p className="mb-6 mt-2 text-sm">{t('orders.list.emptyText')}</p>
            <Link href="/orders/new">
              <Button variant="outline" className="border-slate-600 text-blue-400 hover:bg-slate-700 hover:text-blue-300">
                <Plus className="mr-2 h-4 w-4" />
                {t('orders.list.create')}
              </Button>
            </Link>
          </div>
        ) : (
          <OrdersLiveList initial={initial} status={status} canManageStatus={canManageStatus} />
        )}

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