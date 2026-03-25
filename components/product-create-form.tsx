/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { createProduct } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

// Type exact qui correspond à ProductAccompanimentFormItem de la server action
type AccompanimentItem = 
  | {
      kind: 'existing';
      accompanimentId: string;
      quantity: number;
    }
  | {
      kind: 'new';
      name: string;
      price: number;
      quantity: number;
    };

type CreateProductParams = {
  name: string;
  description?: string;
  price: number;
  category?: string;
  isAvailable: boolean;
  accompaniments: AccompanimentItem[];
};

export function ProductCreateForm({ accompanimentOptions }: { accompanimentOptions: ProductOption[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [existingSelected, setExistingSelected] = useState<Record<string, number>>({});
  const [newAccompName, setNewAccompName] = useState('');
  const [newAccompPrice, setNewAccompPrice] = useState<number>(0);
  const [newAccompItems, setNewAccompItems] = useState<NewAccomp[]>([]);

  // Mutation pour la création
  const createMutation = useMutation({
    mutationFn: async (params: CreateProductParams) => {
      const result = await createProduct(params);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create product');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully!');
      setTimeout(() => {
        router.push('/products');
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      console.error('Create error:', error);
    },
  });

  const accompanimentsPayload = useMemo((): AccompanimentItem[] => {
    const existing: AccompanimentItem[] = Object.entries(existingSelected).map(([accompanimentProductId, quantity]) => ({
      kind: 'existing',
      accompanimentId: accompanimentProductId,
      quantity,
    }));

    const created: AccompanimentItem[] = newAccompItems.map((n) => ({
      kind: 'new',
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

  const addNewAccomp = () => {
    const name = newAccompName.trim();
    const price = Number(newAccompPrice);
    if (!name) return;
    if (!Number.isFinite(price) || price <= 0) return;

    setNewAccompItems((prev) => [
      ...prev,
      { clientId: crypto.randomUUID(), name, price },
    ]);
    setNewAccompName('');
    setNewAccompPrice(0);
  };

  const removeNewAccomp = (clientId: string) => {
    setNewAccompItems((prev) => prev.filter((x) => x.clientId !== clientId));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const params: CreateProductParams = {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || undefined,
      price: parseFloat(formData.get('price') as string),
      category: (formData.get('category') as string) || undefined,
      isAvailable: formData.get('isAvailable') === 'on',
      accompaniments: accompanimentsPayload,
    };
    
    createMutation.mutate(params);
  };

  return (
    <div className="p-8">
      <Link href="/products" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Products
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Add New Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Product Name *</label>
              <Input
                type="text"
                name="name"
                placeholder="e.g. Margherita Pizza"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
                disabled={createMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Description</label>
              <textarea
                name="description"
                placeholder="e.g. Classic pizza with tomato, mozzarella, and basil"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 placeholder:text-slate-500 rounded-md p-3 h-24"
                disabled={createMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Price *</label>
                <Input
                  type="number"
                  name="price"
                  placeholder="0.00"
                  step="0.01"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                  disabled={createMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Category</label>
                <Input
                  type="text"
                  name="category"
                  placeholder="e.g. Pizza, Drinks, Desserts"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  disabled={createMutation.isPending}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isAvailable"
                defaultChecked={true}
                className="w-4 h-4"
                disabled={createMutation.isPending}
              />
              <label className="text-sm font-medium text-slate-200">Product is available</label>
            </div>

            <div className="border border-slate-700 rounded-lg p-4 space-y-3">
              <p className="text-slate-100 font-medium">Accompagnements</p>
              {accompanimentOptions.length === 0 ? (
                <p className="text-slate-400 text-sm">Aucun produit disponible pour choisir un accompagnement.</p>
              ) : (
                <div className="space-y-3">
                  {accompanimentOptions.map((p) => {
                    const selected = Boolean(existingSelected[p.id]);

                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-700 p-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleExistingAcc(p.id)}
                            className="mt-1"
                            disabled={createMutation.isPending}
                          />
                          <div>
                            <p className="text-slate-50 font-medium">{p.name}</p>
                            <p className="text-slate-400 text-xs">${p.price.toFixed(2)}</p>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-slate-700 space-y-3">
                <p className="text-slate-100 font-medium">Ajouter un nouvel accompagnement</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="text"
                    value={newAccompName}
                    onChange={(e) => setNewAccompName(e.target.value)}
                    placeholder="Nom"
                    className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                    disabled={createMutation.isPending}
                  />
                  <Input
                    type="number"
                    value={Number.isFinite(newAccompPrice) ? newAccompPrice : 0}
                    onChange={(e) => setNewAccompPrice(Number(e.target.value))}
                    placeholder="Prix"
                    step="0.01"
                    min={0}
                    className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                    disabled={createMutation.isPending}
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={addNewAccomp} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={createMutation.isPending}
                >
                  Ajouter
                </Button>

                {newAccompItems.length > 0 && (
                  <div className="space-y-2">
                    {newAccompItems.map((n) => (
                      <div key={n.clientId} className="flex items-center justify-between rounded-lg bg-slate-700 p-3">
                        <div>
                          <p className="text-slate-50 font-medium">{n.name}</p>
                          <p className="text-slate-400 text-xs">${n.price.toFixed(2)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeNewAccomp(n.clientId)}
                          className="border-slate-600 text-slate-200 hover:bg-slate-700"
                          disabled={createMutation.isPending}
                        >
                          Retirer
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {createMutation.isError && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {createMutation.error instanceof Error ? createMutation.error.message : 'An error occurred'}
              </div>
            )}

            {createMutation.isSuccess && (
              <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
                Product created successfully! Redirecting...
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createMutation.isPending ? (
                  <>
                    <span className="mr-2">Creating...</span>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </>
                ) : (
                  'Create Product'
                )}
              </Button>
              <Link href="/products">
                <Button 
                  variant="outline" 
                  className="border-slate-600 text-slate-200 hover:bg-slate-700"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}