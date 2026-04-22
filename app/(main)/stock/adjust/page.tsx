'use client';

import { useState, useEffect } from 'react';
import { getStockList, addStockMovement, getAvailableAccompanimentsForStock } from '@/app/actions/stock';
import type { StockItemType } from '@/app/actions/stock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Settings2, Package, Coffee, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  threshold: number;
  type: StockItemType;
}

export default function AdjustStockPage() {
  const router = useRouter();
  const [itemType, setItemType] = useState<StockItemType>('product');
  const [products, setProducts] = useState<StockItem[]>([]);
  const [accompaniments, setAccompaniments] = useState<StockItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('manual_adjustment');

  useEffect(() => {
    const load = async () => {
      setLoadingItems(true);
      const all = await getStockList();
      setProducts(all.filter((s) => s.type === 'product'));
      setAccompaniments(all.filter((s) => s.type === 'accompaniment'));
      setLoadingItems(false);
    };
    load();
  }, []);

  // Reset selected item when type changes
  useEffect(() => {
    setSelectedItemId('');
  }, [itemType]);

  const currentList = itemType === 'product' ? products : accompaniments;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity) return;

    setSubmitting(true);
    const result = await addStockMovement(
      selectedItemId,
      movementType,
      parseFloat(quantity),
      reason,
      itemType
    );

    if (result.success) {
      toast.success('Mouvement de stock enregistré');
      router.push('/stock');
    } else {
      toast.error(result.error || 'Erreur lors de l\'enregistrement');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl relative">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/stock">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-50">Nouveau Mouvement</h1>
            <p className="text-slate-400">Enregistrez une entrée, sortie ou ajustement manuel.</p>
          </div>
        </div>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2 text-lg">
              <Settings2 className="w-5 h-5 text-blue-500" />
              Détails de l'opération
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Sélecteur de type : Produit ou Accompagnement */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Type d'article</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setItemType('product')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all duration-200 ${
                      itemType === 'product'
                        ? 'border-blue-500/60 bg-blue-500/10 text-blue-400'
                        : 'border-slate-700 bg-slate-900/30 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span className="text-sm font-semibold">Produit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('accompaniment')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all duration-200 ${
                      itemType === 'accompaniment'
                        ? 'border-purple-500/60 bg-purple-500/10 text-purple-400'
                        : 'border-slate-700 bg-slate-900/30 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Coffee className="w-4 h-4" />
                    <span className="text-sm font-semibold">Accompagnement</span>
                  </button>
                </div>
              </div>

              {/* Sélection de l'article */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  {itemType === 'product' ? <Package className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                  {itemType === 'product' ? 'Produit à impacter' : 'Accompagnement à impacter'}
                </label>
                {loadingItems ? (
                  <div className="flex items-center gap-2 text-slate-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Chargement...</span>
                  </div>
                ) : currentList.length === 0 ? (
                  <div className="text-sm text-slate-500 italic py-2">
                    Aucun {itemType === 'product' ? 'produit' : 'accompagnement'} disponible.
                  </div>
                ) : (
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 text-slate-50 rounded-lg p-2.5 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  >
                    <option value="">
                      Sélectionner {itemType === 'product' ? 'un produit' : 'un accompagnement'}...
                    </option>
                    {currentList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Stock: {s.quantity})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Type de mouvement */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Type de mouvement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMovementType(t)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                          movementType === t
                            ? t === 'IN'
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                              : t === 'OUT'
                              ? 'border-red-500/50 bg-red-500/10 text-red-500'
                              : 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                            : 'border-slate-700 bg-slate-900/30 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {t === 'IN' ? <Plus className="w-5 h-5" /> : t === 'OUT' ? <Minus className="w-5 h-5" /> : <Settings2 className="w-5 h-5" />}
                        <span className="text-xs font-semibold">{t === 'IN' ? 'ENTRÉE' : t === 'OUT' ? 'SORTIE' : 'AJUST.'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantité */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Quantité</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    step="0.001"
                    min="0"
                    className="bg-slate-900/50 border-slate-700 text-slate-50"
                    placeholder="Ex: 5"
                    required
                  />
                  <p className="text-[10px] text-slate-500">Pour AJUSTEMENT, saisissez le nouveau stock final.</p>
                </div>
              </div>

              {/* Raison */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Raison (Optionnel)</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 text-slate-50 rounded-lg p-2.5 focus:border-blue-500 focus:ring-blue-500/20"
                >
                  <option value="manual_adjustment">Ajustement manuel</option>
                  <option value="purchase">Nouvel achat / Réapprovisionnement</option>
                  <option value="loss">Perte / Vol / Casse</option>
                  <option value="return">Retour client</option>
                  <option value="inventory">Inventaire physique</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <Link href="/stock" className="flex-1">
                  <Button variant="outline" type="button" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                    Annuler
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={submitting || !selectedItemId || !quantity}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</span>
                  ) : 'Enregistrer le mouvement'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}