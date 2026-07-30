'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Beer, Clock, RefreshCw, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBarOrders, updateOrderStatusFromBar } from '@/app/actions/kitchen';
import type { KitchenOrder } from '@/app/actions/kitchen';
import { cn } from '@/lib/utils';

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface BarDisplayProps {
  initialOrders: KitchenOrder[];
  structureId: string;
}

export function BarDisplay({ initialOrders, structureId }: BarDisplayProps) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [isConnected, setIsConnected] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshOrders = useCallback(() => {
    startTransition(async () => {
      const fresh = await getBarOrders(structureId);
      setOrders(fresh);
    });
  }, [structureId]);

  useEffect(() => {
    const channel = supabasePublic
      .channel(`bar:${structureId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `structure_id=eq.${structureId}` }, () => {
        refreshOrders();
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    return () => { supabasePublic.removeChannel(channel); };
  }, [structureId, refreshOrders]);

  const handleReady = async (orderId: string) => {
    const result = await updateOrderStatusFromBar(orderId, 'READY');
    if (result.success) {
      toast.success('Commande marquée comme prête !');
      refreshOrders();
    } else {
      toast.error(result.error || 'Erreur');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Beer className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Bar Display</h1>
              <p className="text-xs text-slate-400">Boissons & commandes bar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border',
              isConnected ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' : 'border-slate-600 text-slate-500 bg-slate-700/30'
            )}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'Temps réel' : 'Connexion...'}
            </div>
            <Button variant="outline" size="sm" onClick={refreshOrders} disabled={isPending} className="border-slate-600 text-slate-400 hover:text-white gap-1.5">
              <RefreshCw className={cn('w-3.5 h-3.5', isPending && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-6 bg-slate-800/50 rounded-full mb-4">
              <Beer className="w-16 h-16 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-400">Aucune commande bar</h2>
            <p className="text-slate-600 text-sm mt-2">
              Les commandes de boissons apparaîtront ici
            </p>
            <p className="text-xs text-slate-700 mt-1">
              Astuce : les produits doivent avoir une catégorie contenant &quot;BAR&quot; ou &quot;BOISSON&quot;
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-col rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
                  <span className="font-mono font-bold text-white text-sm">
                    #{order.id.slice(-6).toUpperCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {order.table_number ? `Table ${order.table_number}` : order.phone || 'À emporter'}
                    </span>
                    <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] h-5">
                      {order.status === 'PENDING' ? 'NOUVEAU' : 'EN COURS'}
                    </Badge>
                  </div>
                </div>
                <div className="flex-1 p-4 space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-bold">
                        {item.quantity}
                      </span>
                      <span className="text-slate-200 text-sm">{item.product_name}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <Button onClick={() => handleReady(order.id)} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Servi
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
