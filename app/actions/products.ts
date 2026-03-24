'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export async function createProduct(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim() || undefined;
  const category = String(formData.get('category') || '').trim() || undefined;
  const priceValue = Number(formData.get('price') || 0);

  if (!name || Number.isNaN(priceValue) || priceValue <= 0) {
    return { success: false, error: 'Please provide valid product data' };
  }

  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();

    const { data: product, error } = await admin
      .from('products')
      .insert({
        structure_id: session.structureId,
        name,
        description: description || null,
        price: priceValue,
        category: category || null,
        is_available: true,
      })
      .select()
      .single();

    if (error || !product) {
      return { success: false, error: 'Failed to create product' };
    }

    redirect(`/products/${product.id}`);
  } catch (error) {
    console.error('Create product error:', error);
    return { success: false, error: 'Failed to create product' };
  }
}

export async function updateProduct(
  productId: string,
  name: string,
  description: string | undefined,
  price: number,
  category: string | undefined,
  isAvailable: boolean
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('products')
      .update({
        name,
        description: description || null,
        price,
        category: category || null,
        is_available: isAvailable,
      })
      .eq('id', productId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: 'Failed to update product' };
    }

    return { success: true };
  } catch (error) {
    console.error('Update product error:', error);
    return { success: false, error: 'Failed to update product' };
  }
}

export async function deleteProduct(productId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('products')
      .update({ is_deleted: true })
      .eq('id', productId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: 'Failed to delete product' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete product error:', error);
    return { success: false, error: 'Failed to delete product' };
  }
}
