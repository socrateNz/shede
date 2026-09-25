'use client';

import { createOrderWithItems } from '@/app/actions/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';

interface OrderProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
}

type AccompanimentOption = {
  accompanimentId: string;
  name: string;
  unitPrice: number;
  quantityMultiplier: number;
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

export function NewOrderForm({
  products,
  accompanimentsByProductId,
  rooms,
  promotions = [],
  clients = [],
  tables = [],
}: {
  products: OrderProduct[];
  accompanimentsByProductId: Record<string, AccompanimentOption[]>;
  rooms: { id: string; number: string }[];
  promotions?: any[];
  clients?: any[];
  tables?: any[];
}) {
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
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
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

  return (
    <Card className="bg-slate-800 border-slate-700 w-full">
      <CardHeader>
        <CardTitle className="text-slate-50">Create New Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Client (CRM)</label>
              <select
                name="clientId"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md py-2 px-3 h-10"
              >
                <option value="">Sélectionner un client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Phone</label>
              <Input
                type="tel"
                name="phone"
                placeholder="Client phone"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Notes</label>
              <Input
                type="text"
                name="notes"
                placeholder="Special instructions"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Room Number</label>
              <select
                name="roomId"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 placeholder:text-slate-500 rounded-md py-2 px-3 h-10"
              >
                <option value="">Sélectionner une chambre</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>Chambre {room.number}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Table (Floor Manager)</label>
              <select
                name="tableId"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md py-2 px-3 h-10"
              >
                <option value="">Sélectionner une table...</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.floor_name})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Ou Table (Numéro libre)</label>
              <Input
                type="number"
                name="tableNumber"
                placeholder="e.g. 5"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Promotion Manuelle (Optionnel)</label>
                <select
                  className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md py-2 px-3 h-10"
                  value={selectedPromotionId}
                  onChange={(e) => {
                    setSelectedPromotionId(e.target.value);
                    if (e.target.value) setPromoCode(''); // Clear code if manual selected
                  }}
                  name="promotionId"
                >
                  <option value="">Aucune promotion</option>
                  {promotions.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.value}{p.type === 'PERCENTAGE' ? '%' : ' FCFA'})
                    </option>
                  ))}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Ou Code Promo</label>
                <Input 
                   placeholder="Ex: SUMMER24"
                   value={promoCode}
                   onChange={(e) => {
                     setPromoCode(e.target.value.toUpperCase());
                     if (e.target.value) setSelectedPromotionId(''); // Clear manual if code entered
                   }}
                   name="promoCode"
                   className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500 uppercase font-mono"
                />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-700 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-amber-400">Pourboire (Tips)</label>
              <Input
                type="number"
                name="tipAmount"
                defaultValue={0}
                min={0}
                className="bg-slate-700 border-amber-500/50 text-slate-50 focus:border-amber-400"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-red-400">Remise Manuelle</label>
              <Input
                type="number"
                name="discountAmount"
                defaultValue={0}
                min={0}
                className="bg-slate-700 border-red-500/50 text-slate-50 focus:border-red-400"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-red-400">Raison de la remise</label>
              <Input
                type="text"
                name="discountReason"
                placeholder="Ex: Geste commercial"
                className="bg-slate-700 border-red-500/50 text-slate-50 focus:border-red-400"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-4 space-y-4 bg-slate-800/50">
            <p className="text-slate-100 font-medium">Catalogue des Produits</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-600">
              {products.map((product) => (
                <div 
                  key={product.id}
                  onClick={() => addItemDirect(product.id)}
                  className="cursor-pointer border border-slate-700 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all bg-slate-900 group"
                >
                  <div className="h-28 relative bg-slate-800/50">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                        <Plus className="w-6 h-6 mb-1 opacity-50" />
                        <span className="text-[10px] uppercase tracking-wider">{product.category || 'Produit'}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-200 truncate" title={product.name}>
                      {product.name}
                    </p>
                    <p className="text-xs text-blue-400 font-medium mt-1">
                      {product.price.toLocaleString()} FCFA
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-slate-400 text-sm">No products selected yet.</p>
            ) : (
              items.map((item) => {
                const product = productsById.get(item.productId);
                if (!product) return null;
                const lineTotal = product.price * item.quantity;
                const possibleAccs = accompanimentsByProductId[item.productId] || [];
                return (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between rounded-lg bg-slate-700 p-3"
                  >
                    <div>
                      <p className="text-slate-50 font-medium">{product.name}</p>
                      <p className="text-slate-400 text-sm">
                        {item.quantity} x {product.price.toFixed(2)} = {lineTotal.toFixed(2)}
                      </p>

                      {possibleAccs.length > 0 && (
                        <div className="mt-3 pl-3 border-l border-slate-600 space-y-2">
                          {possibleAccs.map((acc) => {
                            const selected = item.accompaniments.find((a) => a.accompanimentId === acc.accompanimentId);
                            const included = Boolean(selected);

                            return (
                              <div key={acc.accompanimentId} className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-2 text-sm text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={included}
                                    onChange={(e) => toggleAccompanimentIncluded(item.productId, acc.accompanimentId, e.target.checked)}
                                  />
                                  <span>
                                    {acc.name} ({acc.unitPrice.toFixed(2)}) x {acc.quantityMultiplier}
                                  </span>
                                </label>

                                <label
                                  className="flex items-center gap-2 text-sm text-slate-200 opacity-100"
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
                                  <span>Prix compté</span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-lg border border-slate-700 p-4 space-y-1">
            <p className="text-slate-300 text-sm">Subtotal: {subtotal.toFixed(2)}</p>
            {discount > 0 && (
               <p className="text-green-500 text-sm italic">Discount: -{discount.toFixed(2)}</p>
            )}
            <p className="text-slate-50 font-bold">Total: {total.toFixed(2)}</p>
          </div>

          <input type="hidden" name="items" value={JSON.stringify(items)} />

          {state.error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {state.error}
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <Button
              type="submit"
              disabled={isPending || items.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? 'Creating...' : 'Create Order'}
            </Button>
            <Link href="/orders">
              <Button type="button" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
