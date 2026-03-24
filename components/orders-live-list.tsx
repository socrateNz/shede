'use client';

import { getOrders, updateOrderStatus } from '@/app/actions/orders';
import { OrdersList } from '@/components/orders-list';
import type { Order } from '@/lib/supabase';
import { useEffect, useRef, useState } from 'react';

interface OrdersLiveListProps {
  initialOrders: Order[];
  structureId: string;
  canManageStatus?: boolean;
}

export function OrdersLiveList({ initialOrders, structureId, canManageStatus = false }: OrdersLiveListProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set(initialOrders.map((order) => order.id)));

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      const latest = await getOrders(structureId, undefined, 100);
      if (!mounted) return;

      const hasFresh = latest.some((order) => !knownIdsRef.current.has(order.id));
      if (hasFresh) {
        setHasNewOrder(true);
      }

      knownIdsRef.current = new Set(latest.map((order) => order.id));
      setOrders(latest);
    };

    const interval = setInterval(poll, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [structureId]);

  const handleStatusChange = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, status);
      const latest = await getOrders(structureId, undefined, 100);
      knownIdsRef.current = new Set(latest.map((order) => order.id));
      setOrders(latest);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="space-y-3">
      {hasNewOrder && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 flex items-center justify-between">
          <span>Nouvelle commande recue.</span>
          <button
            type="button"
            className="text-blue-200 hover:text-white"
            onClick={() => setHasNewOrder(false)}
          >
            OK
          </button>
        </div>
      )}
      {orders.length === 0 ? (
        <p className="text-slate-400 text-center py-8">No orders yet</p>
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
