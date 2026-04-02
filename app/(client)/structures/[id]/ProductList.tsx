'use client';

import { useCartStore } from '@/lib/cart-store';
import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { formatFCFA } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function ProductList({ products, structureId }: { products: any[], structureId: string }) {
  const addItem = useCartStore((state) => state.addItem);
  
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [accompanimentSelections, setAccompanimentSelections] = useState<Record<string, number>>({});

  if (products.length === 0) {
    return <div className="text-slate-500 py-8">Aucun produit disponible.</div>;
  }

  const handleProductClick = (product: any) => {
    // If it has accompaniments, explicitly map them and open modal
    const hasAccompaniments = product.product_accompaniments && product.product_accompaniments.length > 0;
    
    if (hasAccompaniments) {
      setSelectedProduct(product);
      setAccompanimentSelections({});
    } else {
      // Just add directly
      addItem({
        id: product.id,
        productId: product.id,
        name: product.name,
        price: product.price,
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

    addItem({
      id: cartItemId,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: selectedProduct.price,
      quantity: 1,
      selectedAccompaniments: selectedAccs
    }, structureId);

    toast.success(`${selectedProduct.name} ajouté au panier`);
    setSelectedProduct(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
            <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-slate-500 mt-1 flex-1">{product.description}</p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-bold text-blue-600">{formatFCFA(product.price)}</span>
              <button 
                onClick={() => handleProductClick(product)}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-full p-2 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-md w-full sm:rounded-2xl gap-0 p-0 border-slate-200 shadow-xl overflow-hidden">
          {selectedProduct && (
            <>
              <div className="bg-slate-50 p-6 border-b border-slate-100">
                 <DialogTitle className="text-xl font-bold text-slate-900">
                   {selectedProduct.name}
                 </DialogTitle>
                 <DialogDescription className="mt-1 text-slate-500">
                   Personnalisez votre commande avec des accompagnements (optionnels)
                 </DialogDescription>
              </div>
              
              <div className="p-6 max-h-[50vh] overflow-y-auto">
                {selectedProduct.product_accompaniments?.map((pa: any) => {
                  const acc = pa.accompaniments;
                  if (!acc) return null;
                  const maxQuantity = pa.quantity || 1;
                  const currentQty = accompanimentSelections[acc.id] || 0;

                  return (
                    <div key={acc.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="font-medium text-slate-800">{acc.name}</p>
                        <p className="text-sm text-blue-600">{formatFCFA(acc.price)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => updateAccQuantity(acc.id, -1, maxQuantity)}
                          disabled={currentQty === 0}
                          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:bg-slate-50 hover:bg-slate-100 transition"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-4 text-center font-semibold text-slate-800">{currentQty}</span>
                        <button 
                          onClick={() => updateAccQuantity(acc.id, 1, maxQuantity)}
                          disabled={currentQty >= maxQuantity}
                          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:bg-slate-50 hover:bg-slate-100 transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <Button 
                  onClick={submitProductWithOptions} 
                  className="w-full py-6 text-base font-semibold bg-blue-600 hover:bg-blue-700 shadow-md"
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
