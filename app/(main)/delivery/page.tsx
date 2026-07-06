import { requireRole } from '@/app/actions/auth';
import { Truck, Clock, MapPin, Phone, ShoppingCart } from 'lucide-react';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Livraisons — Shede',
  description: 'Gestion des livraisons',
};

export default async function DeliveryPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'LIVREUR');

  const admin = getAdminSupabase();
  const { data: orders } = await admin
    .from('orders')
    .select('id, table_number, phone, status, total, created_at, notes')
    .eq('structure_id', session.structureId!)
    .not('phone', 'is', null)
    .in('status', ['PENDING', 'IN_PROGRESS', 'READY'])
    .order('created_at', { ascending: true });

  const deliveryOrders = orders || [];

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING:     { label: 'En attente',    color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
    IN_PROGRESS: { label: 'En préparation', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
    READY:       { label: 'Prêt',           color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 rounded-xl">
            <Truck className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Livraisons</h1>
            <p className="text-slate-400">Commandes en cours de livraison</p>
          </div>
          {deliveryOrders.length > 0 && (
            <Badge className="ml-auto bg-cyan-500/10 border-cyan-500/30 text-cyan-400 text-sm px-3 py-1">
              {deliveryOrders.length} active{deliveryOrders.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {deliveryOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-6 bg-slate-800/50 rounded-full mb-4">
              <Truck className="w-16 h-16 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-400">Aucune livraison active</h2>
            <p className="text-slate-600 text-sm mt-2">
              Les commandes avec numéro de téléphone apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveryOrders.map((order) => {
              const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
              return (
                <Card key={order.id} className="bg-slate-800/50 border-slate-700/50 shadow-xl hover:border-cyan-500/30 transition-colors">
                  <CardHeader className="border-b border-slate-700/50 pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="font-mono text-white">#{order.id.slice(-8).toUpperCase()}</span>
                      <Badge variant="outline" className={`text-xs ${statusConf.color}`}>
                        {statusConf.label}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {order.phone && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-sm font-medium">{order.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-400">
                      <ShoppingCart className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{Number(order.total).toLocaleString('fr-FR')} XOF</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span className="text-xs">
                        {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {order.notes && (
                      <p className="text-xs text-slate-500 italic bg-slate-700/30 px-2 py-1 rounded">
                        📋 {order.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-12 p-4 border border-cyan-500/10 rounded-xl bg-cyan-500/5 text-center">
          <p className="text-xs text-slate-500">
            Module Livraisons — Phase 2 incluira : assignation livreur, suivi GPS, zones de livraison
          </p>
        </div>
      </div>
    </div>
  );
}
