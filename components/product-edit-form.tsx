/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { updateProduct, deleteProduct } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { Trash2, ArrowLeft, Save, X, Plus, Package, DollarSign, Tag, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { Product } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

import { useAppStore } from '@/lib/store';
import { ImageUpload } from '@/components/image-upload';
import { DeliverableToggle, ProductCategoryPicker, type CategoryOption } from '@/components/product-category-picker';

type ProductOption = {
  id: string;
  name: string;
  price: number;
};

type NewAccomp = {
  clientId: string;
  name: string;
  price: number;
};

export function ProductEditForm({
  product,
  accompanimentOptions,
  initialAccompaniments,
  initialThreshold,
  categoryOptions,
  initialCategoryIds,
}: {
  product: Product;
  accompanimentOptions: ProductOption[];
  categoryOptions: CategoryOption[];
  initialCategoryIds: string[];
  initialAccompaniments: Record<string, { quantity: number; priceIncluded?: boolean }>;
  initialThreshold?: number;
}) {
  const router = useRouter();
  const { t, format } = useT();
  const dialogs = useDialogs();
  const queryClient = useQueryClient();
  const productId = product.id;
  const hasModule = useAppStore(state => state.hasModule);
  const hasStockModule = hasModule('STOCK');

  const [existingSelected, setExistingSelected] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const [id, v] of Object.entries(initialAccompaniments)) {
      map[id] = Number(v.quantity || 1);
    }
    return map;
  });

  const [newAccompName, setNewAccompName] = useState('');
  const [newAccompPrice, setNewAccompPrice] = useState<number>(0);
  const [newAccompItems, setNewAccompItems] = useState<NewAccomp[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(product.image_url || null);
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [isDeliverable, setIsDeliverable] = useState(product.is_deliverable !== false);

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const params = {
        productId,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) || undefined,
        price: parseFloat(formData.get('price') as string),
        categoryIds,
        destination: (formData.get('destination') as string) || 'CUISINE',
        image_url: imageUrl || undefined,
        isAvailable: formData.get('isAvailable') === 'on',
        isDeliverable,
        accompaniments: selectedAccompaniments,
        threshold: hasStockModule ? Number(formData.get('threshold')) : undefined,
      };

      const result = await updateProduct(params);

      if (!result.success) {
        throw new Error(result.error || t('products.form.updateFailed'));
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });

      toast.success(t('products.form.updated'));

      setTimeout(() => {
        router.push('/products');
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      console.error('Erreur de mise à jour:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteProduct(id);

      if (!result.success) {
        throw new Error(result.error || t('products.form.deleteFailed'));
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(t('products.form.deleted'));
      router.push('/products');
    },
    onError: (error: Error) => {
      toast.error(error.message);
      console.error('Erreur de suppression:', error);
    },
  });

  const selectedAccompaniments = useMemo(() => {
    const existing = Object.entries(existingSelected).map(([accompanimentProductId, quantity]) => ({
      kind: 'existing' as const,
      accompanimentId: accompanimentProductId,
      quantity,
    }));

    const created = newAccompItems.map((n) => ({
      kind: 'new' as const,
      name: n.name,
      price: n.price,
      quantity: 1,
    }));

    return [...existing, ...created];
  }, [existingSelected, newAccompItems]);

  const toggleExistingAcc = (id: string) => {
    setExistingSelected((prev) => {
      if (prev[id]) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: 1 };
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setExistingSelected(prev => ({
      ...prev,
      [id]: quantity
    }));
  };

  const addNewAccomp = () => {
    const name = newAccompName.trim();
    const price = Number(newAccompPrice);
    if (!name) {
      toast.error('Veuillez entrer un nom');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Veuillez entrer un prix valide');
      return;
    }

    setNewAccompItems((prev) => [
      ...prev,
      { clientId: crypto.randomUUID(), name, price },
    ]);
    setNewAccompName('');
    setNewAccompPrice(0);
    toast.success(t('products.form.accompanimentAdded'));
  };

  const removeNewAccomp = (clientId: string) => {
    setNewAccompItems((prev) => prev.filter((x) => x.clientId !== clientId));
    toast.success(t('products.form.accompanimentRemoved'));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate(formData);
  };

  const handleDelete = async () => {
    if (await dialogs.confirm({ description: t('products.form.confirmDelete'), destructive: true })) {
      deleteMutation.mutate(productId);
    }
  };

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Back Button */}
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          {t('products.form.back')}
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            {product.name}
          </h1>
          <p className="text-slate-400">{t('products.form.editSubtitle')}</p>
        </div>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />

          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Package className="w-4 h-4 text-white" />
              </div>
              Formulaire de modification
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section Informations générales */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold">{t('products.form.general')}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-400" />
                      {t('products.form.name')}
                    </label>
                    <Input
                      type="text"
                      name="name"
                      defaultValue={product.name}
                      placeholder={t('products.form.namePlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-purple-400" />
                      {t('products.form.price')}
                    </label>
                    <Input
                      type="number"
                      name="price"
                      defaultValue={product.price}
                      step="10"
                      min="0"
                      placeholder={t('products.form.pricePlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                      disabled={isPending}
                    />
                    <p className="text-xs text-slate-500 mt-1">{t('products.form.priceHint')}</p>
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-400" />
                      {t('products.form.image')}
                    </label>
                    <ImageUpload 
                      value={imageUrl} 
                      onChange={setImageUrl} 
                      disabled={isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    {t('products.form.description')}
                  </label>
                  <textarea
                    name="description"
                    defaultValue={product.description || ''}
                    placeholder={t('products.form.descriptionPlaceholder')}
                    className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 placeholder:text-slate-500 rounded-lg p-3 h-24 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
                    disabled={isPending}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-orange-400" />
                      {t('products.form.destination')}
                    </label>
                    <select
                      name="destination"
                      defaultValue={product.destination || 'CUISINE'}
                      className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg py-2 px-3 h-10 focus:border-orange-500 focus:ring-orange-500/20 transition-all duration-300"
                      disabled={isPending}
                    >
                      <option value="CUISINE">{t('products.destination.CUISINE')}</option>
                      <option value="BAR">{t('products.destination.BAR')}</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">{t('products.form.destinationHint')}</p>
                  </div>


                  <div className="md:col-span-2">
                    <ProductCategoryPicker categories={categoryOptions} selected={categoryIds} onChange={setCategoryIds} disabled={isPending} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      {t('products.form.availability')}
                    </label>
                    <div className="flex items-center gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="isAvailable"
                          value="on"
                          defaultChecked={product.is_available === true}
                          className="w-4 h-4 text-green-500 focus:ring-green-500"
                          disabled={isPending}
                        />
                        <span className="text-sm text-slate-300">{t('products.form.available')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="isAvailable"
                          value="off"
                          defaultChecked={product.is_available === false}
                          className="w-4 h-4 text-red-500 focus:ring-red-500"
                          disabled={isPending}
                        />
                        <span className="text-sm text-slate-300">{t('products.form.unavailable')}</span>
                      </label>
                    </div>
                  </div>

                  <DeliverableToggle value={isDeliverable} onChange={setIsDeliverable} disabled={isPending} />
                </div>

                {/* Section Stock - Uniquement si module activé */}
                {hasStockModule && (
                  <div className="space-y-6 pt-4">
                    <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <h3 className="font-semibold">{t('products.form.stock')}</h3>
                    </div>
                    <div className="max-w-xs space-y-2 group">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        {t('products.form.threshold')}
                      </label>
                      <Input
                        type="number"
                        name="threshold"
                        defaultValue={initialThreshold ?? 5}
                        min="0"
                        className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 transition-all duration-300"
                        required
                        disabled={isPending}
                      />
                      <p className="text-[10px] text-slate-500">{t('products.form.thresholdHint')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section Accompagnements */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <Plus className="w-4 h-4 text-purple-400" />
                  <h3 className="font-semibold">{t('products.form.accompaniments')}</h3>
                </div>

                {accompanimentOptions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-900/30 rounded-lg border border-slate-700">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('products.form.noAccompaniments')}</p>
                    <p className="text-sm mt-1">{t('products.form.createAccompanimentsFirst')}</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {accompanimentOptions.map((option) => {
                      const isSelected = Boolean(existingSelected[option.id]);
                      const quantity = existingSelected[option.id] || 1;

                      return (
                        <div
                          key={option.id}
                          className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-300 ${isSelected
                            ? 'bg-purple-500/10 border-purple-500/50'
                            : 'bg-slate-900/30 border-slate-600 hover:border-slate-500'
                            }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleExistingAcc(option.id)}
                              className="w-4 h-4 rounded border-slate-600 text-purple-500 focus:ring-purple-500"
                              disabled={isPending}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-slate-200">{option.name}</div>
                              <div className="text-sm text-slate-400">{format.money(option.price)}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-slate-400">{t('products.form.qty')}</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={quantity}
                                onChange={(e) => updateQuantity(option.id, parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 rounded bg-slate-700 border-slate-600 text-slate-50 text-center"
                                disabled={isPending}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ajout nouvel accompagnement */}
                <div className="pt-4 border-t border-slate-700 space-y-4">
                  <p className="text-slate-100 font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4 text-green-400" />
                    {t('products.form.addNewAccompaniment')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="text"
                      value={newAccompName}
                      onChange={(e) => setNewAccompName(e.target.value)}
                      placeholder={t('products.form.accompanimentName')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500"
                      disabled={isPending}
                    />
                    <Input
                      type="number"
                      value={Number.isFinite(newAccompPrice) ? newAccompPrice : 0}
                      onChange={(e) => setNewAccompPrice(Number(e.target.value))}
                      placeholder={t('products.form.accompanimentPrice')}
                      step="10"
                      min="0"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500"
                      disabled={isPending}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={addNewAccomp}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    disabled={isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('products.form.addAccompaniment')}
                  </Button>

                  {newAccompItems.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm text-slate-400">{t('products.form.newAccompaniments')}</p>
                      {newAccompItems.map((n) => (
                        <div key={n.clientId} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                          <div>
                            <p className="text-slate-50 font-medium">{n.name}</p>
                            <p className="text-slate-400 text-sm">{format.money(n.price)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeNewAccomp(n.clientId)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            disabled={isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Messages d'état */}
              {updateMutation.isError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {updateMutation.error instanceof Error ? updateMutation.error.message : 'Une erreur est survenue'}
                  </div>
                </div>
              )}

              {updateMutation.isSuccess && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {t('products.form.updatedRedirect')}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {updateMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enregistrement...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      {t('products.form.saveChanges')}
                    </div>
                  )}
                </Button>

                <Link href="/products" className="flex-1 sm:flex-none">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300"
                    disabled={isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {t('common.cancel')}
                  </Button>
                </Link>
              </div>
            </form>

            {/* Zone de danger */}
            <div className="border-t border-red-500/20 mt-8 pt-8">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <p className="text-sm font-medium text-red-400">{t('products.form.dangerZone')}</p>
              </div>

              {deleteMutation.isError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 mb-4">
                  {deleteMutation.error instanceof Error ? deleteMutation.error.message : t('products.form.deleteFailed')}
                </div>
              )}

              <Button
                onClick={handleDelete}
                variant="destructive"
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMutation.isPending ? t('products.form.deleting') : t('products.form.delete')}
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                {t('products.form.deleteWarning')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}