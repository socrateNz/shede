'use client';

import { useCartStore } from '@/lib/cart-store';
import { createClientOrder } from '@/app/actions/client-orders';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Trash2, Loader2, UtensilsCrossed, Bed, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatFCFA } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function CartPage() {
  const { items, structureId, updateQuantity, removeItem, getTotal, clearCart } = useCartStore();
  const [deliveryMode, setDeliveryMode] = useState<'TABLE'|'ROOM'|'TAKEAWAY'>('TABLE');
  const [roomId, setRoomId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (structureId) {
      supabase.from('rooms').select('*').eq('structure_id', structureId)
        .order('number', { ascending: true })
        .then(({ data }) => setRooms(data || []));
    }
  }, [structureId]);

  if (items.length === 0) {
    return (
      <div className="p-8 text-center max-w-xl mx-auto mt-12 bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Votre panier est vide</h2>
        <p className="text-slate-500">Ajoutez des produits pour passer commande.</p>
      </div>
    );
  }

  const handleCheckout = async () => {
    if (!structureId) return;

    setLoading(true);
    const result = await createClientOrder(structureId, items, { 
       roomId: deliveryMode === 'ROOM' ? roomId : undefined,
       tableNumber: deliveryMode === 'TABLE' ? tableNumber : undefined 
    });
    
    if (result.success) {
      toast.success('Commande confirmée !');
      clearCart();
      // On success, redirecting to a fake success page or home
      router.push('/');
    } else {
      toast.error(result.error || 'Erreur lors de la commande');
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Votre Panier</h1>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{item.name}</h3>
              <p className="text-blue-600 font-medium pb-2">{formatFCFA(item.price)}</p>
              
              {item.selectedAccompaniments && item.selectedAccompaniments.length > 0 && (
                <div className="mt-1 mb-3 space-y-1">
                  {item.selectedAccompaniments.map((acc, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-500 bg-slate-50 p-1.5 rounded">
                      <span>{acc.quantity}x {acc.name}</span>
                      <span>{formatFCFA(acc.price * acc.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex items-center bg-slate-100 rounded-lg">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 text-slate-600 hover:text-black">-</button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 text-slate-600 hover:text-black">+</button>
                </div>
                <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-600 p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mt-8 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-500 font-medium">Total</span>
          <span className="text-2xl font-bold text-slate-900">{formatFCFA(getTotal())}</span>
        </div>

        <div className="space-y-4 border-t border-slate-200 pt-6">
          <h3 className="font-semibold text-slate-800">Mode de livraison</h3>
          
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setDeliveryMode('TABLE')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                deliveryMode === 'TABLE' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
               <UtensilsCrossed className="w-5 h-5" />
               <span className="text-xs font-semibold">Sur place</span>
            </button>
            <button
              onClick={() => setDeliveryMode('ROOM')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                deliveryMode === 'ROOM' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
               <Bed className="w-5 h-5" />
               <span className="text-xs font-semibold">En chambre</span>
            </button>
            <button
              onClick={() => setDeliveryMode('TAKEAWAY')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                deliveryMode === 'TAKEAWAY' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
               <ShoppingBag className="w-5 h-5" />
               <span className="text-xs font-semibold">À emporter</span>
            </button>
          </div>

          <div className="mt-4">
             {deliveryMode === 'TABLE' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">Numéro de table *</label>
                  <input 
                    type="number" 
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ex: 12" 
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
             )}
             {deliveryMode === 'ROOM' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">Sélectionnez votre chambre *</label>
                  <select
                     value={roomId}
                     onChange={(e) => setRoomId(e.target.value)}
                     className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  >
                     <option value="">Sélectionner une chambre...</option>
                     {rooms.map((r: any) => (
                        <option key={r.id} value={r.id}>Chambre {r.number}</option>
                     ))}
                  </select>
                  {rooms.length === 0 && <p className="text-xs text-red-500">Aucune chambre disponible pour cet établissement.</p>}
                </div>
             )}
          </div>
        </div>

        <button 
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Envoi...</>
          ) : (
            `Valider ma commande (${formatFCFA(getTotal())})`
          )}
        </button>
      </div>
    </div>
  );
}
