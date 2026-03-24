'use client';

import { updateProduct, deleteProduct } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { getAdminSupabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';

export default function EditProductPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateState, updateFormAction, isUpdating] = useActionState(updateProduct, {
    success: false,
    error: '',
  });
  const [deleteState, deleteFormAction] = useActionState(deleteProduct, {
    success: false,
    error: '',
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const admin = getAdminSupabase();
        const { data } = await admin
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (data) {
          setProduct(data);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8">
        <p className="text-red-400">Product not found</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link href="/products" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Products
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Edit Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(formData) => {
              updateFormAction(
                productId,
                formData.get('name') as string,
                (formData.get('description') as string) || undefined,
                parseFloat(formData.get('price') as string),
                (formData.get('category') as string) || undefined,
                formData.get('isAvailable') === 'on'
              );
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Product Name *</label>
              <Input
                type="text"
                name="name"
                defaultValue={product.name}
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Description</label>
              <textarea
                name="description"
                defaultValue={product.description || ''}
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 placeholder:text-slate-500 rounded-md p-3 h-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Price *</label>
                <Input
                  type="number"
                  name="price"
                  defaultValue={product.price}
                  step="0.01"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Category</label>
                <Input
                  type="text"
                  name="category"
                  defaultValue={product.category || ''}
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isAvailable"
                defaultChecked={product.is_available}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-slate-200">Product is available</label>
            </div>

            {updateState.error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {updateState.error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
              <Link href="/products">
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>

          <div className="border-t border-slate-700 mt-8 pt-8">
            <p className="text-sm text-slate-400 mb-4">Danger Zone</p>
            <form action={deleteFormAction} className="space-y-4">
              <input type="hidden" name="productId" value={productId} />
              {deleteState.error && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {deleteState.error}
                </div>
              )}
              <Button
                type="submit"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Product
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
