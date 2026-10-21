'use client';

import { createOrderWithItems } from '@/app/actions/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronDown, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { CategoryFilterBar } from '@/components/category-filter-bar';
import { productInCategory } from '@/lib/category-tree';

interface OrderProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  categoryIds?: string[];
  isDeliverable?: boolean;
  /** Unités encore commandables ; null/absent = pas suivi en stock. */
  stock?: number | null;
}

type AccompanimentOption = {
  accompanimentId: string;
  name: string;
  unitPrice: number;
  quantityMultiplier: number;
  stock?: number | null;
};

type SelectedAccompaniment = {
  accompanimentId: string;
  priceCounted: boolean;
};

interface SelectedItem {
  productId: string;
  quantity: number;
  accompaniments: SelectedAccompaniment[];
}

/** Recherche sans accents ni majuscules (« ndole » trouve « Ndolé »). */
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function NewOrderForm({
  products,
  accompanimentsByProductId,
  rooms,
  promotions = [],
  clients = [],
  tables = [],
  deliveryZones = [],
  categories = [],
}: {
  products: OrderProduct[];
  /** Catégories actives du point, dans l'ordre du menu. */
  categories?: { id: string; name: string; parent_id: string | null }[];
  accompanimentsByProductId: Record<string, AccompanimentOption[]>;
  rooms: { id: string; number: string }[];
  promotions?: any[];
  clients?: any[];
  tables?: any[];
  /** Zones de livraison actives (module LIVRAISON) ; vide = pas de livraison. */
  deliveryZones?: { id: string; name: string; fee: number }[];
}) {
  const [isDelivery, setIsDelivery] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { t, format } = useT();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createOrderWithItems, {
    success: false,
    error: '',
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [selectedPromotionId, setSelectedPromotionId] = useState('');

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = productsById.get(item.productId);
      if (!product) return sum;

      let lineTotal = product.price * item.quantity;

      // Ajoute les accompagnements dont le prix est compté.
      const possibleAccs = accompanimentsByProductId[item.productId] || [];
      for (const selectedAcc of item.accompaniments) {
        if (!selectedAcc.priceCounted) continue;
        const opt = possibleAccs.find((a) => a.accompanimentId === selectedAcc.accompanimentId);
        if (!opt) continue;
        lineTotal += opt.unitPrice * item.quantity * opt.quantityMultiplier;
      }

      return sum + lineTotal;
    }, 0);
  }, [items, productsById, accompanimentsByProductId]);

  const discount = useMemo(() => {
    if (!selectedPromotionId && !promoCode) return 0;
    const promo = promotions?.find((p: any) => p.id === selectedPromotionId);
    if (!promo) return 0;

    let d = 0;
    if (promo.scope === 'ORDER') {
       if (subtotal >= (promo.min_order_amount || 0)) {
          if (promo.type === 'PERCENTAGE') d = (subtotal * promo.value) / 100;
          else d = promo.value;
       }
    } else if (promo.scope === 'PRODUCT' && promo.product_id) {
       const productItem = items.find(it => it.productId === promo.product_id);
       if (productItem) {
          const product = productsById.get(promo.product_id);
          const lineTotal = (product?.price || 0) * productItem.quantity;
          if (promo.type === 'PERCENTAGE') d = (lineTotal * promo.value) / 100;
          else d = Math.min(promo.value, lineTotal);
       }
    }
    return d;
  }, [selectedPromotionId, promoCode, subtotal, items, promotions, productsById]);

  const total = Math.max(0, subtotal - discount);

  // Filtres : une catégorie inclut les produits de ses sous-catégories ; la recherche ignore accents et majuscules.
  const visibleProducts = useMemo(() => {
    const query = normalize(search.trim());
    return products.filter(
      (p) =>
        (!categoryFilter || productInCategory(p.categoryIds, categoryFilter, categories)) &&
        (!query || normalize(p.name).includes(query))
    );
  }, [products, categoryFilter, categories, search]);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // Commande à livrer : les produits non livrables bloquent l'envoi (vérifié aussi côté serveur).
  const undeliverableNames = isDelivery
    ? items.map((item) => productsById.get(item.productId)).filter((p) => p && p.isDeliverable === false).map((p) => p!.name)
    : [];

  const addItem = () => {
    if (!selectedProduct || quantity < 1) return;

    setItems((prev) => {
      const existing = prev.find((item) => item.productId === selectedProduct);
      if (existing) {
        return prev.map((item) =>
          item.productId === selectedProduct
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { productId: selectedProduct, quantity, accompaniments: [] }];
    });

    setSelectedProduct('');
    setQuantity(1);
  };

  const addItemDirect = (productId: string) => {
    const stock = productsById.get(productId)?.stock;
    if (stock === 0) return; // rupture : ne peut pas être commandé
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (stock != null && (existing?.quantity ?? 0) >= stock) return prev; // pas plus que le stock restant
      if (existing) {
        return prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId, quantity: 1, accompaniments: [] }];
    });
  };

  const decreaseItem = (productId: string) => {
    setItems((prev) =>
      prev.flatMap((item) =>
        item.productId !== productId ? [item] : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const toggleAccompanimentIncluded = (productId: string, accompanimentId: string, include: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        if (!include) {
          return {
            ...item,
            accompaniments: item.accompaniments.filter((a) => a.accompanimentId !== accompanimentId),
          };
        }

        const already = item.accompaniments.find((a) => a.accompanimentId === accompanimentId);
        if (already) return item;

        return {
          ...item,
          accompaniments: [...item.accompaniments, { accompanimentId, priceCounted: true }],
        };
      })
    );
  };

  const toggleAccompanimentPrice = (productId: string, accompanimentId: string, priceCounted: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        return {
          ...item,
          accompaniments: item.accompaniments.map((a) =>
            a.accompanimentId === accompanimentId ? { ...a, priceCounted } : a
          ),
        };
      })
    );
  };

  useEffect(() => {
    if (state.success && state.orderId) {
      router.push(`/orders/${state.orderId}`);
    }
  }, [state.success, state.orderId, router]);

  const labelClass = 'text-xs font-medium text-slate-300';
  const inputClass = 'h-9 bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500';
  const selectClass = 'w-full h-9 bg-slate-700 border border-slate-600 text-slate-50 rounded-md px-3 text-sm';

  return (
    <Card className="bg-slate-800 border-slate-700 w-full">
      <CardHeader>
        <CardTitle className="text-slate-50">{t('orders.create.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {/* L'essentiel sur une ligne ; le reste dans « Plus d'options » pour laisser la place au catalogue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>{t('orders.create.crmClient')}</label>
              <select name="clientId" className={selectClass}>
                <option value="">{t('orders.create.selectClient')}</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>{t('orders.create.phone')}</label>
              <Input
                type="tel"
                name="phone"
                placeholder={t('orders.create.phonePlaceholder')}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>{t('orders.create.table')}</label>
              <select name="tableId" className={selectClass}>
                <option value="">{t('orders.create.selectTable')}</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>{table.name} ({table.floor_name})</option>
                ))}
              </select>
            </div>
            {deliveryZones.length > 0 && (
              <label className="flex items-center gap-2 self-end h-9 rounded-md border border-slate-600 px-3 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDelivery"
                  value="true"
                  checked={isDelivery}
                  onChange={(e) => setIsDelivery(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="truncate" title={t('orders.create.isDelivery')}>{t('orders.create.isDeliveryShort')}</span>
              </label>
            )}
          </div>

          {deliveryZones.length > 0 && isDelivery && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-slate-600 p-3">
              <div className="space-y-1">
                <label htmlFor="deliveryZoneId" className={labelClass}>{t('orders.create.zone')}</label>
                <select id="deliveryZoneId" name="deliveryZoneId" required className={selectClass}>
                  <option value="">{t('orders.create.selectZone')}</option>
                  {deliveryZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {format.money(z.fee)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="deliveryDistrict" className={labelClass}>{t('orders.create.district')}</label>
                <Input
                  id="deliveryDistrict"
                  name="deliveryDistrict"
                  placeholder={t('orders.create.districtPlaceholder')}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="deliveryLandmark" className={labelClass}>{t('orders.create.landmark')}</label>
                <Input
                  id="deliveryLandmark"
                  name="deliveryLandmark"
                  required
                  placeholder={t('orders.create.landmarkPlaceholder')}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Champs occasionnels : repliés par défaut (ils restent envoyés avec le formulaire) */}
          <details className="group rounded-lg border border-slate-700">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-slate-50">
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              <span className="font-medium">{t('orders.create.moreOptions')}</span>
              <span className="truncate text-xs text-slate-500">{t('orders.create.moreOptionsHint')}</span>
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-700 p-3">
              <div className="space-y-1">
                <label className={labelClass}>{t('orders.create.room')}</label>
                <select name="roomId" className={selectClass}>
                  <option value="">{t('orders.create.selectRoom')}</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{t('orders.create.roomOption', { number: room.number })}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>{t('orders.create.freeTable')}</label>
                <Input
                  type="number"
                  name="tableNumber"
                  placeholder={t('orders.create.freeTablePlaceholder')}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClass}>{t('orders.create.notes')}</label>
                <Input
                  type="text"
                  name="notes"
                  placeholder={t('orders.create.notesPlaceholder')}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>{t('orders.create.manualPromo')}</label>
                <select
                  className={selectClass}
                  value={selectedPromotionId}
                  onChange={(e) => {
                    setSelectedPromotionId(e.target.value);
                    if (e.target.value) setPromoCode(''); // Clear code if manual selected
                  }}
                  name="promotionId"
                >
                  <option value="">{t('orders.create.noPromo')}</option>
                  {promotions.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === 'PERCENTAGE' ? `${p.value} %` : format.money(p.value)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>{t('orders.create.promoCode')}</label>
                <Input
                  placeholder={t('orders.create.promoCodePlaceholder')}
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    if (e.target.value) setSelectedPromotionId(''); // Clear manual if code entered
                  }}
                  name="promoCode"
                  className={`${inputClass} uppercase font-mono`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-400">{t('orders.create.tip')}</label>
                <Input
                  type="number"
                  name="tipAmount"
                  defaultValue={0}
                  min={0}
                  className="h-9 bg-slate-700 border-amber-500/50 text-slate-50 focus:border-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-red-400">{t('orders.create.manualDiscount')}</label>
                <Input
                  type="number"
                  name="discountAmount"
                  defaultValue={0}
                  min={0}
                  className="h-9 bg-slate-700 border-red-500/50 text-slate-50 focus:border-red-400"
                />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                <label className="text-xs font-medium text-red-400">{t('orders.create.discountReason')}</label>
                <Input
                  type="text"
                  name="discountReason"
                  placeholder={t('orders.create.discountReasonPlaceholder')}
                  className="h-9 bg-slate-700 border-red-500/50 text-slate-50 focus:border-red-400"
                />
              </div>
            </div>
          </details>

          {/* Catalogue à gauche, panier fixé à droite (sous le catalogue sur téléphone) */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
            <div className="rounded-lg border border-slate-700 p-4 space-y-3 bg-slate-800/50 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-slate-100 font-medium shrink-0">{t('orders.create.catalogue')}</p>
                <div className="relative sm:ml-auto sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      // Entrée : ajoute le produit s'il est le seul trouvé, sans envoyer le formulaire
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      if (visibleProducts.length === 1) {
                        addItemDirect(visibleProducts[0].id);
                        setSearch('');
                      }
                    }}
                    placeholder={t('orders.create.searchProduct')}
                    aria-label={t('orders.create.searchProduct')}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
              <CategoryFilterBar
                categories={categories}
                productCategoryIds={products.map((p) => p.categoryIds)}
                value={categoryFilter}
                onChange={setCategoryFilter}
                allLabel={t('orders.create.allCategories')}
              />

              {visibleProducts.length === 0 && search.trim() ? (
                <p className="py-8 text-center text-sm text-slate-400">{t('orders.create.noProductFound', { query: search.trim() })}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-130 lg:max-h-[calc(100vh-17rem)] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-600">
                  {visibleProducts.map((product) => {
                    const out = product.stock === 0;
                    const inCart = items.find((i) => i.productId === product.id)?.quantity ?? 0;
                    const maxed = !out && product.stock != null && inCart >= product.stock;
                    return (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => addItemDirect(product.id)}
                      disabled={out || maxed}
                      aria-label={out ? `${product.name} — ${t('common.stock.outLong')}` : undefined}
                      title={out ? t('common.stock.outLong') : maxed ? t('common.stock.maxReached', { count: product.stock! }) : undefined}
                      className={`relative text-left border rounded-xl overflow-hidden transition-all bg-slate-900 group ${
                        out
                          ? 'cursor-not-allowed border-slate-800 opacity-50 grayscale'
                          : maxed
                            ? 'cursor-not-allowed border-amber-500/40'
                            : inCart > 0
                              ? 'cursor-pointer border-blue-500'
                              : 'cursor-pointer border-slate-700 hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                      }`}
                    >
                      {inCart > 0 && (
                        <span className="absolute right-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white shadow">
                          {inCart}
                        </span>
                      )}
                      <div className="h-24 relative bg-slate-800/50">
                        {out && (
                          <span className="absolute left-2 top-2 z-10 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                            {t('common.stock.out')}
                          </span>
                        )}
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                            <Plus className="w-6 h-6 mb-1 opacity-50" />
                            <span className="text-[10px] uppercase tracking-wider">{product.category || t('orders.create.product')}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-sm font-semibold text-slate-200 truncate" title={product.name}>
                          {product.name}
                        </p>
                        <p className="text-xs text-blue-400 font-medium mt-0.5">
                          {format.money(product.price)}
                        </p>
                        {product.isDeliverable === false && (
                          <p className={`mt-1 text-[10px] ${isDelivery ? 'text-red-400' : 'text-amber-400'}`}>
                            {t('orders.create.notDeliverable')}
                          </p>
                        )}
                        {!out && product.stock != null && product.stock <= 5 && (
                          <p className="mt-1 text-[10px] font-semibold text-amber-400">
                            {maxed ? t('common.stock.maxReached', { count: product.stock }) : t('common.stock.left', { count: product.stock })}
                          </p>
                        )}
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:flex lg:flex-col">
              <p className="flex items-center justify-between text-slate-100 font-medium">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  {t('orders.create.cart')}
                </span>
                {cartCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{cartCount}</span>
                )}
              </p>

              <div className="space-y-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                {items.length === 0 ? (
                  <p className="text-slate-400 text-sm">{t('orders.create.cartEmptyHint')}</p>
                ) : (
                  items.map((item) => {
                    const product = productsById.get(item.productId);
                    if (!product) return null;
                    const lineTotal = product.price * item.quantity;
                    const possibleAccs = accompanimentsByProductId[item.productId] || [];
                    const maxed = product.stock != null && item.quantity >= product.stock;
                    return (
                      <div key={item.productId} className="rounded-lg bg-slate-700 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-50" title={product.name}>{product.name}</p>
                            <p className="text-xs text-slate-400">{format.money(product.price)}</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-slate-50">{format.money(lineTotal)}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decreaseItem(item.productId)}
                            aria-label={t('orders.create.decrease', { name: product.name })}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-600 text-slate-50 hover:bg-slate-500"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-slate-50">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => addItemDirect(item.productId)}
                            disabled={maxed}
                            aria-label={t('orders.create.increase', { name: product.name })}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-600 text-slate-50 hover:bg-slate-500 disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            aria-label={t('orders.create.remove', { name: product.name })}
                            className="ml-auto text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {possibleAccs.length > 0 && (
                          <div className="mt-2 pl-2 border-l border-slate-600 space-y-1.5">
                            {possibleAccs.map((acc) => {
                              const selected = item.accompaniments.find((a) => a.accompanimentId === acc.accompanimentId);
                              const included = Boolean(selected);
                              const accOut = !included && acc.stock != null && acc.stock < item.quantity * acc.quantityMultiplier;

                              return (
                                <div key={acc.accompanimentId} className="flex items-center justify-between gap-2">
                                  <label className={`flex min-w-0 items-center gap-2 text-xs ${accOut ? 'cursor-not-allowed text-slate-500' : 'text-slate-200'}`}>
                                    <input
                                      type="checkbox"
                                      checked={included}
                                      disabled={accOut}
                                      onChange={(e) => toggleAccompanimentIncluded(item.productId, acc.accompanimentId, e.target.checked)}
                                    />
                                    <span className={`truncate ${accOut ? 'line-through' : ''}`}>
                                      {acc.name} ({format.money(acc.unitPrice)}) x {acc.quantityMultiplier}
                                    </span>
                                    {accOut && (
                                      <span className="shrink-0 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white no-underline">
                                        {acc.stock === 0 ? t('common.stock.out') : t('common.stock.left', { count: acc.stock! })}
                                      </span>
                                    )}
                                  </label>

                                  <label
                                    className="flex shrink-0 items-center gap-1.5 text-xs text-slate-200"
                                    style={{ opacity: included ? 1 : 0.5 }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected?.priceCounted ?? false}
                                      disabled={!included}
                                      onChange={(e) =>
                                        toggleAccompanimentPrice(
                                          item.productId,
                                          acc.accompanimentId,
                                          e.target.checked
                                        )
                                      }
                                    />
                                    <span>{t('orders.create.priceCounted')}</span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-1 border-t border-slate-700 pt-3">
                <p className="text-slate-300 text-sm">{t('orders.create.subtotal', { amount: format.money(subtotal) })}</p>
                {discount > 0 && (
                  <p className="text-green-500 text-sm italic">{t('orders.create.discount', { amount: format.money(discount) })}</p>
                )}
                <p className="text-lg text-slate-50 font-bold">{t('orders.create.total', { amount: format.money(total) })}</p>
              </div>

              <input type="hidden" name="items" value={JSON.stringify(items)} />

              {undeliverableNames.length > 0 && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {t('orders.create.undeliverableInCart', { names: undeliverableNames.join(', ') })}
                </p>
              )}

              {state.error && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {state.error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isPending || items.length === 0 || undeliverableNames.length > 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isPending ? t('orders.create.submitting') : t('orders.create.submit')}
                </Button>
                <Link href="/orders">
                  <Button type="button" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                    {t('common.cancel')}
                  </Button>
                </Link>
              </div>
            </aside>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
