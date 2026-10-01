import { getAdminSupabase } from '@/lib/supabase';

// Mouvements de stock — module serveur (pas une Server Action), utilisé par la
// caisse comme par l'API marketplace, qui n'a pas de session utilisateur.

export type StockItemType = 'product' | 'accompaniment';

export async function recordStockMovement(input: {
  structureId: string;
  userId?: string | null;
  itemId: string;
  itemType: StockItemType;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  referenceId?: string | null;
}) {
  const admin = getAdminSupabase();
  const isAccompaniment = input.itemType === 'accompaniment';

  const { error: movementError } = await admin.from('stock_movements').insert({
    structure_id: input.structureId,
    product_id: isAccompaniment ? null : input.itemId,
    accompaniment_id: isAccompaniment ? input.itemId : null,
    type: input.type,
    quantity: input.quantity,
    reason: input.reason,
    reference_id: input.referenceId || null,
    user_id: input.userId ?? null,
  });
  if (movementError) throw movementError;

  const { data: currentStock } = await admin
    .from('stocks')
    .select('quantity, threshold')
    .eq('structure_id', input.structureId)
    .eq(isAccompaniment ? 'accompaniment_id' : 'product_id', input.itemId)
    .maybeSingle();

  const currentQty = Number(currentStock?.quantity || 0);
  const newQty =
    input.type === 'IN' ? currentQty + input.quantity : input.type === 'OUT' ? currentQty - input.quantity : input.quantity;

  const { error: stockError } = await admin.from('stocks').upsert(
    {
      structure_id: input.structureId,
      quantity: newQty,
      threshold: currentStock?.threshold ?? 5,
      updated_at: new Date().toISOString(),
      product_id: isAccompaniment ? null : input.itemId,
      accompaniment_id: isAccompaniment ? input.itemId : null,
    },
    { onConflict: isAccompaniment ? 'structure_id, accompaniment_id' : 'structure_id, product_id' }
  );
  if (stockError) throw stockError;
}

/**
 * Sort du stock les produits (ou leurs ingrédients s'ils ont une recette) et
 * les accompagnements d'une commande payée. Sans effet si le point n'a pas le
 * module Stock. Les erreurs sont journalisées, jamais propagées.
 */
export async function deductOrderStock(orderId: string, userId?: string | null) {
  const admin = getAdminSupabase();
  try {
    const { data: order } = await admin
      .from('orders')
      .select('structure_id, structures!structure_id(modules)')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return;
    const structure = (Array.isArray(order.structures) ? order.structures[0] : order.structures) as { modules?: string[] } | null;
    if (!structure?.modules?.includes('STOCK')) return;

    const base = { structureId: order.structure_id as string, userId, reason: 'sale', referenceId: orderId, type: 'OUT' as const };

    const { data: items } = await admin.from('order_items').select('product_id, quantity').eq('order_id', orderId);
    for (const item of items || []) {
      const { data: recipe } = await admin
        .from('product_recipes')
        .select('ingredient_id, quantity')
        .eq('product_id', item.product_id);
      if (recipe && recipe.length > 0) {
        for (const ing of recipe) {
          await recordStockMovement({ ...base, itemId: ing.ingredient_id, itemType: 'product', quantity: ing.quantity * item.quantity });
        }
      } else {
        await recordStockMovement({ ...base, itemId: item.product_id, itemType: 'product', quantity: item.quantity });
      }
    }

    const { data: accompChoices } = await admin
      .from('order_accompaniments')
      .select('accompaniment_id, quantity')
      .eq('order_id', orderId);
    for (const choice of accompChoices || []) {
      await recordStockMovement({ ...base, itemId: choice.accompaniment_id, itemType: 'accompaniment', quantity: choice.quantity });
    }
  } catch (error) {
    console.error('[stock] sortie de stock de la commande :', error);
  }
}
