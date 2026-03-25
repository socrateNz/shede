import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';
import { ProductEditForm } from '@/components/product-edit-form';

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireRole('ADMIN');
  const admin = getAdminSupabase();

  const productId = (await params).id;

  const { data: product, error: productError } = await admin
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('structure_id', session.structureId)
    .single();

  if (productError || !product) {
    return (
      <div className="p-8">
        <p className="text-red-400">Product not found</p>
      </div>
    );
  }

  const { data: options } = await admin
    .from('accompaniments')
    .select('id, name, price')
    .eq('structure_id', session.structureId)
    .eq('is_deleted', false)
    .eq('is_available', true)
    .order('name', { ascending: true });

  const { data: mappings } = await admin
    .from('product_accompaniments')
    .select('accompaniment_id, quantity')
    .eq('structure_id', session.structureId)
    .eq('product_id', productId);

  const initialAccompaniments: Record<string, { quantity: number; priceIncluded?: boolean }> = {};
  (mappings || []).forEach((m: any) => {
    const accId = m.accompaniment_id as string;
    initialAccompaniments[accId] = {
      quantity: Number(m.quantity || 1),
    };
  });

  return (
    <ProductEditForm
      product={product as Product}
      accompanimentOptions={(options || []).map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        price: Number(p.price),
      }))}
      initialAccompaniments={initialAccompaniments}
    />
  );
}
