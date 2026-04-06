'use client';

import { getActivePromotionsForClient, validatePromoCode } from '@/app/actions/promotions';
import { Tag, Check, X, Trash2, Plus, Minus, Loader2, UtensilsCrossed, Bed, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatFCFA } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/cart-store';
import { createClientOrder } from '@/app/actions/client-orders';

export default function CartPage() {
  const { items, structureId, updateQuantity, removeItem, getTotal, clearCart } = useCartStore();
  const [deliveryMode, setDeliveryMode] = useState<'TABLE' | 'ROOM' | 'TAKEAWAY'>('TABLE');
  const [roomId, setRoomId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const router = useRouter();

  const [autoPromos, setAutoPromos] = useState<any[]>([]);

  useEffect(() => {
    if (structureId) {
      supabase.from('rooms').select('*').eq('structure_id', structureId)
        .order('number', { ascending: true })
        .then(({ data }) => setRooms(data || []));

      // Fetch active automatic promotions via server action (bypass RLS)
      getActivePromotionsForClient(structureId)
        .then((data) => {
           console.log('Cart: Fetched promos via server action', data);
           // server action already filters for activity and dates
           setAutoPromos(data || []);
        });
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

  const handleApplyPromo = async () => {
    if (!promoCode || !structureId) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await validatePromoCode(promoCode, structureId);
      if (res.valid) {
        setAppliedPromo(res);
        toast.success('Code promo appliqué !');
      } else {
        setPromoError(res.error || 'Code invalide');
        setAppliedPromo(null);
      }
    } catch (err) {
      setPromoError('Erreur de validation');
    } finally {
      setPromoLoading(false);
    }
  };

  const getDiscount = () => {
    const baseSubtotal = getTotal();
    let runningSubtotal = 0;
    
    // Combine automatic promos and the applied manual code
    const promosToCalculate = [...autoPromos];
    if (appliedPromo) {
      promosToCalculate.push(appliedPromo);
    }

    // 1. Pass 1: Apply PRODUCT-level promotions
    for (const item of items) {
      const accTotal = item.selectedAccompaniments?.reduce((s, a) => s + (a.price * a.quantity), 0) || 0;
      let itemPriceWithPromo = item.price * item.quantity;
      
      const productPromos = promosToCalculate.filter(p => {
        const promoProdId = p.productId || p.product_id;
        // Case-insensitive/robust comparison
        const isMatch = promoProdId && item.productId && promoProdId.toString().toLowerCase() === item.productId.toString().toLowerCase();
        return (p.scope === 'PRODUCT' || p.promo_mode === 'BUY_X_GET_Y') && isMatch;
      });
      
      for (const promo of productPromos) {
        if (promo.promo_mode === 'BUY_X_GET_Y') {
          const x = promo.required_qty || 1;
          const y = promo.free_qty || 0;
          const quantity = item.quantity || 0;
          
          let freeUnits = 0;
          if (promo.is_cumulative !== false) {
            freeUnits = Math.floor(quantity / x) * y;
          } else if (quantity >= x) {
            freeUnits = y;
          }
          // The discount for BOGO 'Auto-Complete' is 0 in the cart total 
          // because item.quantity represents the PAID units. 
          // The system adds '+1 free' as extra items for the kitchen.
          itemPriceWithPromo -= 0; 
        } else {
          if (promo.type === 'PERCENTAGE') {
            itemPriceWithPromo *= (1 - (promo.value || 0) / 100);
          } else {
            itemPriceWithPromo = Math.max(0, itemPriceWithPromo - ((promo.value || 0) * (item.quantity || 0)));
          }
        }
      }
      // Add this item's discounted price + its accompaniments to the running subtotal
      runningSubtotal += (itemPriceWithPromo + (accTotal * item.quantity));
    }

    // 2. Pass 2: Apply ORDER-level promotions
    const orderPromos = promosToCalculate.filter(p => p.scope === 'ORDER');
    for (const promo of orderPromos) {
      if (runningSubtotal >= (promo.minOrderAmount || promo.min_order_amount || 0)) {
        if (promo.type === 'PERCENTAGE') {
          runningSubtotal *= (1 - (promo.value || 0) / 100);
        } else {
          runningSubtotal = Math.max(0, runningSubtotal - (promo.value || 0));
        }
      }
    }

    return baseSubtotal - runningSubtotal;
  };

  const handleCheckout = async () => {
    if (!structureId) return;
    if (!phone) {
      toast.error('Le numéro de téléphone est obligatoire.');
      return;
    }

    setLoading(true);
    const result = await createClientOrder(structureId, items, {
      roomId: deliveryMode === 'ROOM' ? roomId : undefined,
      tableNumber: deliveryMode === 'TABLE' ? tableNumber : undefined,
      phone,
      promoCode: appliedPromo ? promoCode : undefined
    });

    if (result.success) {
      toast.success('Commande confirmée !');
      clearCart();
      // On success, redirecting to a fake success page or home
      router.push('/client');
    } else {
      toast.error(result.error || 'Erreur lors de la commande');
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Votre Panier</h1>

      <div className="space-y-4">
        {items.map(item => {
          // Search for any promo mode including BOGO - robust ID match
          const itemPromo = autoPromos.find(p => {
            const promoProdId = p.product_id || p.productId;
            return promoProdId && item.productId && promoProdId.toString().toLowerCase() === item.productId.toString().toLowerCase();
          });
          
          let freeUnitsCount = 0;
          if (itemPromo && itemPromo.promo_mode === 'BUY_X_GET_Y') {
            const x = Number(itemPromo.required_qty || 1);
            const y = Number(itemPromo.free_qty || 0);
            const isCumulative = itemPromo.is_cumulative !== false;
            
            if (isCumulative) {
              freeUnitsCount = Math.floor(item.quantity / x) * y;
            } else if (item.quantity >= x) {
              freeUnitsCount = y;
            }
          }

          return (
            <div key={item.id} className="relative flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate flex items-center gap-2">
                  {item.name}
                  {freeUnitsCount > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse font-bold">
                      +{freeUnitsCount} OFFERT{freeUnitsCount > 1 ? 'S' : ''}
                    </span>
                  )}
                </h3>
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

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-black font-bold">-</button>
                    <span className="w-8 text-center font-bold">
                      {item.quantity}
                    </span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-black font-bold">+</button>
                  </div>
                  {freeUnitsCount > 0 && (
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 flex flex-col items-center leading-tight">
                       <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">Total</span>
                       <span className="text-sm font-black">{item.quantity + freeUnitsCount} unités</span>
                    </div>
                  )}
                </div>
                <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-2 ml-auto">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mt-8 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-500 font-medium">Sous-total</span>
          <span className="text-lg font-semibold text-slate-800">{formatFCFA(getTotal())}</span>
        </div>

        {getDiscount() > 0 && (
           <div className="flex justify-between items-center mb-4 text-emerald-600 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
             <div className="flex items-center gap-2">
               <Tag className="w-4 h-4" />
               <span className="text-sm font-semibold italic">Remise totale</span>
             </div>
             <span className="font-bold">- {formatFCFA(getDiscount())}</span>
           </div>
        )}

        {appliedPromo && (
          <div className="text-[11px] text-blue-600 font-medium bg-blue-50/50 px-2 py-1 rounded inline-block mb-2">
             Code "{appliedPromo.code_name || promoCode.toUpperCase()}" actif : {appliedPromo.value}{appliedPromo.type === 'PERCENTAGE' ? '%' : ' FCFA'} de remise {appliedPromo.scope === 'PRODUCT' ? 'sur le produit' : ''}
          </div>
        )}

        {/* Promo Code Input */}
        <div className="pt-2 pb-4">
           <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Code Promo"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                disabled={!!appliedPromo}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {!appliedPromo ? (
                <button 
                  onClick={handleApplyPromo}
                  disabled={promoLoading || !promoCode}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-50"
                 >
                  {promoLoading ? '...' : 'Appliquer'}
                </button>
              ) : (
                <button 
                  onClick={() => { setAppliedPromo(null); setPromoCode(''); }}
                  className="bg-red-50 text-red-500 p-2 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
           </div>
           {promoError && <p className="text-[10px] text-red-500 mt-1 ml-1">{promoError}</p>}
        </div>

        <div className="flex justify-between items-center mb-4 border-t border-slate-200 pt-4">
          <span className="text-slate-900 font-bold">Total Final</span>
          <span className="text-2xl font-bold text-slate-900">{formatFCFA(Math.max(0, getTotal() - getDiscount()))}</span>
        </div>

        <div className="space-y-4 border-t border-slate-200 pt-6">
          <h3 className="font-semibold text-slate-800">Mode de livraison</h3>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setDeliveryMode('TABLE')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${deliveryMode === 'TABLE' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
              <UtensilsCrossed className="w-5 h-5" />
              <span className="text-xs font-semibold">Sur place</span>
            </button>
            <button
              onClick={() => setDeliveryMode('ROOM')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${deliveryMode === 'ROOM' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
              <Bed className="w-5 h-5" />
              <span className="text-xs font-semibold">En chambre</span>
            </button>
            <button
              onClick={() => setDeliveryMode('TAKEAWAY')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${deliveryMode === 'TAKEAWAY' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
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

            <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
              <label className="text-sm font-medium text-slate-700 block">Numéro de téléphone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 06 12 34 56 78"
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
              <p className="text-xs text-slate-500">Requis pour vous contacter en cas de besoin concernant votre commande.</p>
            </div>
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
            `Valider ma commande (${formatFCFA(Math.max(0, getTotal() - getDiscount()))})`
          )}
        </button>
      </div>
    </div>
  );
}
