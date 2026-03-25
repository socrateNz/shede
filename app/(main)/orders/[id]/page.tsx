'use client';

import {
  getOrder,
  addOrderItem,
  removeOrderItem,
  removeOrderAccompaniment,
  updateOrderStatus,
  getAvailableProducts,
  getOrderAccompanimentChoices,
  addOrderAccompaniment,
  setOrderItemPriceCounted,
} from '@/app/actions/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Product } from '@/lib/supabase';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import { PaymentForm } from '@/components/payment-form';
import { useRouter } from 'next/navigation';

interface OrderDetail {
  id: string;
  structure_id: string;
  user_id: string;
  table_number: number | null;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    is_price_counted?: boolean;
    parent_order_item_id?: string | null;
    products: Product;
  }>;
}

type AccompanimentChoice = {
  accompanimentProductId: string;
  name: string;
  unitPrice: number;
  quantityMultiplier: number;
  defaultPriceIncluded: boolean;
  existingOrderItemId: string | null;
  existingIsPriceCounted: boolean | null;
};

type ParentAccompanimentChoices = {
  parentOrderItemId: string;
  parentProductId: string;
  possibleAccompaniments: AccompanimentChoice[];
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [accompanimentChoices, setAccompanimentChoices] = useState<ParentAccompanimentChoices[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const orderData = await getOrder(orderId);
        setOrder(orderData);
        const productsData = await getAvailableProducts();
        setProducts(productsData || []);

        const accomp = await getOrderAccompanimentChoices(orderId);
        setAccompanimentChoices(accomp?.parents || []);
      } catch (error) {
        console.error('Failed to fetch order:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  const refreshOrderAndAccomp = async () => {
    const updatedOrder = await getOrder(orderId);
    setOrder(updatedOrder);

    const accomp = await getOrderAccompanimentChoices(orderId);
    setAccompanimentChoices(accomp?.parents || []);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !order) return;

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const result = await addOrderItem(
      orderId,
      selectedProduct,
      quantity,
      product.price
    );

    if (result.success) {
      setSelectedProduct('');
      setQuantity(1);
      await refreshOrderAndAccomp();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const result = await removeOrderItem(itemId);
    if (result.success) {
      await refreshOrderAndAccomp();
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const result = await updateOrderStatus(orderId, newStatus);
    if (result.success) {
      await refreshOrderAndAccomp();
    }
  };

  const handleToggleAccompanimentIncluded = async (parentOrderItemId: string, choice: AccompanimentChoice, include: boolean) => {
    if (!include) {
      if (!choice.existingOrderItemId) return;
      const res = await removeOrderAccompaniment(choice.existingOrderItemId);
      if (res.success) await refreshOrderAndAccomp();
      return;
    }

    // include = true
    if (choice.existingOrderItemId) return;
    const priceCounted = choice.defaultPriceIncluded;
    const res = await addOrderAccompaniment(orderId, parentOrderItemId, choice.accompanimentProductId, priceCounted);
    if (res.success) await refreshOrderAndAccomp();
  };

  const handleToggleAccompanimentPrice = async (choice: AccompanimentChoice, counted: boolean) => {
    if (!choice.existingOrderItemId) return;
    const res = await setOrderItemPriceCounted(choice.existingOrderItemId, counted);
    if (res.success) await refreshOrderAndAccomp();
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Loading...</div>;
  }

  if (!order) {
    return (
      <div className="p-8">
        <p className="text-red-400">Order not found</p>
      </div>
    );
  }

  const statusOptions = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="p-8">
      <Link href="/orders" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Order Info */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50 text-sm">Order Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Order ID</p>
              <p className="text-slate-50 font-mono text-sm">{order.id.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Table</p>
              <p className="text-slate-50">{order.table_number ? `Table ${order.table_number}` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-slate-50 rounded px-2 py-1 text-sm w-full"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50 text-sm">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Subtotal</p>
              <p className="text-slate-50 font-medium">${order.subtotal.toFixed(2)}</p>
            </div>
            <div className="border-t border-slate-700 pt-3">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-slate-50 font-bold text-lg">${order.total.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Add Item or Payment */}
        {order.status === 'COMPLETED' ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-50 text-sm">Order Complete</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-green-400">Payment completed</p>
              <Link href="/orders">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm">
                  Back to Orders
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : showPaymentForm ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-50 text-sm">Process Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentForm
                orderId={orderId}
                amount={order.total}
                onSuccess={() => {
                  setShowPaymentForm(false);
                  router.refresh();
                }}
              />
              <Button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                variant="outline"
                className="w-full mt-3 border-slate-600 text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-50 text-sm">Add Item</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddItem} className="space-y-3">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded px-2 py-2 text-sm"
                >
                  <option value="">Select product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - ${product.price.toFixed(2)}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="bg-slate-700 border-slate-600 text-slate-50"
                />
                <Button
                  type="submit"
                  disabled={!selectedProduct}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
                {order.order_items.length > 0 && (
                  <Button
                    type="button"
                    onClick={() => setShowPaymentForm(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    Checkout
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Order Items */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          {order.order_items.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No items yet</p>
          ) : (
            <div className="space-y-4">
              {order.order_items
                .filter((it) => !it.parent_order_item_id)
                .map((parent) => {
                  const parentChoices = accompanimentChoices.find((p) => p.parentOrderItemId === parent.id);
                  const possible = parentChoices?.possibleAccompaniments || [];

                  return (
                    <div key={parent.id} className="bg-slate-700 p-4 rounded-lg space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-slate-50 font-medium">{parent.products.name}</p>
                          <p className="text-slate-400 text-sm">
                            {parent.quantity}x ${parent.unit_price.toFixed(2)} = ${parent.total_price.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(parent.id)}
                          className="text-red-400 hover:text-red-300 transition-colors mt-1"
                          aria-label="Remove product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {possible.length === 0 ? (
                        <p className="text-slate-400 text-sm">Aucun accompagnement disponible pour ce produit.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400">Accompagnements possibles</p>
                          {possible.map((choice) => {
                            const included = Boolean(choice.existingOrderItemId);
                            const computedQty = parent.quantity * choice.quantityMultiplier;
                            const lineTotal = choice.unitPrice * computedQty;

                            return (
                              <div key={choice.accompanimentProductId} className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={included}
                                      onChange={(e) =>
                                        handleToggleAccompanimentIncluded(parent.id, choice, e.target.checked)
                                      }
                                    />
                                    <span className="text-slate-50 text-sm">{choice.name}</span>
                                  </label>
                                  <p className="text-slate-400 text-xs mt-0.5">
                                    {computedQty} x ${choice.unitPrice.toFixed(2)} = ${lineTotal.toFixed(2)}
                                  </p>
                                  {included && choice.existingIsPriceCounted === false && (
                                    <p className="text-amber-300 text-xs mt-0.5">Prix non pris en compte</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <label className={`flex items-center gap-2 text-xs ${included ? 'text-slate-200' : 'text-slate-500'}`}>
                                    <input
                                      type="checkbox"
                                      checked={included ? Boolean(choice.existingIsPriceCounted) : true}
                                      disabled={!included}
                                      onChange={(e) => handleToggleAccompanimentPrice(choice, e.target.checked)}
                                    />
                                    Prix compté
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
