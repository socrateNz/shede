import { getAdminSupabase } from '@/lib/supabase';
import { grossQuantity, type RecipeUnit } from '@/lib/recipes';
import { notifyStructureStaff } from '@/lib/notifications';

// Mouvements de stock — module serveur (pas une Server Action), utilisé par la
// caisse comme par l'API marketplace, qui n'a pas de session utilisateur.

export type StockItemType = 'product' | 'accompaniment' | 'ingredient';

import { LOSS_REASONS, type LossReason } from '@/lib/stock-constants';
export { LOSS_REASONS, type LossReason };

/** Colonne de stocks / stock_movements qui porte l'élément. */
const ITEM_COLUMN: Record<StockItemType, 'product_id' | 'accompaniment_id' | 'ingredient_id'> = {
  product: 'product_id',
  accompaniment: 'accompaniment_id',
  ingredient: 'ingredient_id',
};

function itemColumns(itemType: StockItemType, itemId: string) {
  return {
    product_id: itemType === 'product' ? itemId : null,
    accompaniment_id: itemType === 'accompaniment' ? itemId : null,
    ...(itemType === 'ingredient' ? { ingredient_id: itemId } : {}),
  };
}

export async function recordStockMovement(input: {
  structureId: string;
  userId?: string | null;
  itemId: string;
  itemType: StockItemType;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  referenceId?: string | null;
  /** Coût unitaire au moment du mouvement (ingrédients). */
  unitCost?: number | null;
  /** Perte déclarée : motif (docs/phase17-inventory.sql) et commentaire. */
  lossReason?: LossReason | null;
  note?: string | null;
}) {
  const admin = getAdminSupabase();
  const column = ITEM_COLUMN[input.itemType];

  const { error: movementError } = await admin.from('stock_movements').insert({
    structure_id: input.structureId,
    ...itemColumns(input.itemType, input.itemId),
    ...(input.unitCost != null ? { unit_cost: input.unitCost } : {}),
    ...(input.lossReason ? { loss_reason: input.lossReason } : {}),
    ...(input.note ? { note: input.note } : {}),
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
    .eq(column, input.itemId)
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
      ...itemColumns(input.itemType, input.itemId),
    },
    { onConflict: `structure_id, ${column}` }
  );
  if (stockError) throw stockError;

  // Passage sous le seuil (pas à chaque mouvement suivant) : le magasin est prévenu une fois
  const threshold = Number(currentStock?.threshold ?? 5);
  if (input.type !== 'IN' && currentQty > threshold && newQty <= threshold) {
    await notifyLowStock(input.structureId, input.itemType, input.itemId, newQty);
  }
}

async function notifyLowStock(structureId: string, itemType: StockItemType, itemId: string, quantity: number) {
  const table = itemType === 'ingredient' ? 'ingredients' : itemType === 'accompaniment' ? 'accompaniments' : 'products';
  const { data: item } = await getAdminSupabase().from(table).select('name').eq('id', itemId).maybeSingle();
  await notifyStructureStaff({
    structureId,
    roles: ['ADMIN', 'MANAGER', 'MAGASINIER'],
    message: ({ t, format }) => ({
      title: t(quantity <= 0 ? 'notify.lowStock.outTitle' : 'notify.lowStock.title'),
      body: t('notify.lowStock.body', { name: (item?.name as string) ?? '—', quantity: format.number(quantity) }),
    }),
    url: itemType === 'ingredient' ? '/stock/ingredients' : '/stock',
  });
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

    const [{ data: items }, { data: accompChoices }] = await Promise.all([
      admin.from('order_items').select('product_id, quantity').eq('order_id', orderId),
      admin.from('order_accompaniments').select('accompaniment_id, quantity').eq('order_id', orderId),
    ]);

    // Fiches recettes (ingrédients) des produits et accompagnements vendus
    const productIds = [...new Set((items || []).map((i) => i.product_id as string).filter(Boolean))];
    const accompanimentIds = [...new Set((accompChoices || []).map((a) => a.accompaniment_id as string).filter(Boolean))];
    const [recipes, productCosts] = await Promise.all([loadRecipeLines(productIds, accompanimentIds), loadPurchaseCosts(productIds)]);

    const consumeRecipe = async (lines: RecipeRow[], soldQuantity: number) => {
      for (const line of lines) {
        await recordStockMovement({
          ...base,
          itemId: line.ingredient_id,
          itemType: 'ingredient',
          quantity: roundQuantity(grossQuantity(line) * soldQuantity),
          unitCost: line.cost_per_unit,
        });
      }
    };

    for (const item of items || []) {
      const lines = recipes.byProduct.get(item.product_id) ?? [];
      if (lines.length) {
        await consumeRecipe(lines, Number(item.quantity));
        continue;
      }
      // Ancien format : product_recipes (ingrédient = produit), sinon le produit lui-même
      const { data: legacy } = await admin
        .from('product_recipes')
        .select('ingredient_id, quantity')
        .eq('product_id', item.product_id);
      if (legacy && legacy.length > 0) {
        for (const ing of legacy) {
          await recordStockMovement({ ...base, itemId: ing.ingredient_id, itemType: 'product', quantity: ing.quantity * item.quantity });
        }
      } else {
        await recordStockMovement({
          ...base,
          itemId: item.product_id,
          itemType: 'product',
          quantity: item.quantity,
          unitCost: productCosts.get(item.product_id) ?? null,
        });
      }
    }

    for (const choice of accompChoices || []) {
      const lines = recipes.byAccompaniment.get(choice.accompaniment_id) ?? [];
      if (lines.length) {
        await consumeRecipe(lines, Number(choice.quantity));
      } else {
        await recordStockMovement({ ...base, itemId: choice.accompaniment_id, itemType: 'accompaniment', quantity: choice.quantity });
      }
    }
  } catch (error) {
    console.error('[stock] sortie de stock de la commande :', error);
  }
}

type RecipeRow = {
  product_id: string | null;
  accompaniment_id: string | null;
  ingredient_id: string;
  quantity: number;
  unit: RecipeUnit;
  waste_percent: number;
  cost_per_unit: number;
};

const roundQuantity = (value: number) => Math.round(value * 10_000) / 10_000;

/** Lignes de recette des produits et accompagnements ; vide si la migration phase 16 n'est pas exécutée. */
async function loadRecipeLines(productIds: string[], accompanimentIds: string[]) {
  const byProduct = new Map<string, RecipeRow[]>();
  const byAccompaniment = new Map<string, RecipeRow[]>();
  if (!productIds.length && !accompanimentIds.length) return { byProduct, byAccompaniment };

  const filters = [
    productIds.length ? `product_id.in.(${productIds.join(',')})` : null,
    accompanimentIds.length ? `accompaniment_id.in.(${accompanimentIds.join(',')})` : null,
  ].filter(Boolean);
  const { data, error } = await getAdminSupabase()
    .from('recipe_items')
    .select('product_id, accompaniment_id, ingredient_id, quantity, unit, waste_percent, ingredients(cost_per_unit)')
    .or(filters.join(','));
  if (error) return { byProduct, byAccompaniment };

  for (const row of data || []) {
    const ingredient = (Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients) as { cost_per_unit?: number } | null;
    const line: RecipeRow = {
      product_id: row.product_id,
      accompaniment_id: row.accompaniment_id,
      ingredient_id: row.ingredient_id,
      quantity: Number(row.quantity),
      unit: row.unit as RecipeUnit,
      waste_percent: Number(row.waste_percent) || 0,
      cost_per_unit: Number(ingredient?.cost_per_unit) || 0,
    };
    const map = line.product_id ? byProduct : byAccompaniment;
    const key = (line.product_id ?? line.accompaniment_id) as string;
    map.set(key, [...(map.get(key) ?? []), line]);
  }
  return { byProduct, byAccompaniment };
}

/**
 * Déclare une perte : un plat ou un accompagnement qui a une fiche recette sort
 * ses ingrédients (ils ont été utilisés) ; sinon l'article lui-même sort du stock.
 * Renvoie la valeur de la perte (XAF, ingrédients valorisés seulement).
 */
export async function recordLoss(input: {
  structureId: string;
  userId?: string | null;
  itemId: string;
  itemType: StockItemType;
  quantity: number;
  reason: LossReason;
  note?: string | null;
}) {
  const base = {
    structureId: input.structureId,
    userId: input.userId,
    type: 'OUT' as const,
    reason: 'loss',
    lossReason: input.reason,
    note: input.note ?? null,
  };

  if (input.itemType !== 'ingredient') {
    const recipes = await loadRecipeLines(
      input.itemType === 'product' ? [input.itemId] : [],
      input.itemType === 'accompaniment' ? [input.itemId] : []
    );
    const lines = (input.itemType === 'product' ? recipes.byProduct : recipes.byAccompaniment).get(input.itemId) ?? [];
    if (lines.length) {
      let value = 0;
      for (const line of lines) {
        const quantity = roundQuantity(grossQuantity(line) * input.quantity);
        await recordStockMovement({ ...base, itemId: line.ingredient_id, itemType: 'ingredient', quantity, unitCost: line.cost_per_unit });
        value += quantity * line.cost_per_unit;
      }
      return Math.round(value);
    }
    // Produit revendu tel quel : valorisé à son coût d'achat moyen (module ACHATS)
    const unitCost = input.itemType === 'product' ? (await loadPurchaseCosts([input.itemId])).get(input.itemId) ?? null : null;
    await recordStockMovement({ ...base, itemId: input.itemId, itemType: input.itemType, quantity: input.quantity, unitCost });
    return unitCost === null ? 0 : Math.round(input.quantity * unitCost);
  }

  const { data: ingredient } = await getAdminSupabase()
    .from('ingredients')
    .select('cost_per_unit')
    .eq('id', input.itemId)
    .eq('structure_id', input.structureId)
    .maybeSingle();
  const unitCost = Number(ingredient?.cost_per_unit) || 0;
  await recordStockMovement({ ...base, itemId: input.itemId, itemType: 'ingredient', quantity: input.quantity, unitCost });
  return Math.round(input.quantity * unitCost);
}

/** Coût d'achat moyen des produits revendus (products.purchase_cost, docs/phase18-purchasing.sql). */
async function loadPurchaseCosts(productIds: string[]) {
  const costs = new Map<string, number>();
  if (!productIds.length) return costs;
  // select('*') : tolère l'absence de la colonne avant la migration.
  const { data } = await getAdminSupabase().from('products').select('*').in('id', productIds);
  for (const p of data || []) {
    if (p.purchase_cost !== null && p.purchase_cost !== undefined) costs.set(p.id as string, Number(p.purchase_cost));
  }
  return costs;
}
