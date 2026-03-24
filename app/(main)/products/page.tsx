import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ProductsList } from '@/components/products-list';

async function getProducts(structureId: string) {
  const admin = getAdminSupabase();

  const { data: products, error } = await admin
    .from('products')
    .select('*')
    .eq('structure_id', structureId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  return products || [];
}

export default async function ProductsPage() {
  await requireRole('ADMIN');
  const session = await requireRole('ADMIN');
  const products = await getProducts(session.structureId);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Products</h1>
          <p className="text-slate-400">Manage your menu items</p>
        </div>
        <Link href="/products/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">All Products</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No products yet</p>
              <Link href="/products/new">
                <Button variant="outline" className="border-slate-600 text-blue-400 hover:bg-slate-700">
                  Create your first product
                </Button>
              </Link>
            </div>
          ) : (
            <ProductsList products={products} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
