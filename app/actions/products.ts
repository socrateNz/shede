'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function getProducts() {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('products')
      .select('*')
      .eq('structure_id', session.structureId)
      .eq('is_deleted', false)
      .order('name', { ascending: true });

    return data || [];
  } catch (error) {
    console.error('getProducts error:', error);
    return [];
  }
}


type ProductAccompanimentFormItem =
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

function parseAccompaniments(raw: unknown): ProductAccompanimentFormItem[] {
  try {
    if (typeof raw === 'string') {
      const json = JSON.parse(raw);
      if (!Array.isArray(json)) return [];
      return json
        .map((m: any) => {
          const kind = String(m.kind || 'existing');
          const quantity = Number(m.quantity || 1);

          if (kind === 'new') {
            return {
              kind: 'new',
              name: String(m.name || '').trim(),
              price: Number(m.price || 0),
              quantity,
            } as const;
          }

          return {
            kind: 'existing',
            // L'UI envoie historiquement `accompanimentProductId`, mais il s'agit bien de l'ID
            // de l'accompagnement (pas d'un produit).
            accompanimentId: String(m.accompanimentId ?? m.accompanimentProductId ?? '').trim(),
            quantity,
          } as const;
        })
        .filter((item: ProductAccompanimentFormItem) => {
          if (!Number.isFinite(item.quantity) || item.quantity <= 0) return false;
          if (item.kind === 'existing') return Boolean(item.accompanimentId);
          return Boolean(item.name) && Number.isFinite(item.price) && item.price > 0;
        });
    }
    return [];
  } catch {
    return [];
  }
}

async function syncProductAccompaniments(input: {
  admin: ReturnType<typeof getAdminSupabase>;
  structureId: string;
  productId: string;
  accompaniments: ProductAccompanimentFormItem[];
}) {
  // Delete + insert to match the UI "current state".
  await input.admin
    .from('product_accompaniments')
    .delete()
    .eq('structure_id', input.structureId)
    .eq('product_id', input.productId);

  if (!input.accompaniments.length) return;

  const existingItems = input.accompaniments.filter((a) => a.kind === 'existing') as Array<
    Extract<ProductAccompanimentFormItem, { kind: 'existing' }>
  >;
  const newItems = input.accompaniments.filter((a) => a.kind === 'new') as Array<
    Extract<ProductAccompanimentFormItem, { kind: 'new' }>
  >;

  // Créer les nouveaux accompagnements si besoin
  const createdNewAccompIds: Array<{ accompanimentId: string; quantity: number }> = [];
  if (newItems.length) {
    for (const n of newItems) {
      const { data: createdAcc, error: createdError } = await input.admin
        .from('accompaniments')
        .insert({
          structure_id: input.structureId,
          name: n.name,
          price: n.price,
          is_available: true,
          is_deleted: false,
        })
        .select('id')
        .single();

      if (createdError || !createdAcc) {
        throw new Error('Failed to create new accompaniment');
      }

      createdNewAccompIds.push({ accompanimentId: createdAcc.id as string, quantity: n.quantity });
    }
  }

  const existingIds = Array.from(new Set(existingItems.map((e) => e.accompanimentId)));
  const createdIds = createdNewAccompIds.map((c) => c.accompanimentId);
  const allIds = Array.from(new Set([...existingIds, ...createdIds]));
  if (!allIds.length) return;

  const { data: accompaniments, error: accompError } = await input.admin
    .from('accompaniments')
    .select('id, is_available, is_deleted')
    .in('id', allIds)
    .eq('structure_id', input.structureId);

  if (accompError || !accompaniments) {
    throw new Error('Failed to validate accompaniments');
  }

  const validIds = new Set(accompaniments.filter((a) => a.is_available && !a.is_deleted).map((a) => a.id as string));

  // Consolidation par accompagnement
  const quantityById = new Map<string, number>();
  for (const item of existingItems) {
    if (!validIds.has(item.accompanimentId)) continue;
    quantityById.set(item.accompanimentId, (quantityById.get(item.accompanimentId) || 0) + item.quantity);
  }

  for (const item of createdNewAccompIds) {
    if (!validIds.has(item.accompanimentId)) continue;
    quantityById.set(item.accompanimentId, (quantityById.get(item.accompanimentId) || 0) + item.quantity);
  }

  if (!quantityById.size) return;

  const rows = Array.from(quantityById.entries()).map(([accompaniment_id, quantity]) => ({
    structure_id: input.structureId,
    product_id: input.productId,
    accompaniment_id,
    quantity,
  }));

  const { error: insertError } = await input.admin.from('product_accompaniments').insert(rows);
  if (insertError) throw new Error(`Failed to save product accompaniments: ${insertError.message}`);
}

// CREATE PRODUCT - Version avec FormData (pour useActionState si nécessaire)
export async function createProductWithFormData(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim() || undefined;
  const category = String(formData.get('category') || '').trim() || undefined;
  const priceValue = Number(formData.get('price') || 0);
  const accompanimentsRaw = formData.get('accompaniments');

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

    if (error) {
      return { success: false, error: error.message || 'Failed to create product' };
    }
    if (!product) {
      return { success: false, error: 'Failed to create product' };
    }

    const accompaniments = parseAccompaniments(accompanimentsRaw);
    await syncProductAccompaniments({
      admin,
      structureId: session.structureId,
      productId: product.id,
      accompaniments,
    });

    revalidatePath('/products');

    return { success: true, error: '' };
  } catch (error) {
    const e: any = error;
    if (typeof e?.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Create product error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create product' };
  }
}

// CREATE PRODUCT - Version avec objet (pour TanStack Query)
export async function createProduct(params: {
  name: string;
  description?: string;
  price: number;
  category?: string;
  isAvailable: boolean;
  accompaniments: ProductAccompanimentFormItem[];
}) {
  if (!params.name || Number.isNaN(params.price) || params.price <= 0) {
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
        name: params.name,
        description: params.description || null,
        price: params.price,
        category: params.category || null,
        is_available: params.isAvailable,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message || 'Failed to create product' };
    }
    if (!product) {
      return { success: false, error: 'Failed to create product' };
    }

    await syncProductAccompaniments({
      admin,
      structureId: session.structureId,
      productId: product.id,
      accompaniments: params.accompaniments,
    });

    revalidatePath('/products');

    return { success: true, error: '' };
  } catch (error) {
    console.error('Create product error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create product' };
  }
}

// Version originale (gardée pour compatibilité)
export async function updateProductOriginal(
  productId: string,
  name: string,
  description: string | undefined,
  price: number,
  category: string | undefined,
  isAvailable: boolean,
  accompaniments: ProductAccompanimentFormItem[]
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
      return { success: false, error: error.message || 'Failed to update product' };
    }

    await syncProductAccompaniments({
      admin,
      structureId: session.structureId,
      productId,
      accompaniments,
    });

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);

    return { success: true };
  } catch (error) {
    console.error('Update product error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update product' };
  }
}

// Nouvelle version qui accepte un objet (pour TanStack Query)
export async function updateProduct(params: {
  productId: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  isAvailable: boolean;
  accompaniments: ProductAccompanimentFormItem[];
}) {
  return updateProductOriginal(
    params.productId,
    params.name,
    params.description,
    params.price,
    params.category,
    params.isAvailable,
    params.accompaniments
  );
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
      return { success: false, error: error.message || 'Failed to delete product' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete product error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete product' };
  }
}
