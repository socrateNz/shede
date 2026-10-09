'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { requireModule } from './auth';
import { revalidatePath } from 'next/cache';
import { deductOrderStock, recordStockMovement } from '@/lib/stock';
import { buildMeta, fetchAll, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';

export type StockItemType = 'product' | 'accompaniment' | 'ingredient';

export async function getStockList() {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  // 1. Produits
  // Lectures complètes par tranches : l'API coupe sans erreur au-delà de 1000 lignes.
  const productStocks = await fetchAll<any>((from, to) =>
    admin
      .from('products')
      .select('id, name, category, stocks(quantity, threshold)')
      .eq('structure_id', session.structureId)
      .eq('is_deleted', false)
      .order('name')
      .order('id')
      .range(from, to),
  ).catch((error) => {
    console.error('Error fetching product stock list:', error);
    return [];
  });

  const productItems = (productStocks || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    quantity: p.stocks?.[0]?.quantity ?? 0,
    threshold: p.stocks?.[0]?.threshold ?? 5,
    type: 'product' as StockItemType,
  }));

  // 2. Accompagnements
  const accompStocks = await fetchAll<any>((from, to) =>
    admin
      .from('accompaniments')
      .select('id, name, stocks(quantity, threshold)')
      .eq('structure_id', session.structureId)
      .eq('is_available', true)
      .eq('is_deleted', false)
      .order('name')
      .order('id')
      .range(from, to),
  ).catch((error) => {
    console.error('Error fetching accompaniment stock list:', error);
    return [];
  });

  const accompItems = (accompStocks || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    category: null,
    quantity: a.stocks?.[0]?.quantity ?? 0,
    threshold: a.stocks?.[0]?.threshold ?? 5,
    type: 'accompaniment' as StockItemType,
  }));

  // 3. Ingrédients (docs/phase16-ingredients.sql ; absents avant la migration)
  const ingredientStocks = await fetchAll<any>((from, to) =>
    admin
      .from('ingredients')
      .select('id, name, unit, stocks(quantity, threshold)')
      .eq('structure_id', session.structureId)
      .eq('is_active', true)
      .order('name')
      .order('id')
      .range(from, to),
  ).catch(() => []);

  const ingredientItems = (ingredientStocks || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    category: null,
    unit: i.unit as string,
    quantity: Number(i.stocks?.[0]?.quantity) || 0,
    threshold: Number(i.stocks?.[0]?.threshold) || 0,
    type: 'ingredient' as StockItemType,
  }));

  return [...productItems, ...accompItems, ...ingredientItems];
}

export type StockListStats = {
  total: number;
  byType: Record<StockItemType, number>;
  low: number;
  lowByType: Record<StockItemType, number>;
};

/** Seuil atteint ; un ingrédient n'est en alerte que s'il a un seuil. */
function isLowStock(item: { type: StockItemType; quantity: number; threshold: number }) {
  return item.type === 'ingredient' ? item.threshold > 0 && item.quantity <= item.threshold : item.quantity <= item.threshold;
}

/**
 * État du stock, 20 lignes par page. Le catalogue (produits, accompagnements, ingrédients)
 * est lu en entier côté serveur pour des statistiques exactes ; seule la page part au navigateur.
 */
export async function listStock(filters: { page?: number; q?: string; type?: string | null; low?: boolean } = {}): Promise<Paginated<Awaited<ReturnType<typeof getStockList>>[number], StockListStats>> {
  const all = await getStockList();
  const types: StockItemType[] = ['product', 'accompaniment', 'ingredient'];
  const stats: StockListStats = {
    total: all.length,
    byType: Object.fromEntries(types.map((ty) => [ty, all.filter((s) => s.type === ty).length])) as Record<StockItemType, number>,
    low: all.filter(isLowStock).length,
    lowByType: Object.fromEntries(types.map((ty) => [ty, all.filter((s) => s.type === ty && isLowStock(s)).length])) as Record<StockItemType, number>,
  };
  const q = searchTerm(filters.q).toLowerCase();
  const type = types.find((ty) => ty === filters.type) ?? null;
  const filtered = all.filter((s) => (!type || s.type === type) && (!filters.low || isLowStock(s)) && (!q || s.name.toLowerCase().includes(q)));
  const page = Math.max(1, filters.page ?? 1);
  const [from, to] = pageRange(page);
  return { items: filtered.slice(from, to + 1), meta: buildMeta(page, filtered.length, stats) };
}

export async function getAvailableAccompanimentsForStock() {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  const { data, error } = await admin
    .from('accompaniments')
    .select('id, name')
    .eq('structure_id', session.structureId)
    .eq('is_available', true)
    .eq('is_deleted', false)
    .order('name');

  if (error) return [];
  return data || [];
}

export async function addStockMovement(
  itemId: string,
  type: 'IN' | 'OUT' | 'ADJUSTMENT',
  quantity: number,
  reason: string,
  itemType: StockItemType = 'product',
  referenceId?: string
) {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type) || !Number.isFinite(quantity) || quantity < 0) {
    return { success: false, error: 'invalid_quantity' };
  }

  // L'article doit appartenir au point connecté.
  const table = itemType === 'ingredient' ? 'ingredients' : itemType === 'accompaniment' ? 'accompaniments' : 'products';
  const { data: item } = await admin
    .from(table)
    .select(itemType === 'ingredient' ? 'id, cost_per_unit' : 'id')
    .eq('id', itemId)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!item) return { success: false, error: 'not_found' };

  try {
    await recordStockMovement({
      structureId: session.structureId as string,
      userId: session.userId,
      itemId,
      itemType,
      type,
      quantity,
      reason,
      referenceId: referenceId || null,
      unitCost: itemType === 'ingredient' ? Number((item as { cost_per_unit?: number }).cost_per_unit) || 0 : null,
    });
    revalidatePath('/stock');
    revalidatePath('/stock/ingredients');
    return { success: true };
  } catch (error: any) {
    console.error('Stock movement error:', error);
    return { success: false, error: error.message };
  }
}

export async function processOrderStock(orderId: string) {
  const session = await getSession();
  if (!session || !session.modules?.includes('STOCK')) return;

  // Uniquement une commande du point de l'utilisateur.
  const { data: order } = await getAdminSupabase()
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!order) return;

  await deductOrderStock(orderId, session.userId);
}

export type StockMovementListStats = { total: number; in: number; out: number; adjustment: number };

/**
 * Mouvements de stock du point, 20 par page (les plus récents d'abord), filtres par sens
 * (IN, OUT, ADJUSTMENT) et par type d'article ; statistiques en SQL.
 */
export async function listStockMovements(filters: { page?: number; direction?: string | null; kind?: string | null } = {}): Promise<Paginated<any, StockMovementListStats>> {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();
  const page = Math.max(1, filters.page ?? 1);
  const [from, to] = pageRange(page);

  let query = admin
    .from('stock_movements')
    .select('*, products(name), accompaniments(name), ingredients(name, unit), users(first_name, last_name)', { count: 'exact' })
    .eq('structure_id', session.structureId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (filters.direction === 'IN' || filters.direction === 'OUT' || filters.direction === 'ADJUSTMENT') query = query.eq('type', filters.direction);
  if (filters.kind === 'ingredient') query = query.not('ingredient_id', 'is', null);
  if (filters.kind === 'accompaniment') query = query.not('accompaniment_id', 'is', null);
  if (filters.kind === 'product') query = query.not('product_id', 'is', null);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('stock_movement_list_stats', { p_structure_id: session.structureId })]);
  if (error) console.error('Error fetching movements:', error);
  const raw = (statsRes.data ?? {}) as Partial<StockMovementListStats>;
  const stats: StockMovementListStats = { total: Number(raw.total) || 0, in: Number(raw.in) || 0, out: Number(raw.out) || 0, adjustment: Number(raw.adjustment) || 0 };
  // Libellé unifié de l'article (produit, accompagnement ou ingrédient)
  const items = (data || []).map((m: any) => ({
    ...m,
    item_name: m.products?.name || m.accompaniments?.name || m.ingredients?.name || '—',
    item_type: m.ingredient_id ? 'ingredient' : m.accompaniment_id ? 'accompaniment' : 'product',
    item_unit: m.ingredients?.unit ?? null,
  }));
  return { items, meta: buildMeta(page, count ?? 0, stats) };
}

export async function updateProductRecipe(productId: string, ingredients: { ingredientId: string, quantity: number }[]) {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  try {
    await admin
      .from('product_recipes')
      .delete()
      .eq('product_id', productId);

    if (ingredients.length > 0) {
      const { error } = await admin
        .from('product_recipes')
        .insert(ingredients.map(ing => ({
          structure_id: session.structureId,
          product_id: productId,
          ingredient_id: ing.ingredientId,
          quantity: ing.quantity,
        })));

      if (error) throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Recipe update error:', error);
    return { success: false, error: error.message };
  }
}
