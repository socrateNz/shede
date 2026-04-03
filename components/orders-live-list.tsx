'use client';

import { getOrders, updateOrderStatus } from '@/app/actions/orders';
import { OrdersList } from '@/components/orders-list';
import type { Order } from '@/lib/supabase';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle, RefreshCw, Eye } from 'lucide-react';

interface OrdersLiveListProps {
  initialOrders: Order[];
  structureId: string;
  canManageStatus?: boolean;
}

export function OrdersLiveList({ initialOrders, structureId, canManageStatus = false }: OrdersLiveListProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const knownIdsRef = useRef<Set<string>>(new Set(initialOrders.map((order) => order.id)));

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted || !isPolling) return;

      try {
        const latest = await getOrders(structureId, undefined, 100);
        if (!mounted) return;

        const hasFresh = latest.some((order) => !knownIdsRef.current.has(order.id));
        if (hasFresh) {
          setHasNewOrder(true);
        }

        knownIdsRef.current = new Set(latest.map((order) => order.id));
        setOrders(latest);
      } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
      }
    };

    const interval = setInterval(poll, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [structureId, isPolling]);

  const handleStatusChange = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, status);
      const latest = await getOrders(structureId, undefined, 100);
      knownIdsRef.current = new Set(latest.map((order) => order.id));
      setOrders(latest);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleRefresh = async () => {
    try {
      const latest = await getOrders(structureId, undefined, 100);
      knownIdsRef.current = new Set(latest.map((order) => order.id));
      setOrders(latest);
      setHasNewOrder(false);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    }
  };

  const togglePolling = () => {
    setIsPolling(!isPolling);
  };

  return (
    <div className="space-y-4">
      {/* Notification de nouvelle commande */}
      {hasNewOrder && (
        <div className="mx-4 mt-4 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm px-4 py-3 text-sm text-blue-300 flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-4 h-4 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <span className="font-medium">Nouvelle commande reçue !</span>
          </div>
          <button
            type="button"
            className="text-blue-200 hover:text-white transition-colors flex items-center gap-1"
            onClick={() => setHasNewOrder(false)}
          >
            <CheckCircle className="w-4 h-4" />
            OK
          </button>
        </div>
      )}

      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePolling}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all duration-200 ${isPolling
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isPolling ? 'Mise à jour automatique' : 'Mise à jour manuelle'}</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all duration-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {/* Liste des commandes */}
      {orders.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-slate-800/30 rounded-xl border border-slate-700/50 mx-4 mb-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
            <Bell className="w-8 h-8 opacity-30" />
          </div>
          <p className="text-lg">Aucune commande pour le moment</p>
          <p className="text-sm mt-2">Les nouvelles commandes apparaîtront ici automatiquement</p>
        </div>
      ) : (
        <OrdersList
          orders={orders}
          canManageStatus={canManageStatus}
          onStatusChange={handleStatusChange}
          updatingOrderId={updatingOrderId}
        />
      )}
    </div>
  );
}