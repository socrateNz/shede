'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { requireModule } from './auth';
import { revalidatePath } from 'next/cache';

export async function getStockList() {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  const { data, error } = await admin
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

  if (error) {
    console.error('Error fetching stock list:', error);
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    quantity: p.stocks?.[0]?.quantity || 0,
    threshold: p.stocks?.[0]?.threshold || 5,
  }));
}

export async function addStockMovement(
  productId: string,
  type: 'IN' | 'OUT' | 'ADJUSTMENT',
  quantity: number,
  reason: string,
  referenceId?: string
) {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  try {
    // 1. Create the movement
    const { error: movementError } = await admin
      .from('stock_movements')
      .insert({
        structure_id: session.structureId,
        product_id: productId,
        type,
        quantity,
        reason,
        reference_id: referenceId || null,
        user_id: session.userId,
      });

    if (movementError) throw movementError;

    // 2. Update the stock quantity
    // We fetch current stock first
    const { data: currentStock } = await admin
      .from('stocks')
      .select('quantity, threshold')
      .eq('structure_id', session.structureId)
      .eq('product_id', productId)
      .maybeSingle();

    const currentQty = Number(currentStock?.quantity || 0);
    let newQty = currentQty;

    if (type === 'IN') newQty += quantity;
    else if (type === 'OUT') newQty -= quantity;
    else if (type === 'ADJUSTMENT') newQty = quantity;

    const { error: stockError } = await admin
      .from('stocks')
      .upsert({
        structure_id: session.structureId,
        product_id: productId,
        quantity: newQty,
        threshold: currentStock?.threshold ?? 5, // Preserve existing threshold
        updated_at: new Date().toISOString(),
      }, { onConflict: 'structure_id, product_id' });

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
    // 1. Fetch order items
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
        // Reduce stock for each ingredient
        for (const ing of recipe) {
          await addStockMovement(
            ing.ingredient_id,
            'OUT',
            ing.quantity * item.quantity,
            'sale',
            orderId
          );
        }
      } else {
        // Direct reduction for the product itself
        await addStockMovement(
          item.product_id,
          'OUT',
          item.quantity,
          'sale',
          orderId
        );
      }
    }
  } catch (error) {
    console.error('Error processing order stock:', error);
  }
}

export async function getStockMovements(productId?: string) {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  let query = admin
    .from('stock_movements')
    .select(`
      *,
      products(name),
      users(first_name, last_name)
    `)
    .eq('structure_id', session.structureId)
    .order('created_at', { ascending: false });

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching movements:', error);
    return [];
  }

  return data;
}

export async function updateProductRecipe(productId: string, ingredients: { ingredientId: string, quantity: number }[]) {
  const session = await requireModule('STOCK');
  const admin = getAdminSupabase();

  try {
    // 1. Delete existing recipe
    await admin
      .from('product_recipes')
      .delete()
      .eq('product_id', productId);

    if (ingredients.length > 0) {
      // 2. Insert new recipe
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
