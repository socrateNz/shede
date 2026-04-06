'use client';

import { useCartStore } from '@/lib/cart-store';
import { ShoppingCart, Plus, Minus, Tag } from 'lucide-react';
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

  // Helper to find promotion for a product
  const getProductPromotion = (productId: string) => {
    return promotions.find(p => p.scope === 'PRODUCT' && p.product_id === productId);
  };

  if (products.length === 0) {
    return <div className="text-slate-500 py-8 text-center italic">Aucun produit disponible.</div>;
  }

  const handleProductClick = (product: any) => {
    // If it has accompaniments, explicitly map them and open modal
    const hasAccompaniments = product.product_accompaniments && product.product_accompaniments.length > 0;
    
    if (hasAccompaniments) {
      setSelectedProduct(product);
      setAccompanimentSelections({});
    } else {
      const promo = getProductPromotion(product.id);
      const finalPrice = promo 
          ? (promo.type === 'PERCENTAGE' ? product.price * (1 - promo.value/100) : Math.max(0, product.price - promo.value))
          : product.price;

      // Just add directly
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

    // Create a deterministic unique ID based on options picked so that identical cart setups group nicely
    const orderedAccIds = selectedAccs.map(a => `${a.accompaniment_id}x${a.quantity}`).sort().join('-');
    const cartItemId = `${selectedProduct.id}${orderedAccIds ? `-${orderedAccIds}` : ''}`;

    // Use the original product price. The cart logic will handle discounts 
    // to avoid double application (once here and once in the cart view).
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {products.map((product) => {
          const promo = getProductPromotion(product.id);
          return (
            <div key={product.id} className="relative group bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col hover:shadow-xl hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1">
              {promo && (
                <div className="absolute -top-3 -right-2 z-10 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce-subtle">
                  <Tag className="w-3 h-3" />
                  {promo.type === 'PERCENTAGE' ? `-${promo.value}%` : `-${formatFCFA(promo.value)}`}
                </div>
              )}
              
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-slate-500 mt-2 flex-1 line-clamp-3 font-light leading-relaxed">{product.description}</p>
              )}
              
              <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                <div className="flex flex-col">
                   {promo && (
                     <span className="text-xs text-slate-400 line-through mb-0.5">
                       {formatFCFA(product.price)}
                     </span>
                   )}
                   <span className="text-xl font-black text-blue-600">
                     {promo 
                        ? formatFCFA(promo.type === 'PERCENTAGE' ? product.price * (1 - promo.value/100) : Math.max(0, product.price - promo.value))
                        : formatFCFA(product.price)}
                   </span>
                </div>
                <button 
                  onClick={() => handleProductClick(product)}
                  className="bg-slate-900 hover:bg-blue-600 text-white rounded-xl px-4 py-2.5 transition-all duration-300 shadow-sm flex items-center gap-2 group-hover:shadow-blue-200"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Ajouter</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-md w-full sm:rounded-3xl gap-0 p-0 border-none shadow-2xl overflow-hidden bg-white">
          {selectedProduct && (
            <>
              {/* Promotion Header in Modal if exists */}
              {(() => {
                const promo = getProductPromotion(selectedProduct.id);
                return promo ? (
                  <div className="bg-red-500 text-white px-6 py-2 text-center text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                    <Tag className="w-3 h-3" /> Promotion Spéciale Active
                  </div>
                ) : null;
              })()}

              <div className="bg-slate-50/50 p-6 border-b border-slate-100">
                 <DialogTitle className="text-2xl font-black text-slate-900">
                   {selectedProduct.name}
                 </DialogTitle>
                 <DialogDescription className="mt-2 text-slate-500 font-light">
                   Personnalisez votre commande avec des accompagnements
                 </DialogDescription>
              </div>
              
              <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4">
                {selectedProduct.product_accompaniments?.map((pa: any) => {
                  const acc = pa.accompaniments;
                  if (!acc) return null;
                  const maxQuantity = pa.quantity || 1;
                  const currentQty = accompanimentSelections[acc.id] || 0;

                  return (
                    <div key={acc.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-100 transition-colors">
                      <div>
                        <p className="font-bold text-slate-800">{acc.name}</p>
                        <p className="text-sm font-semibold text-blue-600">{formatFCFA(acc.price)}</p>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <button 
                          onClick={() => updateAccQuantity(acc.id, -1, maxQuantity)}
                          disabled={currentQty === 0}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:bg-transparent hover:text-red-500 transition-all"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-6 text-center font-black text-slate-900">{currentQty}</span>
                        <button 
                          onClick={() => updateAccQuantity(acc.id, 1, maxQuantity)}
                          disabled={currentQty >= maxQuantity}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:bg-transparent hover:text-blue-600 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(!selectedProduct.product_accompaniments || selectedProduct.product_accompaniments.length === 0) && (
                   <p className="text-center text-slate-400 py-4 italic font-light">Aucun accompagnement requis</p>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-white">
                <Button 
                  onClick={submitProductWithOptions} 
                  className="w-full py-7 text-lg font-black bg-slate-900 hover:bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100 transition-all duration-300 transform active:scale-95"
                >
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
