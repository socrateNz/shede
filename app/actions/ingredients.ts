'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { recordStockMovement } from '@/lib/stock';
import { INGREDIENT_UNITS, type IngredientUnit } from '@/lib/recipes';

// Ingrédients du point (docs/phase16-ingredients.sql), module STOCK : ce qu'on
// achète et stocke, distinct des produits du menu.

type Result = { success: boolean; error: string };

export type IngredientRow = {
  id: string;
  name: string;
  unit: IngredientUnit;
  cost_per_unit: number;
  is_active: boolean;
  quantity: number;
  threshold: number;
  /** Nombre de fiches recettes qui l'utilisent. */
  recipe_count: number;
};

const MANAGE_ROLES = ['ADMIN', 'MANAGER', 'MAGASINIER', 'SUPER_ADMIN'];

async function requireStockManager() {
  const session = await getSession();
  if (!session?.structureId || !MANAGE_ROLES.includes(session.role)) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.modules?.includes('STOCK')) return null;
  return session as typeof session & { structureId: string };
}

function revalidateStock() {
  revalidatePath('/stock');
  revalidatePath('/stock/ingredients');
  revalidatePath('/stock/food-cost');
}

/** Ingrédients du point avec leur stock. null : migration phase 16 non exécutée. */
export async function listIngredients(): Promise<IngredientRow[] | null> {
  const session = await requireStockManager();
  if (!session) return [];
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('ingredients')
    .select('id, name, unit, cost_per_unit, is_active, stocks(quantity, threshold), recipe_items(id)')
    .eq('structure_id', session.structureId)
    .order('name', { ascending: true });
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? null : [];
  return (data || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    cost_per_unit: Number(i.cost_per_unit) || 0,
    is_active: i.is_active !== false,
    quantity: Number(i.stocks?.[0]?.quantity) || 0,
    threshold: Number(i.stocks?.[0]?.threshold ?? 0) || 0,
    recipe_count: (i.recipe_items || []).length,
  }));
}

type IngredientInput = {
  name: string;
  unit: string;
  costPerUnit: number;
  threshold: number;
  /** Création seulement : stock de départ (entrée en stock). */
  initialQuantity?: number;
};

async function validate(input: IngredientInput) {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return { error: await te('ingredients.errors.nameRequired') };
  if (!INGREDIENT_UNITS.includes(input.unit as IngredientUnit)) return { error: await te('ingredients.errors.unitInvalid') };
  const cost = Number(input.costPerUnit);
  const threshold = Number(input.threshold);
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(threshold) || threshold < 0) {
    return { error: await te('ingredients.errors.amountInvalid') };
  }
  return { name, unit: input.unit as IngredientUnit, cost: Math.round(cost * 100) / 100, threshold };
}

async function dbError(error: { code?: string; message?: string }, fallback: 'errors.createFailed' | 'errors.updateFailed' | 'errors.deleteFailed') {
  if (error.code === '23505') return te('ingredients.errors.duplicate');
  if (error.code === '23503') return te('ingredients.errors.inUse');
  if (error.message?.includes('ingredient_unit_in_use')) return te('ingredients.errors.unitInUse');
  return te(fallback);
}

/** Seuil d'alerte : porté par la ligne de stock de l'ingrédient. */
async function saveThreshold(structureId: string, ingredientId: string, threshold: number) {
  const admin = getAdminSupabase();
  const { data: stock } = await admin
    .from('stocks')
    .select('quantity')
    .eq('structure_id', structureId)
    .eq('ingredient_id', ingredientId)
    .maybeSingle();
  await admin.from('stocks').upsert(
    {
      structure_id: structureId,
      ingredient_id: ingredientId,
      product_id: null,
      accompaniment_id: null,
      quantity: Number(stock?.quantity) || 0,
      threshold,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'structure_id, ingredient_id' }
  );
}

export async function createIngredient(input: IngredientInput): Promise<Result> {
  const session = await requireStockManager();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const valid = await validate(input);
  if ('error' in valid) return { success: false, error: valid.error as string };

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('ingredients')
    .insert({ structure_id: session.structureId, name: valid.name, unit: valid.unit, cost_per_unit: valid.cost })
    .select('id')
    .single();
  if (error || !data) return { success: false, error: await dbError(error ?? {}, 'errors.createFailed') };

  await saveThreshold(session.structureId, data.id, valid.threshold);
  const initial = Number(input.initialQuantity) || 0;
  if (initial > 0) {
    await recordStockMovement({
      structureId: session.structureId,
      userId: session.userId,
      itemId: data.id,
      itemType: 'ingredient',
      type: 'IN',
      quantity: initial,
      reason: 'initial_stock',
      unitCost: valid.cost,
    });
  }
  revalidateStock();
  return { success: true, error: '' };
}

export async function updateIngredient(id: string, input: IngredientInput & { isActive?: boolean }): Promise<Result> {
  const session = await requireStockManager();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const valid = await validate(input);
  if ('error' in valid) return { success: false, error: valid.error as string };

  const { error } = await getAdminSupabase()
    .from('ingredients')
    .update({
      name: valid.name,
      unit: valid.unit,
      cost_per_unit: valid.cost,
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq('id', id)
    .eq('structure_id', session.structureId);
  if (error) return { success: false, error: await dbError(error, 'errors.updateFailed') };

  await saveThreshold(session.structureId, id, valid.threshold);
  revalidateStock();
  return { success: true, error: '' };
}

export async function setIngredientActive(id: string, isActive: boolean): Promise<Result> {
  const session = await requireStockManager();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { error } = await getAdminSupabase()
    .from('ingredients')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('structure_id', session.structureId);
  if (error) return { success: false, error: await te('errors.updateFailed') };
  revalidateStock();
  return { success: true, error: '' };
}

/** Supprime un ingrédient jamais utilisé dans une recette (sinon : le désactiver). */
export async function deleteIngredient(id: string): Promise<Result> {
  const session = await requireStockManager();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { error } = await getAdminSupabase().from('ingredients').delete().eq('id', id).eq('structure_id', session.structureId);
  if (error) return { success: false, error: await dbError(error, 'errors.deleteFailed') };
  revalidateStock();
  return { success: true, error: '' };
}
