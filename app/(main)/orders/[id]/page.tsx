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
import { ArrowLeft, Trash2, Plus, ShoppingCart, CreditCard, Package, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PaymentForm } from '@/components/payment-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  PENDING: { label: 'En attente', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  IN_PROGRESS: { label: 'En préparation', icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  READY: { label: 'Prête', icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  SERVED: { label: 'Servie', icon: CheckCircle, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  COMPLETED: { label: 'Payée', icon: CreditCard, color: 'text-green-400', bg: 'bg-green-500/10' },
  CANCELLED: { label: 'Annulée', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
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
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
        console.error('Erreur lors du chargement de la commande:', error);
        toast.error('Erreur lors du chargement de la commande');
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
      toast.success('Article ajouté avec succès');
      setSelectedProduct('');
      setQuantity(1);
      await refreshOrderAndAccomp();
    } else {
      toast.error(result.error || 'Erreur lors de l\'ajout');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const result = await removeOrderItem(itemId);
    if (result.success) {
      toast.success('Article supprimé');
      await refreshOrderAndAccomp();
    } else {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    const result = await updateOrderStatus(orderId, newStatus);
    if (result.success) {
      toast.success(`Statut mis à jour : ${statusConfig[newStatus]?.label || newStatus}`);
      await refreshOrderAndAccomp();
    } else {
      toast.error('Erreur lors du changement de statut');
    }
    setUpdatingStatus(false);
  };

  const handleToggleAccompanimentIncluded = async (parentOrderItemId: string, choice: AccompanimentChoice, include: boolean) => {
    if (!include) {
      if (!choice.existingOrderItemId) return;
      const res = await removeOrderAccompaniment(choice.existingOrderItemId);
      if (res.success) {
        toast.success('Accompagnement retiré');
        await refreshOrderAndAccomp();
      }
      return;
    }

    if (choice.existingOrderItemId) return;
    const priceCounted = choice.defaultPriceIncluded;
    const res = await addOrderAccompaniment(orderId, parentOrderItemId, choice.accompanimentProductId, priceCounted);
    if (res.success) {
      toast.success('Accompagnement ajouté');
      await refreshOrderAndAccomp();
    }
  };

  const handleToggleAccompanimentPrice = async (choice: AccompanimentChoice, counted: boolean) => {
    if (!choice.existingOrderItemId) return;
    const res = await setOrderItemPriceCounted(choice.existingOrderItemId, counted);
    if (res.success) {
      toast.success(counted ? 'Prix pris en compte' : 'Prix non pris en compte');
      await refreshOrderAndAccomp();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400">Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400">
            Commande non trouvée
          </div>
        </div>
      </div>
    );
  }

  const statusOptions = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
  const currentStatus = statusConfig[order.status] || statusConfig.PENDING;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Back Button */}
        <Link href="/orders" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Retour aux commandes</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
            <ShoppingCart className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400 font-medium">Détails de la commande</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            Commande #{order.id.slice(0, 8)}
          </h1>
          <p className="text-slate-400">Gérez les articles et le statut de la commande</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Informations commande */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50 pb-3">
              <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-blue-400" />
                Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <p className="text-xs text-slate-400">N° commande</p>
                <p className="text-slate-50 font-mono text-sm">{order.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Livraison</p>
                <p className="text-slate-50 mt-1">
                  {(order as any).rooms?.number ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      🛏️ Chambre {(order as any).rooms.number}
                    </span>
                  ) : order.table_number ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                      🍽️ Table {order.table_number}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      📦 À emporter
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Statut</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${currentStatus.bg} ${currentStatus.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {currentStatus.label}
                  </span>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="bg-slate-700 border border-slate-600 text-slate-50 rounded-lg px-2 py-1 text-sm focus:border-blue-500"
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
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-slate-50 text-sm">
                  {new Date(order.created_at).toLocaleDateString('fr-FR')} à {new Date(order.created_at).toLocaleTimeString('fr-FR')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Totaux */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50 pb-3">
              <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-green-400" />
                Totaux
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">Sous-total</p>
                <p className="text-slate-50 font-medium">{order.subtotal.toLocaleString()} FCFA</p>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
                <p className="text-sm text-slate-400">Total</p>
                <p className="text-slate-50 font-bold text-xl">{order.total.toLocaleString()} FCFA</p>
              </div>
            </CardContent>
          </Card>

          {/* Ajout d'article ou Paiement */}
          {order.status === 'COMPLETED' ? (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50 pb-3">
                <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Commande terminée
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-green-400 mb-4">Paiement complété</p>
                <Link href="/orders">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                    Retour aux commandes
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : showPaymentForm ? (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50 pb-3">
                <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-green-400" />
                  Paiement
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
                  Annuler
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50 pb-3">
                <CardTitle className="text-slate-50 flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4 text-blue-400" />
                  Ajouter un article
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleAddItem} className="space-y-4">
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-blue-500"
                  >
                    <option value="">Sélectionner un produit...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.price.toLocaleString()} FCFA
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
                    Ajouter
                  </Button>
                  {order.order_items.length > 0 && (
                    <Button
                      type="button"
                      onClick={() => setShowPaymentForm(true)}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Finaliser la commande
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
              Articles de la commande
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {order.order_items.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Aucun article</p>
                <p className="text-sm mt-2">Ajoutez des produits à cette commande</p>
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
                              {parent.quantity} x {parent.unit_price.toLocaleString()} FCFA = {parent.total_price.toLocaleString()} FCFA
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(parent.id)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        {possible.length > 0 && (
                          <div className="mt-4 pl-4 border-l-2 border-purple-500/30">
                            <p className="text-xs text-slate-400 mb-2">Accompagnements possibles</p>
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
                                        {computedQty} x {choice.unitPrice.toLocaleString()} FCFA = {lineTotal.toLocaleString()} FCFA
                                      </p>
                                      {included && choice.existingIsPriceCounted === false && (
                                        <p className="text-amber-400 text-xs mt-0.5">⚠️ Prix non pris en compte</p>
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
                                      Prix compté
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