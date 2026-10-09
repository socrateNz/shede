'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle, CheckCircle2, Clock, Package, RefreshCw, ShoppingCart } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { listOrders, updateOrderStatus, type OrderListStats } from '@/app/actions/orders';
import { OrdersList } from '@/components/orders-list';
import { PageNav } from '@/components/page-nav';
import type { Paginated } from '@/lib/pagination';
import type { Order } from '@/lib/supabase';

interface OrdersLiveListProps {
  initial: Paginated<Order, OrderListStats>;
  status: string | null;
  canManageStatus?: boolean;
}

/** Cartes de statistiques : calculées en SQL sur toutes les commandes ; chacune filtre la liste. */
const STAT_CARDS = [
  { status: null, key: 'statTotal', icon: ShoppingCart, tone: 'text-white', sub: 'text-blue-400', ring: 'bg-blue-500/10 text-blue-400' },
  { status: 'PENDING', key: 'statPending', icon: Clock, tone: 'text-yellow-400', sub: 'text-yellow-500/80', ring: 'bg-yellow-500/10 text-yellow-400' },
  { status: 'IN_PROGRESS', key: 'statInProgress', icon: Package, tone: 'text-purple-400', sub: 'text-purple-500/80', ring: 'bg-purple-500/10 text-purple-400' },
  { status: 'COMPLETED', key: 'statPaid', icon: CheckCircle2, tone: 'text-green-400', sub: 'text-green-500', ring: 'bg-green-500/10 text-green-400' },
] as const;

export function OrdersLiveList({ initial, status, canManageStatus = false }: OrdersLiveListProps) {
  const { t, format } = useT();
  const [data, setData] = useState(initial);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const knownTotalRef = useRef(initial.meta.stats.total.count);
  const { page } = initial.meta;

  // Nouvelle page ou nouveau filtre (navigation) : on repart des données du serveur.
  useEffect(() => {
    setData(initial);
    knownTotalRef.current = initial.meta.stats.total.count;
  }, [initial]);

  async function reload(signalNew: boolean) {
    const latest = await listOrders({ page, status });
    if (signalNew && latest.meta.stats.total.count > knownTotalRef.current) setHasNewOrder(true);
    knownTotalRef.current = latest.meta.stats.total.count;
    setData(latest);
  }

  useEffect(() => {
    if (!isPolling) return;
    let mounted = true;
    // Seule la page affichée (20 commandes) est relue, plus les totaux SQL.
    const interval = setInterval(() => {
      if (mounted) reload(true).catch((error) => console.error('Erreur lors de la mise à jour:', error));
    }, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, isPolling]);

  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      await reload(false);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleRefresh = async () => {
    try {
      await reload(false);
      setHasNewOrder(false);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    }
  };

  const { stats } = data.meta;
  const statFor = (s: string | null) => (s ? stats.byStatus[s] ?? { count: 0, revenue: 0 } : stats.total);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const value = statFor(card.status);
          const active = status === card.status;
          const Icon = card.icon;
          return (
            <Link
              key={card.key}
              href={card.status ? `/orders?status=${card.status}` : '/orders'}
              aria-current={active ? 'true' : undefined}
              className={`group rounded-lg border bg-slate-800/50 p-4 backdrop-blur-sm transition-all duration-300 hover:bg-slate-800/70 ${active ? 'border-blue-500/60 ring-1 ring-blue-500/40' : 'border-slate-700'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="mb-1 text-sm text-slate-400">{t(`orders.list.${card.key}`)}</div>
                  <div className={`text-2xl font-bold ${card.tone}`}>{format.number(value.count)}</div>
                  <div className={`mt-1 text-xs font-semibold ${card.sub}`}>{format.money(value.revenue)}</div>
                </div>
                <div className={`rounded-xl p-3 transition-transform duration-300 group-hover:scale-110 ${card.ring}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur-sm">
        {hasNewOrder && (
          <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 py-3 text-sm text-blue-300 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 animate-pulse" />
              <span className="font-medium">{t('orders.live.newOrder')}</span>
            </div>
            <button type="button" className="flex items-center gap-1 text-blue-200 transition-colors hover:text-white" onClick={() => setHasNewOrder(false)}>
              <CheckCircle className="h-4 w-4" />
              {t('orders.live.ok')}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-50">
            <ShoppingCart className="h-5 w-5 text-blue-400" />
            {t('orders.list.recent')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPolling(!isPolling)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all duration-200 ${isPolling ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
            >
              <div className={`h-1.5 w-1.5 rounded-full ${isPolling ? 'animate-pulse bg-green-400' : 'bg-slate-500'}`} />
              <span>{isPolling ? t('orders.live.autoRefresh') : t('orders.live.manualRefresh')}</span>
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-1.5 text-sm text-slate-300 transition-all duration-200 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('orders.live.refresh')}
            </button>
          </div>
        </div>

        {data.items.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/50">
              <Bell className="h-8 w-8 opacity-30" />
            </div>
            <p className="text-lg">{t('orders.live.emptyTitle')}</p>
            <p className="mt-2 text-sm">{t('orders.live.emptyText')}</p>
          </div>
        ) : (
          <OrdersList orders={data.items} canManageStatus={canManageStatus} onStatusChange={handleStatusChange} updatingOrderId={updatingOrderId} />
        )}
        <PageNav meta={data.meta} />
      </div>
    </div>
  );
}
