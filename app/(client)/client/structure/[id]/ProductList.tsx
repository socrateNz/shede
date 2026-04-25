'use client';

import { useCartStore } from '@/lib/cart-store';
import { ShoppingCart, Plus, Minus, Tag, Star, Clock, Flame, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { formatFCFA } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';

export default function ProductList({
  products,
  structureId,
  promotions = []
}: {
  products: any[],
  structureId: string,
  promotions?: any[]
}) {
  const addItem = useCartStore((state) => state.addItem);

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [accompanimentSelections, setAccompanimentSelections] = useState<Record<string, number>>({});

  const getProductPromotion = (productId: string) => {
    return promotions.find(p => p.scope === 'PRODUCT' && p.product_id === productId);
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-slate-100 rounded-full p-4 mb-4">
          <UtensilsCrossed className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium">Aucun produit disponible</p>
        <p className="text-sm text-slate-400 mt-1">Revenez bientôt pour découvrir notre carte</p>
      </div>
    );
  }

  const handleProductClick = (product: any) => {
    const hasAccompaniments = product.product_accompaniments && product.product_accompaniments.length > 0;

    if (hasAccompaniments) {
      setSelectedProduct(product);
      setAccompanimentSelections({});
    } else {
      const promo = getProductPromotion(product.id);
      const finalPrice = promo
        ? (promo.type === 'PERCENTAGE' ? product.price * (1 - promo.value / 100) : Math.max(0, product.price - promo.value))
        : product.price;

      addItem({
        id: product.id,
        productId: product.id,
        name: product.name,
        price: finalPrice,
        quantity: 1,
        selectedAccompaniments: []
      }, structureId);
      toast.success(`${product.name} ajouté au panier`);
    }
  };

  const updateAccQuantity = (accId: string, delta: number, maxQty: number) => {
    setAccompanimentSelections(prev => {
      const current = prev[accId] || 0;
      const next = Math.max(0, Math.min(current + delta, maxQty));
      return { ...prev, [accId]: next };
    });
  };

  const submitProductWithOptions = () => {
    if (!selectedProduct) return;

    const selectedAccs = [];
    for (const pa of selectedProduct.product_accompaniments || []) {
      const acc = pa.accompaniments;
      const qty = accompanimentSelections[acc.id] || 0;
      if (qty > 0) {
        selectedAccs.push({
          id: `${selectedProduct.id}-${acc.id}`,
          accompaniment_id: acc.id,
          name: acc.name,
          price: acc.price,
          quantity: qty
        });
      }
    }

    const orderedAccIds = selectedAccs.map(a => `${a.accompaniment_id}x${a.quantity}`).sort().join('-');
    const cartItemId = `${selectedProduct.id}${orderedAccIds ? `-${orderedAccIds}` : ''}`;
    const basePrice = selectedProduct.price;

    addItem({
      id: cartItemId,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: basePrice,
      quantity: 1,
      selectedAccompaniments: selectedAccs
    }, structureId);

    toast.success(`${selectedProduct.name} ajouté au panier`);
    setSelectedProduct(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((product, idx) => {
          const promo = getProductPromotion(product.id);
          const discountedPrice = promo
            ? (promo.type === 'PERCENTAGE' ? product.price * (1 - promo.value / 100) : Math.max(0, product.price - promo.value))
            : product.price;

          return (
            <div
              key={product.id}
              className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {promo && (
                <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  {promo.type === 'PERCENTAGE' ? `-${promo.value}%` : `-${formatFCFA(promo.value)}`}
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    {product.is_popular && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs text-slate-500">Populaire</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-50 rounded-lg px-2 py-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Nouveau</span>
                  </div>
                </div>

                {product.description && (
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    {promo && (
                      <span className="text-xs text-slate-400 line-through block">
                        {formatFCFA(product.price)}
                      </span>
                    )}
                    <span className="text-xl font-extrabold text-blue-600">
                      {formatFCFA(discountedPrice)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleProductClick(product)}
                    className="bg-gradient-to-r from-slate-800 to-slate-700 hover:from-blue-600 hover:to-blue-500 text-white rounded-xl px-4 py-2.5 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2 transform hover:scale-105 active:scale-95"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-xs font-bold">Ajouter</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-md w-full rounded-2xl gap-0 p-0 border-0 shadow-2xl overflow-hidden bg-white animate-slide-down">
          {selectedProduct && (
            <>
              {(() => {
                const promo = getProductPromotion(selectedProduct.id);
                return promo ? (
                  <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-3 text-center text-sm font-bold flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Promotion Spéciale Active
                    <Sparkles className="w-4 h-4" />
                  </div>
                ) : null;
              })()}

              <div className="bg-gradient-to-r from-slate-50 to-white p-6 border-b border-slate-100">
                <DialogTitle className="text-2xl font-black text-slate-800">
                  {selectedProduct.name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-slate-500">
                  Personnalisez votre commande
                </DialogDescription>
              </div>

              <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3">
                {selectedProduct.product_accompaniments?.map((pa: any) => {
                  const acc = pa.accompaniments;
                  if (!acc) return null;
                  const maxQuantity = pa.quantity || 1;
                  const currentQty = accompanimentSelections[acc.id] || 0;

                  return (
                    <div key={acc.id} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div>
                        <p className="font-bold text-slate-700">{acc.name}</p>
                        <p className="text-sm font-semibold text-blue-600 mt-0.5">{formatFCFA(acc.price)}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                        <button
                          onClick={() => updateAccQuantity(acc.id, -1, maxQuantity)}
                          disabled={currentQty === 0}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:shadow-none hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-6 text-center font-black text-slate-800">{currentQty}</span>
                        <button
                          onClick={() => updateAccQuantity(acc.id, 1, maxQuantity)}
                          disabled={currentQty >= maxQuantity}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:shadow-none hover:bg-blue-50 hover:text-blue-600 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(!selectedProduct.product_accompaniments || selectedProduct.product_accompaniments.length === 0) && (
                  <div className="text-center py-8">
                    <div className="bg-slate-50 rounded-full p-3 inline-block mb-2">
                      <Clock className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-400 font-medium">Aucun accompagnement requis</p>
                    <p className="text-xs text-slate-300 mt-1">Ajoutez directement au panier</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/30">
                <Button
                  onClick={submitProductWithOptions}
                  className="w-full py-6 text-base font-bold bg-gradient-to-r from-slate-800 to-slate-700 hover:from-blue-600 hover:to-blue-500 text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Ajouter au panier
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Composant manquant pour l'état vide
function UtensilsCrossed({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}