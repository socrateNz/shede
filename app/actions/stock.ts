'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { requireModule } from './auth';
import { revalidatePath } from 'next/cache';

export type StockItemType = 'product' | 'accompaniment';

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

  return [...productItems, ...accompItems];
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

  const isAccompaniment = itemType === 'accompaniment';

  try {
    // 1. Create the movement
    const { error: movementError } = await admin
      .from('stock_movements')
      .insert({
        structure_id: session.structureId,
        product_id: isAccompaniment ? null : itemId,
        accompaniment_id: isAccompaniment ? itemId : null,
        type,
        quantity,
        reason,
        reference_id: referenceId || null,
        user_id: session.userId,
      });

    if (movementError) throw movementError;

    // 2. Fetch current stock
    let stockQuery = admin
      .from('stocks')
      .select('quantity, threshold')
      .eq('structure_id', session.structureId);

    if (isAccompaniment) {
      stockQuery = stockQuery.eq('accompaniment_id', itemId) as any;
    } else {
      stockQuery = stockQuery.eq('product_id', itemId) as any;
    }

    const { data: currentStock } = await (stockQuery as any).maybeSingle();

    const currentQty = Number(currentStock?.quantity || 0);
    let newQty = currentQty;

    if (type === 'IN') newQty += quantity;
    else if (type === 'OUT') newQty -= quantity;
    else if (type === 'ADJUSTMENT') newQty = quantity;

    // 3. Upsert stock record
    const upsertPayload: Record<string, any> = {
      structure_id: session.structureId,
      quantity: newQty,
      threshold: currentStock?.threshold ?? 5,
      updated_at: new Date().toISOString(),
    };

    if (isAccompaniment) {
      upsertPayload.accompaniment_id = itemId;
      upsertPayload.product_id = null;
    } else {
      upsertPayload.product_id = itemId;
      upsertPayload.accompaniment_id = null;
    }

    const conflictKey = isAccompaniment
      ? 'structure_id, accompaniment_id'
      : 'structure_id, product_id';

    const { error: stockError } = await admin
      .from('stocks')
      .upsert(upsertPayload, { onConflict: conflictKey });

    if (stockError) throw stockError;

    revalidatePath('/stock');
    return { success: true };
  } catch (error: any) {
    console.error('Stock movement error:', error);
    return { success: false, error: error.message };
  }
}

export async function processOrderStock(orderId: string) {
  const session = await getSession();
  if (!session || !session.modules?.includes('STOCK')) return;

  const admin = getAdminSupabase();

  try {
    // 1. Fetch order items (products)
    const { data: items } = await admin
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    if (!items) return;

    for (const item of items) {
      // 2. Check if product has a recipe (composition)
      const { data: recipe } = await admin
        .from('product_recipes')
        .select('ingredient_id, quantity')
        .eq('product_id', item.product_id);

      if (recipe && recipe.length > 0) {
        for (const ing of recipe) {
          await addStockMovement(
            ing.ingredient_id,
            'OUT',
            ing.quantity * item.quantity,
            'sale',
            'product',
            orderId
          );
        }
      } else {
        await addStockMovement(
          item.product_id,
          'OUT',
          item.quantity,
          'sale',
          'product',
          orderId
        );
      }
    }

    // 3. Fetch order accompaniments and deduct their stock
    const { data: accompChoices } = await admin
      .from('order_accompaniments')
      .select('accompaniment_id, quantity')
      .eq('order_id', orderId);

    if (accompChoices && accompChoices.length > 0) {
      for (const choice of accompChoices) {
        await addStockMovement(
          choice.accompaniment_id,
          'OUT',
          choice.quantity,
          'sale',
          'accompaniment',
          orderId
        );
      }
    }
  } catch (error) {
    console.error('Error processing order stock:', error);
  }
}

export async function getStockMovements(itemId?: string, itemType?: StockItemType) {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  let query = admin
    .from('stock_movements')
    .select(`
      *,
      products(name),
      accompaniments(name),
      users(first_name, last_name)
    `)
    .eq('structure_id', session.structureId)
    .order('created_at', { ascending: false });

  if (itemId && itemType === 'accompaniment') {
    query = query.eq('accompaniment_id', itemId) as any;
  } else if (itemId) {
    query = query.eq('product_id', itemId) as any;
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching movements:', error);
    return [];
  }

  // Normalize: expose a unified `item_name` field
  return (data || []).map((m: any) => ({
    ...m,
    item_name: m.products?.name || m.accompaniments?.name || '—',
    item_type: m.accompaniment_id ? 'accompaniment' : 'product',
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
