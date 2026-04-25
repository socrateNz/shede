'use client';

import { getActivePromotionsForClient, validatePromoCode } from '@/app/actions/promotions';
import { Tag, Check, X, Trash2, Plus, Minus, Loader2, UtensilsCrossed, Bed, ShoppingBag, Truck, Clock, Shield, Sparkles } from 'lucide-react';
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

      getActivePromotionsForClient(structureId)
        .then((data) => {
          console.log('Cart: Fetched promos via server action', data);
          setAutoPromos(data || []);
        });
    }
  }, [structureId]);

  if (items.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
            <div className="relative bg-gradient-to-br from-slate-100 to-white rounded-full p-6 shadow-xl">
              <ShoppingBag className="w-16 h-16 text-slate-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Votre panier est vide</h2>
          <p className="text-slate-500 mb-6">Ajoutez des produits pour passer commande.</p>
          <button
            onClick={() => router.push('/client')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            Découvrir les établissements
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
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

    const promosToCalculate = [...autoPromos];
    if (appliedPromo) {
      promosToCalculate.push(appliedPromo);
    }

    for (const item of items) {
      const accTotal = item.selectedAccompaniments?.reduce((s, a) => s + (a.price * a.quantity), 0) || 0;
      let itemPriceWithPromo = item.price * item.quantity;

      const productPromos = promosToCalculate.filter(p => {
        const promoProdId = p.productId || p.product_id;
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
          itemPriceWithPromo -= 0;
        } else {
          if (promo.type === 'PERCENTAGE') {
            itemPriceWithPromo *= (1 - (promo.value || 0) / 100);
          } else {
            itemPriceWithPromo = Math.max(0, itemPriceWithPromo - ((promo.value || 0) * (item.quantity || 0)));
          }
        }
      }
      runningSubtotal += (itemPriceWithPromo + (accTotal * item.quantity));
    }

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
      router.push('/client');
    } else {
      toast.error(result.error || 'Erreur lors de la commande');
    }
    setLoading(false);
  };

  const finalTotal = Math.max(0, getTotal() - getDiscount());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Votre Panier</h1>
            <p className="text-slate-500 text-sm mt-1">{items.length} article{items.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => clearCart()}
            className="text-red-500 hover:text-red-600 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Vider
          </button>
        </div>

        {/* Grille principale */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Colonne gauche - Articles */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, idx) => {
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
                <div
                  key={item.id}
                  className="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="p-4">
                    <div className="flex gap-4">
                      {/* Image placeholder */}
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <UtensilsCrossed className="w-8 h-8 text-blue-500" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                            <p className="text-blue-600 font-semibold text-sm mt-0.5">{formatFCFA(item.price)}</p>
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Accompagnements */}
                        {item.selectedAccompaniments && item.selectedAccompaniments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.selectedAccompaniments.map((acc, accIdx) => (
                              <div key={accIdx} className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                <span className="text-slate-600">{acc.quantity}x {acc.name}</span>
                                <span className="text-slate-400 ml-auto">{formatFCFA(acc.price * acc.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quantité et promotion */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {freeUnitsCount > 0 && (
                              <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg">
                                <span className="text-emerald-600 text-xs font-bold">+{freeUnitsCount} OFFERT</span>
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-slate-800">{formatFCFA(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Colonne droite - Récapitulatif */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Récapitulatif des prix */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 space-y-4">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-600" />
                  Récapitulatif
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Sous-total</span>
                    <span className="font-medium">{formatFCFA(getTotal())}</span>
                  </div>

                  {getDiscount() > 0 && (
                    <div className="flex justify-between text-emerald-600 bg-emerald-50/50 p-2 rounded-lg">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Réduction
                      </span>
                      <span className="font-bold">- {formatFCFA(getDiscount())}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Total</span>
                    <span className="text-2xl font-bold text-blue-600">{formatFCFA(finalTotal)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">TTC - TVA incluse</p>
                </div>

                {/* Code promo */}
                <div className="pt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Code promo"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      disabled={!!appliedPromo}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    />
                    {!appliedPromo ? (
                      <button
                        onClick={handleApplyPromo}
                        disabled={promoLoading || !promoCode}
                        className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all disabled:opacity-50"
                      >
                        {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setAppliedPromo(null); setPromoCode(''); }}
                        className="bg-red-50 text-red-500 px-3 py-2 rounded-xl hover:bg-red-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {promoError && <p className="text-xs text-red-500 mt-1">{promoError}</p>}
                  {appliedPromo && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Code {appliedPromo.code_name} appliqué !
                    </p>
                  )}
                </div>
              </div>

              {/* Mode de livraison */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  Livraison
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mode: 'TABLE' as const, icon: UtensilsCrossed, label: 'Sur place', color: 'orange' },
                    { mode: 'ROOM' as const, icon: Bed, label: 'En chambre', color: 'purple' },
                    { mode: 'TAKEAWAY' as const, icon: ShoppingBag, label: 'À emporter', color: 'blue' },
                  ].map(({ mode, icon: Icon, label, color }) => (
                    <button
                      key={mode}
                      onClick={() => setDeliveryMode(mode)}
                      className={`p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1 ${deliveryMode === mode
                          ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <Icon className={`w-4 h-4 ${deliveryMode === mode ? `text-${color}-600` : ''}`} />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Champs spécifiques */}
                {deliveryMode === 'TABLE' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Numéro de table</label>
                    <input
                      type="number"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="Ex: 12"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                  </div>
                )}

                {deliveryMode === 'ROOM' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Chambre</label>
                    <select
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="">Sélectionner une chambre</option>
                      {rooms.map((r: any) => (
                        <option key={r.id} value={r.id}>Chambre {r.number}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Téléphone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 06 12 34 56 78"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Requis pour vous contacter
                  </p>
                </div>
              </div>

              {/* Bouton de validation */}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl py-4 font-bold text-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Traitement...</>
                ) : (
                  <>Valider la commande • {formatFCFA(finalTotal)}</>
                )}
              </button>

              {/* Information de confiance */}
              <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Paiement sécurisé
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <div>Livraison rapide</div>
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <div>Service client 24/7</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}