'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { requireModule } from './auth';
import { revalidatePath } from 'next/cache';
import { deductOrderStock, recordStockMovement } from '@/lib/stock';

export type StockItemType = 'product' | 'accompaniment' | 'ingredient';

export async function getStockList() {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  // 1. Produits
  const { data: productStocks, error: productError } = await admin
    .from('products')
    .select(`
      id,
      name,
      category,
      stocks(quantity, threshold)
    `)
    .eq('structure_id', session.structureId)
    .eq('is_deleted', false)
    .order('name');

  if (productError) {
    console.error('Error fetching product stock list:', productError);
  }

  const productItems = (productStocks || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    quantity: p.stocks?.[0]?.quantity ?? 0,
    threshold: p.stocks?.[0]?.threshold ?? 5,
    type: 'product' as StockItemType,
  }));

  // 2. Accompagnements
  const { data: accompStocks, error: accompError } = await admin
    .from('accompaniments')
    .select(`
      id,
      name,
      stocks(quantity, threshold)
    `)
    .eq('structure_id', session.structureId)
    .eq('is_available', true)
    .eq('is_deleted', false)
    .order('name');

  if (accompError) {
    console.error('Error fetching accompaniment stock list:', accompError);
  }

  const accompItems = (accompStocks || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    category: null,
    quantity: a.stocks?.[0]?.quantity ?? 0,
    threshold: a.stocks?.[0]?.threshold ?? 5,
    type: 'accompaniment' as StockItemType,
  }));

  // 3. Ingrédients (docs/phase16-ingredients.sql ; absents avant la migration)
  const { data: ingredientStocks } = await admin
    .from('ingredients')
    .select('id, name, unit, stocks(quantity, threshold)')
    .eq('structure_id', session.structureId)
    .eq('is_active', true)
    .order('name');

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

export async function getStockMovements(itemId?: string, itemType?: StockItemType) {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  const run = (withIngredients: boolean) => {
    let query = admin
      .from('stock_movements')
      .select(`*, products(name), accompaniments(name), ${withIngredients ? 'ingredients(name, unit), ' : ''}users(first_name, last_name)`)
      .eq('structure_id', session.structureId)
      .order('created_at', { ascending: false });
    if (itemId) {
      const column = itemType === 'ingredient' ? 'ingredient_id' : itemType === 'accompaniment' ? 'accompaniment_id' : 'product_id';
      query = query.eq(column, itemId);
    }
    return query;
  };

  let { data, error } = await run(true);
  // Avant docs/phase16-ingredients.sql, la relation ingredients n'existe pas.
  if (error) ({ data, error } = await run(false));

  if (error) {
    console.error('Error fetching movements:', error);
    return [];
  }

  // Normalize: expose a unified `item_name` field
  return (data || []).map((m: any) => ({
    ...m,
    item_name: m.products?.name || m.accompaniments?.name || m.ingredients?.name || '—',
    item_type: m.ingredient_id ? 'ingredient' : m.accompaniment_id ? 'accompaniment' : 'product',
    item_unit: m.ingredients?.unit ?? null,
  }));
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
