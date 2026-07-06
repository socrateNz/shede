'use client';

import { useCartStore } from '@/lib/cart-store';
import { ShoppingCart, Plus, Minus, Flame, Star, Clock, Coffee, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { formatFCFA } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

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
  const searchParams = useSearchParams();

  useEffect(() => {
    const tableParam = searchParams.get('table');
    if (tableParam) {
      sessionStorage.setItem('scannedTable', tableParam);
    }
  }, [searchParams]);

  const getProductPromotion = (productId: string) => {
    return promotions.find(p => p.scope === 'PRODUCT' && p.product_id === productId);
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-slate-100 rounded-full p-6 mb-4">
          <UtensilsCrossed className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-lg text-slate-600 font-bold">Aucun produit disponible</p>
        <p className="text-slate-500 mt-1">Revenez bientôt pour découvrir notre carte.</p>
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
        image_url: product.image_url,
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
    
    const promo = getProductPromotion(selectedProduct.id);
    const basePrice = promo
      ? (promo.type === 'PERCENTAGE' ? selectedProduct.price * (1 - promo.value / 100) : Math.max(0, selectedProduct.price - promo.value))
      : selectedProduct.price;

    addItem({
      id: cartItemId,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: basePrice,
      quantity: 1,
      image_url: selectedProduct.image_url,
      selectedAccompaniments: selectedAccs
    }, structureId);

    toast.success(`${selectedProduct.name} ajouté au panier`);
    setSelectedProduct(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product, idx) => {
          const promo = getProductPromotion(product.id);
          const discountedPrice = promo
            ? (promo.type === 'PERCENTAGE' ? product.price * (1 - promo.value / 100) : Math.max(0, product.price - promo.value))
            : product.price;

          const hasImage = !!product.image_url;

          return (
            <div
              key={product.id}
              className="group relative bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-blue-100 transition-all duration-500 transform hover:-translate-y-1 flex flex-col h-full"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Product Image Header */}
              <div className="relative h-48 w-full bg-slate-50 overflow-hidden">
                {hasImage ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                    <Utensils className="w-12 h-12 text-slate-300 mb-2" />
                  </div>
                )}
                
                {/* Overlay gradient for text readability if badges exist */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

                {/* Promo Badge */}
                {promo && (
                  <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-black tracking-wide px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    {promo.type === 'PERCENTAGE' ? `-${promo.value}%` : `-${formatFCFA(promo.value)}`}
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                      {product.name}
                    </h3>
                    {product.is_popular && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Populaire</span>
                      </div>
                    )}
                  </div>
                </div>

                {product.description && (
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed font-medium">
                    {product.description}
                  </p>
                )}

                <div className="mt-auto pt-5 flex items-end justify-between">
                  <div>
                    {promo && (
                      <span className="text-xs font-bold text-slate-400 line-through block mb-0.5">
                        {formatFCFA(product.price)}
                      </span>
                    )}
                    <span className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                      {formatFCFA(discountedPrice)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleProductClick(product)}
                    className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 hover:scale-110 active:scale-95 transition-all duration-300 shadow-md hover:shadow-blue-200"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accompaniments Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-md w-full rounded-3xl gap-0 p-0 border-0 shadow-2xl overflow-hidden bg-white animate-slide-down">
          {selectedProduct && (
            <>
              {/* Modal Header with Image */}
              <div className="relative h-40 w-full bg-slate-100">
                {selectedProduct.image_url ? (
                  <img 
                    src={selectedProduct.image_url} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <Coffee className="w-12 h-12 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <DialogTitle className="text-2xl font-black text-white drop-shadow-md">
                    {selectedProduct.name}
                  </DialogTitle>
                  <DialogDescription className="text-white/80 font-medium">
                    Personnalisez votre commande
                  </DialogDescription>
                </div>
              </div>

              {(() => {
                const promo = getProductPromotion(selectedProduct.id);
                return promo ? (
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2.5 text-center text-sm font-bold tracking-wide flex items-center justify-center gap-2">
                    <Flame className="w-4 h-4" />
                    Promotion Active
                  </div>
                ) : null;
              })()}

              <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4 bg-slate-50/50 custom-scrollbar">
                {selectedProduct.product_accompaniments?.map((pa: any) => {
                  const acc = pa.accompaniments;
                  if (!acc) return null;
                  const maxQuantity = pa.quantity || 1;
                  const currentQty = accompanimentSelections[acc.id] || 0;

                  return (
                    <div key={acc.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800">{acc.name}</p>
                        <p className="text-sm font-black text-blue-600 mt-0.5">+{formatFCFA(acc.price)}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        <button
                          onClick={() => updateAccQuantity(acc.id, -1, maxQuantity)}
                          disabled={currentQty === 0}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-all active:scale-95"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-4 text-center font-black text-slate-900">{currentQty}</span>
                        <button
                          onClick={() => updateAccQuantity(acc.id, 1, maxQuantity)}
                          disabled={currentQty >= maxQuantity}
                          className="w-8 h-8 rounded-lg bg-slate-900 shadow-sm flex items-center justify-center text-white disabled:opacity-40 disabled:bg-slate-300 hover:bg-blue-600 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(!selectedProduct.product_accompaniments || selectedProduct.product_accompaniments.length === 0) && (
                  <div className="text-center py-8">
                    <div className="bg-white rounded-full p-4 inline-block mb-3 shadow-sm border border-slate-100">
                      <Clock className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-bold">Aucune option disponible</p>
                    <p className="text-sm text-slate-400 mt-1">Ce produit n'a pas d'accompagnements.</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)] relative z-10">
                <Button
                  onClick={submitProductWithOptions}
                  className="w-full py-7 text-lg font-black bg-slate-900 hover:bg-blue-600 text-white rounded-2xl shadow-xl hover:shadow-blue-200 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <ShoppingCart className="w-5 h-5 mr-3" />
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

function UtensilsCrossed({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}