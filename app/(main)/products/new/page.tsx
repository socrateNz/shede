import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { ProductCreateForm } from '@/components/product-create-form';
import { loadCategories } from '@/lib/categories';

export default async function NewProductPage() {
  const session = await requireRole('ADMIN');
  const admin = getAdminSupabase();

  const { data } = await admin
    .from('accompaniments')
    .select('id, name, price')
    .eq('structure_id', session.structureId)
    .eq('is_available', true)
    .eq('is_deleted', false)
    .order('name', { ascending: true });

  const categories = await loadCategories(session.structureId!);

  return (
    <ProductCreateForm
      categoryOptions={categories}
      accompanimentOptions={(data || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
      }))}
    />
  );
}
