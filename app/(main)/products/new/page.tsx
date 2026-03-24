'use client';

import { createProduct } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewProductPage() {
  const [state, formAction, isPending] = useActionState(createProduct, {
    success: false,
    error: '',
  });

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
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Product Name *</label>
              <Input
                type="text"
                name="name"
                placeholder="e.g. Margherita Pizza"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Description</label>
              <textarea
                name="description"
                placeholder="e.g. Classic pizza with tomato, mozzarella, and basil"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 placeholder:text-slate-500 rounded-md p-3 h-24"
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
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Category</label>
                <Input
                  type="text"
                  name="category"
                  placeholder="e.g. Pizza, Drinks, Desserts"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                />
              </div>
            </div>

            {state.error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? 'Creating...' : 'Create Product'}
              </Button>
              <Link href="/products">
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
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
