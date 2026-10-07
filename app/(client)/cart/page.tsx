'use client';

import { getActivePromotionsForClient, validatePromoCode } from '@/app/actions/promotions';
import { Tag, Check, X, Trash2, Plus, Minus, Loader2, UtensilsCrossed, Bed, ShoppingBag, Truck, Clock, Shield, Bike, MapPin, LocateFixed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/cart-store';
import { createClientOrder } from '@/app/actions/client-orders';
import { getDeliveryOptions } from '@/app/actions/delivery';
import { computeTax, toTaxSettings, type TaxSettings } from '@/lib/tax';
import { normalizeCameroonPhone } from '@/lib/phone';
import { useT } from '@/lib/i18n/client';

export default function CartPage() {
  const { items, structureId, updateQuantity, removeItem, getTotal, clearCart } = useCartStore();
  const [deliveryMode, setDeliveryMode] = useState<'TABLE' | 'ROOM' | 'TAKEAWAY' | 'DELIVERY'>('TABLE');
  const [deliveryZones, setDeliveryZones] = useState<{ id: string; name: string; fee: number }[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [district, setDistrict] = useState('');
  const [landmark, setLandmark] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({ rate: 0, pricesIncludeTax: true });
  const [roomId, setRoomId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [isScannedTable, setIsScannedTable] = useState(false);
  const [phone, setPhone] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [takeawayFee, setTakeawayFee] = useState(0);
  const [tableId, setTableId] = useState('');
  const router = useRouter();
  const { t, format } = useT();
  const formatFCFA = (value: number) => format.money(value);

  const [autoPromos, setAutoPromos] = useState<any[]>([]);

  useEffect(() => {
    const scannedTableId = sessionStorage.getItem('scannedTableId');
    const scannedTableName = sessionStorage.getItem('scannedTableName');
    
    if (scannedTableId && scannedTableName) {
      setTableId(scannedTableId);
      setTableNumber(scannedTableName);
      setDeliveryMode('TABLE');
      setIsScannedTable(true);
    }

    if (structureId) {
      supabase.from('rooms').select('*').eq('structure_id', structureId)
        .order('number', { ascending: true })
        .then(({ data }) => setRooms(data || []));

      // select('*') : les colonnes fiscales n'existent qu'après docs/phase9-fiscal.sql.
      supabase.from('structures').select('*').eq('id', structureId).single()
        .then(({ data }) => {
          setTakeawayFee(Number(data?.takeaway_fee || 0));
          setTaxSettings(toTaxSettings(data));
        });

      getDeliveryOptions(structureId).then((options) => setDeliveryZones(options.zones));

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
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('client.cart.emptyTitle')}</h2>
          <p className="text-slate-500 mb-6">{t('client.cart.emptyText')}</p>
          <button
            onClick={() => router.push('/client')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            {t('client.cart.discover')}
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
        toast.success(t('client.cart.promoApplied'));
      } else {
        setPromoError(res.error || t('client.cart.promoInvalid'));
        setAppliedPromo(null);
      }
    } catch (err) {
      setPromoError(t('client.cart.promoError'));
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
      toast.error(t('client.cart.phoneRequired'));
      return;
    }
    if (deliveryMode === 'DELIVERY') {
      if (!zoneId) {
        toast.error(t('client.cart.zoneRequired'));
        return;
      }
      if (landmark.trim().length < 3) {
        toast.error(t('client.cart.landmarkRequired'));
        return;
      }
      if (!normalizeCameroonPhone(phone)) {
        toast.error(t('client.cart.phoneInvalid'));
        return;
      }
    }

    setLoading(true);
    const result = await createClientOrder(structureId, items, {
      roomId: deliveryMode === 'ROOM' ? roomId : undefined,
      tableNumber: deliveryMode === 'TABLE' ? tableNumber : undefined,
      tableId: deliveryMode === 'TABLE' && tableId ? tableId : undefined,
      consumptionType: deliveryMode === 'TAKEAWAY' ? 'TAKEAWAY' : deliveryMode === 'DELIVERY' ? 'DELIVERY' : 'DINE_IN',
      phone,
      delivery: deliveryMode === 'DELIVERY'
        ? { zoneId, district, landmark, lat: position?.lat, lng: position?.lng }
        : undefined,
      promoCode: appliedPromo ? promoCode : undefined
    });

    if (result.success) {
      toast.success(t('client.cart.orderConfirmed'));
      clearCart();
      router.push('/client');
    } else {
      toast.error(result.error || t('client.cart.orderError'));
    }
    setLoading(false);
  };

  const selectedZone = deliveryZones.find((z) => z.id === zoneId);
  // Livraison : produits du panier qui ne peuvent pas être livrés (le serveur vérifie aussi).
  const undeliverableNames =
    deliveryMode === 'DELIVERY' ? [...new Set(items.filter((i) => i.isDeliverable === false).map((i) => i.name))] : [];
  const deliveryFee = deliveryMode === 'DELIVERY' ? selectedZone?.fee ?? 0 : 0;
  // Estimation : le montant définitif est recalculé par le serveur.
  const taxedTotal = computeTax(
    Math.max(0, getTotal() - getDiscount()) + (deliveryMode === 'TAKEAWAY' ? takeawayFee : 0) + deliveryFee,
    taxSettings
  );
  const finalTotal = taxedTotal.total;
  const addedTax = taxSettings.pricesIncludeTax ? 0 : taxedTotal.tax;

  const sharePosition = () => {
    if (!navigator.geolocation) {
      toast.error(t('client.cart.geoUnavailable'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success(t('client.cart.geoShared'));
      },
      () => {
        setLocating(false);
        toast.error(t('client.cart.geoFailed'));
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{t('client.cart.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('client.cart.items', { count: items.length })}</p>
          </div>
          <button
            onClick={() => clearCart()}
            className="text-red-500 hover:text-red-600 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('client.cart.clear')}
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
                      {/* Product Image */}
                      {item.image_url ? (
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-slate-100">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-100">
                          <UtensilsCrossed className="w-8 h-8 text-blue-500 opacity-50" />
                        </div>
                      )}

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
                                <span className="text-emerald-600 text-xs font-bold">{t('client.cart.free', { count: freeUnitsCount })}</span>
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
                  {t('client.cart.summary')}
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('client.cart.subtotal')}</span>
                    <span className="font-medium">{formatFCFA(getTotal())}</span>
                  </div>

                  {getDiscount() > 0 && (
                    <div className="flex justify-between text-emerald-600 bg-emerald-50/50 p-2 rounded-lg">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {t('client.cart.discount')}
                      </span>
                      <span className="font-bold">- {formatFCFA(getDiscount())}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{t('client.cart.total')}</span>
                    <span className="text-2xl font-bold text-blue-600">{formatFCFA(finalTotal)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{t('client.cart.taxIncluded')}</p>
                </div>

                {/* Code promo */}
                <div className="pt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('client.cart.promoPlaceholder')}
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
                        {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('client.cart.apply')}
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
                      {t('client.cart.codeApplied', { code: appliedPromo.code_name })}
                    </p>
                  )}
                </div>
              </div>

              {/* Frais À emporter */}
              {deliveryMode === 'TAKEAWAY' && takeawayFee > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800">
                    <ShoppingBag className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold">{t('client.cart.packagingFee')}</span>
                  </div>
                  <span className="font-bold text-slate-800">+{formatFCFA(takeawayFee)}</span>
                </div>
              )}

              {undeliverableNames.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {t('client.cart.undeliverable', { names: undeliverableNames.join(', ') })}
                </div>
              )}

              {/* Frais de livraison */}
              {deliveryMode === 'DELIVERY' && selectedZone && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Bike className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold">{t('client.cart.deliveryFee', { zone: selectedZone.name })}</span>
                  </div>
                  <span className="font-bold text-slate-800">+{formatFCFA(selectedZone.fee)}</span>
                </div>
              )}

              {/* TVA ajoutée (points en prix HT) */}
              {addedTax > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{t('client.cart.vat', { rate: taxSettings.rate })}</span>
                  <span className="font-bold text-slate-800">+{formatFCFA(addedTax)}</span>
                </div>
              )}

              {/* Mode de livraison */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  {t('client.cart.modeTitle')}
                </h3>

                {isScannedTable ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-orange-800">{t('client.cart.onSite')}</span>
                      <span className="text-xs text-orange-600 font-medium mt-1">{t('client.cart.tableLabel', { table: tableNumber })}</span>
                    </div>
                    <UtensilsCrossed className="w-8 h-8 text-orange-400 opacity-50" />
                  </div>
                ) : (
                  <>
                    <div className={`grid gap-2 ${deliveryZones.length > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                      {[
                        { mode: 'TABLE' as const, icon: UtensilsCrossed, label: t('client.cart.modeTable'), color: 'orange' },
                        { mode: 'ROOM' as const, icon: Bed, label: t('client.cart.modeRoom'), color: 'purple' },
                        { mode: 'TAKEAWAY' as const, icon: ShoppingBag, label: t('client.cart.modeTakeaway'), color: 'blue' },
                        ...(deliveryZones.length > 0
                          ? [{ mode: 'DELIVERY' as const, icon: Bike, label: t('client.cart.modeDelivery'), color: 'emerald' }]
                          : []),
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
                        <label className="text-sm font-medium text-slate-700">{t('client.cart.tableNumber')}</label>
                        <input
                          type="text"
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder={t('client.cart.tablePlaceholder')}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                        />
                      </div>
                    )}
                  </>
                )}

                {deliveryMode === 'ROOM' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{t('client.cart.room')}</label>
                    <select
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="">{t('client.cart.selectRoom')}</option>
                      {rooms.map((r: any) => (
                        <option key={r.id} value={r.id}>{t('client.cart.roomOption', { number: r.number })}</option>
                      ))}
                    </select>
                  </div>
                )}

                {deliveryMode === 'DELIVERY' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="delivery-zone" className="text-sm font-medium text-slate-700">{t('client.cart.zone')}</label>
                      <select
                        id="delivery-zone"
                        value={zoneId}
                        onChange={(e) => setZoneId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      >
                        <option value="">{t('client.cart.selectZone')}</option>
                        {deliveryZones.map((z) => (
                          <option key={z.id} value={z.id}>{z.name} — {formatFCFA(z.fee)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="delivery-district" className="text-sm font-medium text-slate-700">{t('client.cart.district')}</label>
                      <input
                        id="delivery-district"
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder={t('client.cart.districtPlaceholder')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="delivery-landmark" className="text-sm font-medium text-slate-700">{t('client.cart.landmark')}</label>
                      <textarea
                        id="delivery-landmark"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        rows={2}
                        placeholder={t('client.cart.landmarkPlaceholder')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={sharePosition}
                      disabled={locating}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${position ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : position ? <MapPin className="w-4 h-4" /> : <LocateFixed className="w-4 h-4" />}
                      {position ? t('client.cart.positionShared') : t('client.cart.sharePosition')}
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t('client.cart.phone')}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('client.cart.phonePlaceholder')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t('client.cart.phoneHint')}
                  </p>
                </div>
              </div>

              {/* Bouton de validation */}
              <button
                onClick={handleCheckout}
                disabled={loading || undeliverableNames.length > 0}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl py-4 font-bold text-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {t('client.cart.processing')}</>
                ) : (
                  <>{t('client.cart.submit', { amount: formatFCFA(finalTotal) })}</>
                )}
              </button>

              {/* Information de confiance */}
              <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {t('client.cart.securePayment')}
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <div>{t('client.cart.fastDelivery')}</div>
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <div>{t('client.cart.support')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}