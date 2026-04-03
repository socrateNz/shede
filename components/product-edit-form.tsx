/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { updateProduct, deleteProduct } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { Trash2, ArrowLeft, Save, X, Plus, Package, DollarSign, Tag, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { Product } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';

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
}: {
  product: Product;
  accompanimentOptions: ProductOption[];
  initialAccompaniments: Record<string, { quantity: number; priceIncluded?: boolean }>;
  initialThreshold?: number;
}) {
  const router = useRouter();
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

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const params = {
        productId,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) || undefined,
        price: parseFloat(formData.get('price') as string),
        category: (formData.get('category') as string) || undefined,
        isAvailable: formData.get('isAvailable') === 'on',
        accompaniments: selectedAccompaniments,
        threshold: hasStockModule ? Number(formData.get('threshold')) : undefined,
      };

      const result = await updateProduct(params);

      if (!result.success) {
        throw new Error(result.error || 'Échec de la mise à jour du produit');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });

      toast.success('Produit mis à jour avec succès !');

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
        throw new Error(result.error || 'Échec de la suppression du produit');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit supprimé avec succès !');
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
    toast.success('Accompagnement ajouté');
  };

  const removeNewAccomp = (clientId: string) => {
    setNewAccompItems((prev) => prev.filter((x) => x.clientId !== clientId));
    toast.success('Accompagnement retiré');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      deleteMutation.mutate(productId);
    }
  };

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl relative">
        {/* Back Button */}
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Retour aux produits</span>
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
            <Package className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400 font-medium">Modification du produit</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            {product.name}
          </h1>
          <p className="text-slate-400">Mettez à jour les informations de votre produit</p>
        </div>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5" />

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
                  <h3 className="font-semibold">Informations générales</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-400" />
                      Nom du produit *
                    </label>
                    <Input
                      type="text"
                      name="name"
                      defaultValue={product.name}
                      placeholder="Ex: Burger Deluxe"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-purple-400" />
                      Prix *
                    </label>
                    <Input
                      type="number"
                      name="price"
                      defaultValue={product.price}
                      step="10"
                      min="0"
                      placeholder="Ex: 2500"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                      disabled={isPending}
                    />
                    <p className="text-xs text-slate-500 mt-1">Prix en FCFA</p>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={product.description || ''}
                    placeholder="Description du produit..."
                    className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 placeholder:text-slate-500 rounded-lg p-3 h-24 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
                    disabled={isPending}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-amber-400" />
                      Catégorie
                    </label>
                    <Input
                      type="text"
                      name="category"
                      defaultValue={product.category || ''}
                      placeholder="Ex: Plat principal, Boisson, Dessert"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 transition-all duration-300 group-hover:border-slate-500"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Disponibilité
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
                        <span className="text-sm text-slate-300">Disponible</span>
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
                        <span className="text-sm text-slate-300">Indisponible</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section Stock - Uniquement si module activé */}
                {hasStockModule && (
                  <div className="space-y-6 pt-4">
                    <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <h3 className="font-semibold">Gestion du Stock</h3>
                    </div>
                    <div className="max-w-xs space-y-2 group">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        Seuil d'alerte *
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
                      <p className="text-[10px] text-slate-500">Une alerte sera affichée si le stock tombe en dessous de cette valeur.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section Accompagnements */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <Plus className="w-4 h-4 text-purple-400" />
                  <h3 className="font-semibold">Accompagnements & extras</h3>
                </div>

                {accompanimentOptions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-900/30 rounded-lg border border-slate-700">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun accompagnement disponible</p>
                    <p className="text-sm mt-1">Créez d'abord des accompagnements</p>
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
                              <div className="text-sm text-slate-400">{option.price.toLocaleString()} FCFA</div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-slate-400">Qté:</label>
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
                    Ajouter un nouvel accompagnement
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="text"
                      value={newAccompName}
                      onChange={(e) => setNewAccompName(e.target.value)}
                      placeholder="Nom"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500"
                      disabled={isPending}
                    />
                    <Input
                      type="number"
                      value={Number.isFinite(newAccompPrice) ? newAccompPrice : 0}
                      onChange={(e) => setNewAccompPrice(Number(e.target.value))}
                      placeholder="Prix"
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
                    Ajouter l'accompagnement
                  </Button>

                  {newAccompItems.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm text-slate-400">Nouveaux accompagnements :</p>
                      {newAccompItems.map((n) => (
                        <div key={n.clientId} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                          <div>
                            <p className="text-slate-50 font-medium">{n.name}</p>
                            <p className="text-slate-400 text-sm">{n.price.toLocaleString()} FCFA</p>
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
                    Produit mis à jour avec succès ! Redirection...
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
                      Enregistrer les modifications
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
                    Annuler
                  </Button>
                </Link>
              </div>
            </form>

            {/* Zone de danger */}
            <div className="border-t border-red-500/20 mt-8 pt-8">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <p className="text-sm font-medium text-red-400">Zone de danger</p>
              </div>

              {deleteMutation.isError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 mb-4">
                  {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Échec de la suppression'}
                </div>
              )}

              <Button
                onClick={handleDelete}
                variant="destructive"
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer le produit'}
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                Cette action est irréversible. Toutes les données associées seront supprimées.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}