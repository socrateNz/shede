'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { te } from '@/lib/i18n/server';
import { emitMenuUpdated } from '@/lib/api/webhooks';
import { categoryIdsByProduct, loadCategories, setProductCategories } from '@/lib/categories';
import { buildMeta, emptyPage, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';
import type { Product } from '@/lib/supabase';

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

    // Catégories de chaque produit (plusieurs possibles), dans l'ordre du point.
    const products = data || [];
    const [categories, links] = await Promise.all([
      loadCategories(session.structureId),
      categoryIdsByProduct(products.map((p) => p.id as string)),
    ]);
    return products.map((p) => {
      const ids = new Set(links.get(p.id) ?? []);
      return { ...p, categories: categories.filter((c) => ids.has(c.id)) };
    });
  } catch (error) {
    console.error('getProducts error:', error);
    return [];
  }
}


export type ProductListStats = { total: number; available: number; unavailable: number; categories: number };
export type ProductListFilters = { page?: number; q?: string; category?: string | null; destination?: string | null };

/**
 * Produits du point, 20 par page (ordre alphabétique), filtrés côté serveur
 * (recherche, catégorie avec ses sous-catégories, destination) ; statistiques en SQL.
 */
export async function listProducts(filters: ProductListFilters = {}): Promise<Paginated<Product, ProductListStats>> {
  const empty: ProductListStats = { total: 0, available: 0, unavailable: 0, categories: 0 };
  const session = await getSession();
  const page = Math.max(1, filters.page ?? 1);
  if (!session?.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const categories = await loadCategories(session.structureId);
  const [from, to] = pageRange(page);
  const q = searchTerm(filters.q);

  // Catégorie : le produit doit être lié à elle ou à l'une de ses sous-catégories.
  const category = filters.category && (filters.category === 'NONE' || categories.some((c) => c.id === filters.category)) ? filters.category : null;
  const categoryIds = category && category !== 'NONE' ? [category, ...categories.filter((c) => c.parent_id === category).map((c) => c.id)] : [];
  const select = category === 'NONE' ? '*, product_category_links!left(category_id)' : category ? '*, product_category_links!inner(category_id)' : '*';

  let query = admin
    .from('products')
    .select(select, { count: 'exact' })
    .eq('structure_id', session.structureId)
    .eq('is_deleted', false)
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to);
  if (category === 'NONE') query = query.is('product_category_links', null);
  else if (category) query = query.in('product_category_links.category_id', categoryIds);
  if (filters.destination === 'CUISINE' || filters.destination === 'BAR') query = query.eq('destination', filters.destination);
  if (q) query = query.ilike('name', `%${q}%`);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('product_list_stats', { p_structure_id: session.structureId })]);
  if (error) console.error('[listProducts] Error:', error);
  const rows = ((data ?? []) as any[]).map(({ product_category_links: _links, ...p }) => p);
  const links = await categoryIdsByProduct(rows.map((p) => p.id as string));
  const items = rows.map((p) => {
    const ids = new Set(links.get(p.id) ?? []);
    return { ...p, categories: categories.filter((c) => ids.has(c.id)) } as Product;
  });
  const raw = (statsRes.data ?? empty) as ProductListStats;
  const stats: ProductListStats = {
    total: Number(raw.total) || 0,
    available: Number(raw.available) || 0,
    unavailable: Number(raw.unavailable) || 0,
    categories: Number(raw.categories) || 0,
  };
  return { items, meta: buildMeta(page, count ?? 0, stats) };
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
        throw new Error(await te('errors.accompanimentCreateFailed'));
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
    throw new Error(await te('errors.accompanimentsValidationFailed'));
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
  if (insertError) throw new Error(await te('errors.productAccompanimentsFailed'));
}

// CREATE PRODUCT - Version avec FormData (pour useActionState si nécessaire)
export async function createProductWithFormData(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim() || undefined;
  const categoryIds = formData.getAll('categoryIds').map(String).filter(Boolean);
  const priceValue = Number(formData.get('price') || 0);
  const accompanimentsRaw = formData.get('accompaniments');

  if (!name || Number.isNaN(priceValue) || priceValue <= 0) {
    return { success: false, error: await te('errors.productInvalidData') };
  }

  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
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
        is_available: true,
        is_deliverable: formData.get('isDeliverable') !== 'off',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: await te('errors.productCreateFailed') };
    }
    if (!product) {
      return { success: false, error: await te('errors.productCreateFailed') };
    }

    await setProductCategories(admin, session.structureId as string, product.id, categoryIds);

    const accompaniments = parseAccompaniments(accompanimentsRaw);
    await syncProductAccompaniments({
      admin,
      structureId: session.structureId as string,
      productId: product.id,
      accompaniments,
    });

    revalidatePath('/products');
    await emitMenuUpdated(session.structureId as string, { product_id: product.id, change: 'created' });

    return { success: true, error: '' };
  } catch (error) {
    const e: any = error;
    if (typeof e?.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Create product error:', error);
    return { success: false, error: error instanceof Error ? error.message : await te('errors.productCreateFailed') };
  }
}

// CREATE PRODUCT - Version avec objet (pour TanStack Query)
export async function createProduct(params: {
  name: string;
  description?: string;
  price: number;
  /** Catégories choisies (créées à part dans /categories). */
  categoryIds?: string[];
  destination?: string;
  image_url?: string;
  isAvailable: boolean;
  /** false : le produit ne peut pas être commandé en livraison. */
  isDeliverable?: boolean;
  accompaniments: ProductAccompanimentFormItem[];
  threshold?: number;
}) {
  if (!params.name || Number.isNaN(params.price) || params.price <= 0) {
    return { success: false, error: await te('errors.productInvalidData') };
  }

  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
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
        destination: params.destination || 'CUISINE',
        image_url: params.image_url !== undefined ? params.image_url : null,
        is_available: params.isAvailable,
        is_deliverable: params.isDeliverable !== false,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: await te('errors.productCreateFailed') };
    }
    if (!product) {
      return { success: false, error: await te('errors.productCreateFailed') };
    }

    if (params.categoryIds) {
      await setProductCategories(admin, session.structureId as string, product.id, params.categoryIds);
    }

    await syncProductAccompaniments({
      admin,
      structureId: session.structureId as string,
      productId: product.id,
      accompaniments: params.accompaniments,
    });

    if (params.threshold !== undefined) {
      await admin.from('stocks').upsert({
        structure_id: session.structureId,
        product_id: product.id,
        threshold: params.threshold,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'structure_id, product_id' });
    }

    revalidatePath('/products');
    await emitMenuUpdated(session.structureId as string, { product_id: product.id, change: 'created' });

    return { success: true, error: '' };
  } catch (error) {
    console.error('Create product error:', error);
    return { success: false, error: error instanceof Error ? error.message : await te('errors.productCreateFailed') };
  }
}

// UPDATE PRODUCT
export async function updateProduct(params: {
  productId: string;
  name: string;
  description?: string;
  price: number;
  /** Catégories choisies (créées à part dans /categories). */
  categoryIds?: string[];
  destination?: string;
  image_url?: string;
  isAvailable: boolean;
  /** false : le produit ne peut pas être commandé en livraison. */
  isDeliverable?: boolean;
  accompaniments: ProductAccompanimentFormItem[];
  threshold?: number;
}) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('products')
      .update({
        name: params.name,
        description: params.description || null,
        price: params.price,
        destination: params.destination || 'CUISINE',
        image_url: params.image_url !== undefined ? params.image_url : null,
        is_available: params.isAvailable,
        ...(params.isDeliverable !== undefined ? { is_deliverable: params.isDeliverable } : {}),
      })
      .eq('id', params.productId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.productUpdateFailed') };
    }

    if (params.categoryIds) {
      await setProductCategories(admin, session.structureId as string, params.productId, params.categoryIds);
    }

    await syncProductAccompaniments({
      admin,
      structureId: session.structureId as string,
      productId: params.productId,
      accompaniments: params.accompaniments,
    });

    if (params.threshold !== undefined) {
      await admin.from('stocks').upsert({
        structure_id: session.structureId,
        product_id: params.productId,
        threshold: params.threshold,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'structure_id, product_id' });
    }

    revalidatePath('/products');
    revalidatePath(`/products/${params.productId}`);
    await emitMenuUpdated(session.structureId as string, {
      product_id: params.productId,
      change: 'updated',
      is_available: params.isAvailable,
      is_deliverable: params.isDeliverable !== false,
    });

    return { success: true };
  } catch (error) {
    console.error('Update product error:', error);
    return { success: false, error: error instanceof Error ? error.message : await te('errors.productUpdateFailed') };
  }
}

export async function deleteProduct(productId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('products')
      .update({ is_deleted: true })
      .eq('id', productId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.productDeleteFailed') };
    }

    await emitMenuUpdated(session.structureId as string, { product_id: productId, change: 'deleted' });
    return { success: true };
  } catch (error) {
    console.error('Delete product error:', error);
    return { success: false, error: error instanceof Error ? error.message : await te('errors.productDeleteFailed') };
  }
}
