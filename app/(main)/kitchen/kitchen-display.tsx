'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { ChefHat, Clock, CheckCircle2, RefreshCw, Wifi, WifiOff, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getKitchenOrders, updateOrderStatusFromKitchen } from '@/app/actions/kitchen';
import type { KitchenOrder } from '@/app/actions/kitchen';
import { cn } from '@/lib/utils';

// Client Supabase public pour le Realtime (sans service role)
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface KitchenDisplayProps {
  initialOrders: KitchenOrder[];
  structureId: string;
}

/** Calcule le temps écoulé depuis la création de la commande */
function useElapsedTime(createdAt: string) {
  const [elapsed, setElapsed] = useState(() => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const isUrgent = elapsed > 10 * 60; // > 10 minutes
  const isWarning = elapsed > 5 * 60; // > 5 minutes

  return { minutes, seconds, isUrgent, isWarning };
}

function OrderTimer({ createdAt }: { createdAt: string }) {
  const { minutes, seconds, isUrgent, isWarning } = useElapsedTime(createdAt);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-mono tabular-nums',
        isUrgent ? 'text-red-400 animate-pulse' : isWarning ? 'text-amber-400' : 'text-slate-500'
      )}
    >
      <Timer className="w-3 h-3" />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

function OrderCard({
  order,
  onStatusChange,
  isPending,
}: {
  order: KitchenOrder;
  onStatusChange: (id: string, status: 'IN_PROGRESS' | 'READY') => void;
  isPending: boolean;
}) {
  const isNew      = order.status === 'PENDING';
  const isCooking  = order.status === 'IN_PROGRESS';

  const locationLabel = order.table_number
    ? `Table ${order.table_number}`
    : order.room_id
    ? 'Chambre'
    : order.phone
    ? `📱 ${order.phone}`
    : 'À emporter';

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-300',
        isNew
          ? 'border-amber-500/40 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
          : 'border-blue-500/40 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
      )}
    >
      {/* En-tête commande */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          isNew ? 'border-amber-500/20 bg-amber-500/10' : 'border-blue-500/20 bg-blue-500/10'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-white text-sm">
            #{order.id.slice(-6).toUpperCase()}
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] h-5 px-1.5',
              isNew
                ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                : 'border-blue-500/50 text-blue-400 bg-blue-500/10'
            )}
          >
            {isNew ? 'NOUVEAU' : 'EN COURS'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <OrderTimer createdAt={order.created_at} />
        </div>
      </div>

      {/* Localisation */}
      <div className="px-4 pt-3">
        <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
          {locationLabel}
        </span>
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-3 space-y-1.5">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                isNew ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
              )}
            >
              {item.quantity}
            </span>
            <div className="min-w-0">
              <span className="text-slate-200 text-sm font-medium">{item.product_name}</span>
              {item.notes && (
                <p className="text-xs text-slate-500 mt-0.5 italic">{item.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Notes commande */}
      {order.notes && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-slate-700/40 border border-slate-600/30">
          <p className="text-xs text-slate-400 italic">📋 {order.notes}</p>
        </div>
      )}

      {/* Action */}
      <div className="px-4 pb-4">
        {isNew && (
          <Button
            onClick={() => onStatusChange(order.id, 'IN_PROGRESS')}
            disabled={isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2 transition-all"
          >
            {isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ChefHat className="w-4 h-4" />
            )}
            Commencer
          </Button>
        )}
        {isCooking && (
          <Button
            onClick={() => onStatusChange(order.id, 'READY')}
            disabled={isPending}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 transition-all"
          >
            {isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Prêt !
          </Button>
        )}
      </div>
    </div>
  );
}

export function KitchenDisplay({ initialOrders, structureId }: KitchenDisplayProps) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [isConnected, setIsConnected] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  /** Recharge les commandes via Server Action */
  const refreshOrders = useCallback(() => {
    startTransition(async () => {
      const fresh = await getKitchenOrders(structureId);
      setOrders(fresh);
    });
  }, [structureId]);

  /** Supabase Realtime — déclenche un rechargement à chaque changement */
  useEffect(() => {
    const channel = supabasePublic
      .channel(`kitchen:${structureId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `structure_id=eq.${structureId}`,
        },
        () => {
          // On ne traite pas le payload directement (sécurité)
          // On recharge les données via la Server Action (service role)
          refreshOrders();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabasePublic.removeChannel(channel);
    };
  }, [structureId, refreshOrders]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: 'IN_PROGRESS' | 'READY'
  ) => {
    setUpdatingId(orderId);
    const result = await updateOrderStatusFromKitchen(orderId, newStatus);
    setUpdatingId(null);
    if (result.success) {
      const label = newStatus === 'IN_PROGRESS' ? 'En préparation' : 'Prêt !';
      toast.success(`Commande ${label}`);
      refreshOrders();
    } else {
      toast.error(result.error || 'Erreur de mise à jour');
    }
  };

  const pending    = orders.filter((o) => o.status === 'PENDING');
  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS');

  return (
    <div className="flex-1 bg-slate-950 text-white">
      {/* Header KDS */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-4 py-3">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <ChefHat className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Kitchen Display</h1>
              <p className="text-xs text-slate-400 mt-0.5">Système d&apos;affichage cuisine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Compteurs */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
                <Clock className="w-3.5 h-3.5" />
                {pending.length} en attente
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
                <ChefHat className="w-3.5 h-3.5" />
                {inProgress.length} en cours
              </span>
            </div>

            {/* Statut connexion Realtime */}
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-slate-700/50 border-slate-600/50 text-slate-500'
            )}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'Temps réel' : 'Connexion...'}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshOrders}
              disabled={isPending}
              className="border-slate-600 text-slate-400 hover:text-white gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isPending && 'animate-spin')} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Corps KDS */}
      <div className="w-full p-4 md:p-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-6 bg-slate-800/50 rounded-full mb-4">
              <ChefHat className="w-16 h-16 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-400">Aucune commande active</h2>
            <p className="text-slate-600 text-sm mt-2">
              Les nouvelles commandes apparaîtront ici automatiquement
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonne PENDING */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                  En attente ({pending.length})
                </h2>
              </div>
              <div className="space-y-4">
                {pending.length === 0 ? (
                  <div className="flex items-center justify-center h-24 rounded-xl border border-slate-800 text-slate-600 text-sm">
                    Aucune commande en attente
                  </div>
                ) : (
                  pending.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                      isPending={isPending && updatingId === order.id}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Colonne IN_PROGRESS */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
                <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                  En préparation ({inProgress.length})
                </h2>
              </div>
              <div className="space-y-4">
                {inProgress.length === 0 ? (
                  <div className="flex items-center justify-center h-24 rounded-xl border border-slate-800 text-slate-600 text-sm">
                    Aucune commande en cours
                  </div>
                ) : (
                  inProgress.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                      isPending={isPending && updatingId === order.id}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
