'use client';

import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

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
import { getSessionAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Product } from '@/lib/supabase';
import { ArrowLeft, Trash2, Plus, ShoppingCart, CreditCard, Package, Clock, CheckCircle, XCircle, Loader2, Tag } from 'lucide-react';
import Link from 'next/link';
import { PaymentForm } from '@/components/payment-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PrintOrderButton } from '@/components/print-order-button';
import { ThermalReceiptPrintButton } from '@/components/thermal-receipt';
import { DecisionButtons } from '@/components/marketplace/decision-buttons';
import { Bike } from 'lucide-react';

interface OrderDetail {
  id: string;
  structure_id: string;
  user_id: string;
  table_number: number | null;
  status: string;
  subtotal: number;
  total: number;
  discount_amount: number;
  tip_amount: number;
  promotion_id: string | null;
  notes: string | null;
  table_id: string | null;
  client_id: string | null;
  clients?: {
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
  tables?: {
    name: string;
    floor_name: string;
  } | null;
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

const statusStyles: Record<string, { icon: any; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  IN_PROGRESS: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  READY: { icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  SERVED: { icon: CheckCircle, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  COMPLETED: { icon: CreditCard, color: 'text-green-400', bg: 'bg-green-500/10' },
  CANCELLED: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
};

const getValidNextStatuses = (currentStatus: string) => {
  switch (currentStatus) {
    case 'PENDING':
      return ['IN_PROGRESS', 'CANCELLED'];
    case 'IN_PROGRESS':
      return ['READY', 'CANCELLED'];
    case 'READY':
      return ['SERVED'];
    case 'SERVED':
      return ['COMPLETED'];
    case 'COMPLETED':
    case 'CANCELLED':
    default:
      return [];
  }
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { t, format } = useT();
  const statusConfig = Object.fromEntries(
    Object.entries(statusStyles).map(([value, style]) => [value, { ...style, label: t(`orders.status.${value}` as TranslationKey) }])
  ) as Record<string, { label: string; icon: any; color: string; bg: string }>;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [accompanimentChoices, setAccompanimentChoices] = useState<ParentAccompanimentChoices[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orderData, productsData, accomp, session] = await Promise.all([
          getOrder(orderId),
          getAvailableProducts(),
          getOrderAccompanimentChoices(orderId),
          getSessionAction(),
        ]);

        setOrder(orderData);
        setProducts(productsData || []);
        setAccompanimentChoices(accomp?.parents || []);
        setUserRole(session?.role || null);
      } catch (error) {
        console.error('Erreur lors du chargement de la commande:', error);
        toast.error(t('orders.detail.loadError'));
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

    const result = await addOrderItem(orderId, selectedProduct, quantity, product.price);

    if (result.success) {
      toast.success(t('orders.detail.itemAdded'));
      setSelectedProduct('');
      setQuantity(1);
      await refreshOrderAndAccomp();
    } else {
      toast.error(result.error || t('orders.detail.addError'));
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const result = await removeOrderItem(itemId);
    if (result.success) {
      toast.success(t('orders.detail.itemRemoved'));
      await refreshOrderAndAccomp();
    } else {
      toast.error(t('orders.detail.removeError'));
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    const result = await updateOrderStatus(orderId, newStatus);
    if (result.success) {
      toast.success(t('orders.detail.statusUpdated', { status: statusConfig[newStatus]?.label || newStatus }));
      await refreshOrderAndAccomp();
    } else {
      toast.error(t('orders.detail.statusError'));
    }
    setUpdatingStatus(false);
  };

  const handleToggleAccompanimentIncluded = async (parentOrderItemId: string, choice: AccompanimentChoice, include: boolean) => {
    if (!include) {
      if (!choice.existingOrderItemId) return;
      const res = await removeOrderAccompaniment(choice.existingOrderItemId);
      if (res.success) {
        toast.success(t('orders.detail.accompanimentRemoved'));
        await refreshOrderAndAccomp();
      }
      return;
    }

    if (choice.existingOrderItemId) return;
    const priceCounted = choice.defaultPriceIncluded;
    const res = await addOrderAccompaniment(orderId, parentOrderItemId, choice.accompanimentProductId, priceCounted);
    if (res.success) {
      toast.success(t('orders.detail.accompanimentAdded'));
      await refreshOrderAndAccomp();
    }
  };

  const handleToggleAccompanimentPrice = async (choice: AccompanimentChoice, counted: boolean) => {
    if (!choice.existingOrderItemId) return;
    const res = await setOrderItemPriceCounted(choice.existingOrderItemId, counted);
    if (res.success) {
      toast.success(counted ? t('orders.detail.priceCounted') : t('orders.detail.priceNotCounted'));
      await refreshOrderAndAccomp();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400">{t('orders.detail.loading')}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="w-full">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400">
            {t('orders.detail.notFound')}
          </div>
        </div>
      </div>
    );
  }

  const currentStatus = statusConfig[order.status] || statusConfig.PENDING;
  const validNextStatuses = getValidNextStatuses(order.status);
  // Reconstruct options to only include valid transitions plus the current status
  const statusOptions = [order.status, ...validNextStatuses].filter((v, i, a) => a.indexOf(v) === i);
  const StatusIcon = currentStatus.icon;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Back Button */}
        <Link href="/orders" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{t('orders.detail.back')}</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
            <ShoppingCart className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400 font-medium">{t('orders.detail.badge')}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              {t('orders.detail.title', { number: order.id.slice(0, 8) })}
            </h1>
            <div className="flex items-center gap-2">
              <PrintOrderButton order={order} />
              <ThermalReceiptPrintButton order={order} />
            </div>
          </div>
          <p className="text-slate-400">{t('orders.detail.subtitle')}</p>
        </div>

        {/* Commande marketplace : origine, décision, livreur */}
        {(order as any).source === 'API' && (
          <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold text-emerald-200">
                  <Bike className="h-4 w-4" />
                  {t('marketplace.orderFrom', {
                    partner: ((order as any).partner || t('orders.source.API')).toUpperCase(),
                    ref: (order as any).external_id ?? order.id.slice(0, 8),
                  })}
                </p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  {[(order as any).customer_name, (order as any).phone].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  {(order as any).acceptance === 'PENDING'
                    ? t('marketplace.awaiting')
                    : (order as any).acceptance === 'REJECTED'
                      ? t('marketplace.rejectedWith', { reason: (order as any).rejection_reason ?? '—' })
                      : (order as any).courier_status
                        ? t('marketplace.courier', {
                            status: t(`marketplace.courierStatus.${(order as any).courier_status as 'ASSIGNED'}`),
                            name: (order as any).courier_name ?? '—',
                          })
                        : t('marketplace.acceptedWith', { minutes: (order as any).prep_minutes ?? '—' })}
                </p>
              </div>
              {(order as any).acceptance === 'PENDING' && order.status !== 'CANCELLED' && userRole !== 'SERVEUR' && (
                <DecisionButtons orderId={order.id} onDone={refreshOrderAndAccomp} />
              )}
            </div>
            <p className="mt-2 text-xs text-emerald-100/60">{t('marketplace.paidByPartner')}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Informations commande */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50 pb-3">
              <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-blue-400" />
                {t('orders.detail.info')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <p className="text-xs text-slate-400">{t('orders.detail.number')}</p>
                <p className="text-slate-50 font-mono text-sm">{order.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('orders.detail.service')}</p>
                <p className="text-slate-50 mt-1">
                  {(order as any).rooms?.number ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {t('orders.detail.roomBadge', { number: (order as any).rooms.number })}
                    </span>
                  ) : order.tables ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                      🍽️ {order.tables.name} ({order.tables.floor_name})
                    </span>
                  ) : order.table_number ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                      {t('orders.detail.tableBadge', { number: order.table_number })}
                    </span>
                  ) : (order as any).consumption_type === 'DELIVERY' ? (
                    <span className="text-slate-300 text-sm">
                      {t('orders.detail.deliveryTo', {
                        address: [(order as any).delivery_district, (order as any).delivery_landmark].filter(Boolean).join(' — '),
                      })}
                    </span>
                  ) : (
                    <span className="text-slate-500">{t('orders.detail.onSite')}</span>
                  )}
                </p>
              </div>
              {order.clients && (
                <div>
                  <p className="text-xs text-slate-400">{t('orders.detail.client')}</p>
                  <p className="text-slate-50 font-medium text-sm flex items-center gap-2 mt-1">
                    👤 {order.clients.first_name} {order.clients.last_name}
                    <span className="text-xs text-slate-400">({order.clients.phone})</span>
                  </p>
                </div>
              )}
              {order.notes && (
                <div>
                  <p className="text-xs text-slate-400">{t('orders.detail.notes')}</p>
                  <p className="text-slate-50 mt-1">{order.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">{t('orders.detail.status')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${currentStatus.bg} ${currentStatus.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {currentStatus.label}
                  </span>
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus || userRole === 'SERVEUR' || (order as any).acceptance === 'PENDING'}
                      className={`bg-slate-700 border border-slate-600 text-slate-50 rounded-lg px-2 py-1 text-sm focus:border-blue-500 ${userRole === 'SERVEUR' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusConfig[status]?.label || status}
                        </option>
                      ))}
                    </select>
                  {updatingStatus && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('orders.detail.date')}</p>
                <p className="text-slate-50 text-sm">
                  {t('orders.detail.dateTime', { date: format.date(order.created_at), time: format.time(order.created_at) })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Totaux */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50 pb-3">
              <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-green-400" />
                {t('orders.detail.totals')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">{t('orders.detail.subtotal')}</p>
                <p className="text-slate-50 font-medium">{format.money(order.subtotal)}</p>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
                <p className="text-sm text-slate-400">{t('orders.detail.total')}</p>
                <div className="flex flex-col items-end">
                  <p className="text-slate-50 font-bold text-xl">{format.money(order.total)}</p>
                  {(order as any).discount_amount > 0 && (
                    <span className="text-[10px] text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded shadow-sm border border-pink-500/20 mt-1 inline-flex items-center gap-1">
                      <Tag className="w-3 h-3" /> {t('orders.detail.promoApplied')}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ajout d'article ou Paiement */}
          {order.status === 'COMPLETED' ? (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50 pb-3">
                <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  {t('orders.detail.completedTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-green-400 mb-4">{t('orders.detail.completedText')}</p>
                <Link href="/orders">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                    {t('orders.detail.back')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : showPaymentForm ? (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50 pb-3">
                <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-green-400" />
                  {t('orders.detail.payment')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
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
                  className="w-full mt-3 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {t('common.cancel')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50 pb-3">
                <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4 text-blue-400" />
                  {t('orders.detail.addItem')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleAddItem} className="space-y-4">
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-blue-500"
                  >
                    <option value="">{t('orders.detail.selectProduct')}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {format.money(product.price)}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="bg-slate-900/50 border-slate-600 text-slate-50"
                  />
                  <Button
                    type="submit"
                    disabled={!selectedProduct}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('orders.detail.add')}
                  </Button>
                  {order.order_items.length > 0 && userRole !== 'SERVEUR' && (order as any).source !== 'API' && (
                    <Button
                      type="button"
                      onClick={() => setShowPaymentForm(true)}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {t('orders.detail.checkout')}
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Liste des articles */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              {t('orders.detail.items')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {order.order_items.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">{t('orders.detail.noItems')}</p>
                <p className="text-sm mt-2">{t('orders.detail.noItemsText')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {order.order_items
                  .filter((it) => !it.parent_order_item_id)
                  .map((parent) => {
                    const parentChoices = accompanimentChoices.find((p) => p.parentOrderItemId === parent.id);
                    const possible = parentChoices?.possibleAccompaniments || [];

                    return (
                      <div key={parent.id} className="p-5 hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-slate-50 font-medium text-lg">{parent.products.name}</p>
                            <p className="text-slate-400 text-sm mt-1">
                              {parent.quantity} x {format.money(parent.unit_price)} = {format.money(parent.total_price)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(parent.id)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            aria-label={t('orders.detail.remove')}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        {possible.length > 0 && (
                          <div className="mt-4 pl-4 border-l-2 border-purple-500/30">
                            <p className="text-xs text-slate-400 mb-2">{t('orders.detail.possibleAccompaniments')}</p>
                            <div className="space-y-3">
                              {possible.map((choice) => {
                                const included = Boolean(choice.existingOrderItemId);
                                const computedQty = parent.quantity * choice.quantityMultiplier;
                                const lineTotal = choice.unitPrice * computedQty;

                                return (
                                  <div key={choice.accompanimentProductId} className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex-1 min-w-[150px]">
                                      <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={included}
                                          onChange={(e) => handleToggleAccompanimentIncluded(parent.id, choice, e.target.checked)}
                                          className="w-4 h-4 rounded border-slate-600 text-purple-500 focus:ring-purple-500"
                                        />
                                        <span className="text-slate-200 text-sm">{choice.name}</span>
                                      </label>
                                      <p className="text-slate-500 text-xs mt-0.5">
                                        {computedQty} x {format.money(choice.unitPrice)} = {format.money(lineTotal)}
                                      </p>
                                      {included && choice.existingIsPriceCounted === false && (
                                        <p className="text-amber-400 text-xs mt-0.5">{t('orders.detail.priceNotCountedWarning')}</p>
                                      )}
                                    </div>
                                    <label className={`flex items-center gap-2 text-xs ${included ? 'text-slate-300' : 'text-slate-600'}`}>
                                      <input
                                        type="checkbox"
                                        checked={included ? Boolean(choice.existingIsPriceCounted) : true}
                                        disabled={!included}
                                        onChange={(e) => handleToggleAccompanimentPrice(choice, e.target.checked)}
                                        className="w-3.5 h-3.5"
                                      />
                                      {t('orders.create.priceCounted')}
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
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
    </div>
  );
}