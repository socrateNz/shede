'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/lib/i18n/client';
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
  const { t } = useT();
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
      toast.success(t('stock.adjust.saved'));
      router.push('/stock');
    } else {
      toast.error(result.error || t('stock.adjust.saveError'));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/stock">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-50">{t('stock.adjust.title')}</h1>
            <p className="text-slate-400">{t('stock.adjust.subtitle')}</p>
          </div>
        </div>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2 text-lg">
              <Settings2 className="w-5 h-5 text-blue-500" />
              {t('stock.adjust.details')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Sélecteur de type : Produit ou Accompagnement */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{t('stock.adjust.itemType')}</label>
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
                    <span className="text-sm font-semibold">{t('stock.itemType.product')}</span>
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
                    <span className="text-sm font-semibold">{t('stock.itemType.accompaniment')}</span>
                  </button>
                </div>
              </div>

              {/* Sélection de l'article */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  {itemType === 'product' ? <Package className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                  {itemType === 'product' ? t('stock.adjust.productToUpdate') : t('stock.adjust.accompanimentToUpdate')}
                </label>
                {loadingItems ? (
                  <div className="flex items-center gap-2 text-slate-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{t('stock.adjust.loading')}</span>
                  </div>
                ) : currentList.length === 0 ? (
                  <div className="text-sm text-slate-500 italic py-2">
                    {itemType === 'product' ? t('stock.adjust.noProducts') : t('stock.adjust.noAccompaniments')}
                  </div>
                ) : (
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 text-slate-50 rounded-lg p-2.5 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  >
                    <option value="">
                      {itemType === 'product' ? t('stock.adjust.selectProduct') : t('stock.adjust.selectAccompaniment')}
                    </option>
                    {currentList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t('stock.adjust.stockOption', { name: s.name, quantity: s.quantity })}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Type de mouvement */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">{t('stock.adjust.movementType')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((mt) => (
                      <button
                        key={mt}
                        type="button"
                        onClick={() => setMovementType(mt)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                          movementType === mt
                            ? mt === 'IN'
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                              : mt === 'OUT'
                              ? 'border-red-500/50 bg-red-500/10 text-red-500'
                              : 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                            : 'border-slate-700 bg-slate-900/30 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {mt === 'IN' ? <Plus className="w-5 h-5" /> : mt === 'OUT' ? <Minus className="w-5 h-5" /> : <Settings2 className="w-5 h-5" />}
                        <span className="text-xs font-semibold">{mt === 'IN' ? t('stock.adjust.in') : mt === 'OUT' ? t('stock.adjust.out') : t('stock.adjust.adjustment')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantité */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">{t('stock.adjust.quantity')}</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    step="0.001"
                    min="0"
                    className="bg-slate-900/50 border-slate-700 text-slate-50"
                    placeholder={t('stock.adjust.quantityPlaceholder')}
                    required
                  />
                  <p className="text-[10px] text-slate-500">{t('stock.adjust.adjustmentHint')}</p>
                </div>
              </div>

              {/* Raison */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{t('stock.adjust.reason')}</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 text-slate-50 rounded-lg p-2.5 focus:border-blue-500 focus:ring-blue-500/20"
                >
                  <option value="manual_adjustment">{t('stock.reasons.manual_adjustment')}</option>
                  <option value="purchase">{t('stock.reasons.purchase')}</option>
                  <option value="loss">{t('stock.reasons.loss')}</option>
                  <option value="return">{t('stock.reasons.return')}</option>
                  <option value="inventory">{t('stock.reasons.inventory')}</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <Link href="/stock" className="flex-1">
                  <Button variant="outline" type="button" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                    {t('common.cancel')}
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={submitting || !selectedItemId || !quantity}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('stock.adjust.saving')}</span>
                  ) : t('stock.adjust.submit')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}