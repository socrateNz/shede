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
}: {
  products: OrderProduct[];
  accompanimentsByProductId: Record<string, AccompanimentOption[]>;
  rooms: { id: string; number: string }[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createOrderWithItems, {
    success: false,
    error: '',
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<SelectedItem[]>([]);

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

  const total = subtotal;

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
    <Card className="bg-slate-800 border-slate-700 max-w-3xl">
      <CardHeader>
        <CardTitle className="text-slate-50">Create New Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Room Number (optional)</label>
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
              <label className="text-sm font-medium text-slate-200">Table Number (optional)</label>
              <Input
                type="number"
                name="tableNumber"
                placeholder="e.g. 5"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Phone *</label>
              <Input
                type="tel"
                name="phone"
                placeholder="Client phone"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Notes (optional)</label>
              <Input
                type="text"
                name="notes"
                placeholder="Special instructions"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-4 space-y-3">
            <p className="text-slate-100 font-medium">Add Products</p>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-7">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded px-3 py-2 text-sm"
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - ${product.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="bg-slate-700 border-slate-600 text-slate-50"
                />
              </div>
              <div className="col-span-2">
                <Button
                  type="button"
                  onClick={addItem}
                  disabled={!selectedProduct}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
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
                        {item.quantity} x ${product.price.toFixed(2)} = ${lineTotal.toFixed(2)}
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
                                    {acc.name} (${acc.unitPrice.toFixed(2)}) x {acc.quantityMultiplier}
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
            <p className="text-slate-300 text-sm">Subtotal: ${subtotal.toFixed(2)}</p>
            <p className="text-slate-50 font-bold">Total: ${total.toFixed(2)}</p>
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
