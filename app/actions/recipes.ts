'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { getStructureTaxSettings } from '@/lib/fiscal';
import {
  foodCost,
  isCompatibleUnit,
  recipeCost,
  RECIPE_UNITS,
  type IngredientCost,
  type IngredientUnit,
  type RecipeLine,
  type RecipeUnit,
} from '@/lib/recipes';

// Fiches recettes (docs/phase16-ingredients.sql), module STOCK : ce que consomme
// un produit ou un accompagnement, et le coût matière qui en découle.

export type RecipeOwner = { productId: string } | { accompanimentId: string };

export type RecipeIngredientOption = { id: string; name: string; unit: IngredientUnit; cost_per_unit: number; is_active: boolean };

const MANAGE_ROLES = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'];

async function requireRecipeAccess() {
  const session = await getSession();
  if (!session?.structureId || !MANAGE_ROLES.includes(session.role)) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.modules?.includes('STOCK')) return null;
  return session as typeof session & { structureId: string };
}

function ownerColumn(owner: RecipeOwner) {
  return 'productId' in owner
    ? { column: 'product_id' as const, id: owner.productId, table: 'products' as const }
    : { column: 'accompaniment_id' as const, id: owner.accompanimentId, table: 'accompaniments' as const };
}

/**
 * Fiche recette d'un produit ou d'un accompagnement, avec les ingrédients du point.
 * null : migration phase 16 non exécutée.
 */
export async function getRecipe(owner: RecipeOwner): Promise<{ lines: RecipeLine[]; ingredients: RecipeIngredientOption[] } | null> {
  const session = await requireRecipeAccess();
  if (!session) return { lines: [], ingredients: [] };
  const admin = getAdminSupabase();
  const { column, id } = ownerColumn(owner);
  const [{ data: lines, error }, { data: ingredients }] = await Promise.all([
    admin
      .from('recipe_items')
      .select('ingredient_id, quantity, unit, waste_percent')
      .eq('structure_id', session.structureId)
      .eq(column, id)
      .order('created_at', { ascending: true }),
    admin
      .from('ingredients')
      .select('id, name, unit, cost_per_unit, is_active')
      .eq('structure_id', session.structureId)
      .order('name', { ascending: true }),
  ]);
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? null : { lines: [], ingredients: [] };
  return {
    lines: (lines || []).map((l) => ({
      ingredient_id: l.ingredient_id,
      quantity: Number(l.quantity),
      unit: l.unit as RecipeUnit,
      waste_percent: Number(l.waste_percent) || 0,
    })),
    ingredients: (ingredients || []).map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit as IngredientUnit,
      cost_per_unit: Number(i.cost_per_unit) || 0,
      is_active: i.is_active !== false,
    })),
  };
}

/** Remplace la fiche recette. Une liste vide supprime la recette. */
export async function saveRecipe(owner: RecipeOwner, lines: RecipeLine[]): Promise<{ success: boolean; error: string }> {
  const session = await requireRecipeAccess();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { column, id, table } = ownerColumn(owner);

  // Le produit / l'accompagnement doit appartenir au point.
  const { data: item } = await admin.from(table).select('id').eq('id', id).eq('structure_id', session.structureId).maybeSingle();
  if (!item) return { success: false, error: await te('recipes.errors.notFound') };

  const clean = lines.map((l) => ({
    ingredient_id: String(l.ingredient_id),
    quantity: Number(l.quantity),
    unit: l.unit,
    waste_percent: Number(l.waste_percent) || 0,
  }));
  const ids = [...new Set(clean.map((l) => l.ingredient_id))];
  if (ids.length !== clean.length) return { success: false, error: await te('recipes.errors.duplicate') };
  for (const line of clean) {
    if (!line.ingredient_id || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      return { success: false, error: await te('recipes.errors.quantityInvalid') };
    }
    if (!RECIPE_UNITS.includes(line.unit) || line.waste_percent < 0 || line.waste_percent >= 90) {
      return { success: false, error: await te('recipes.errors.quantityInvalid') };
    }
  }

  if (ids.length) {
    const { data: ingredients } = await admin
      .from('ingredients')
      .select('id, unit')
      .eq('structure_id', session.structureId)
      .in('id', ids);
    const unitById = new Map((ingredients || []).map((i) => [i.id as string, i.unit as IngredientUnit]));
    for (const line of clean) {
      const unit = unitById.get(line.ingredient_id);
      if (!unit) return { success: false, error: await te('recipes.errors.ingredientInvalid') };
      if (!isCompatibleUnit(unit, line.unit)) return { success: false, error: await te('recipes.errors.unitMismatch') };
    }
  }

  const { error: deleteError } = await admin.from('recipe_items').delete().eq('structure_id', session.structureId).eq(column, id);
  if (deleteError) return { success: false, error: await te('errors.updateFailed') };
  if (clean.length) {
    const { error } = await admin
      .from('recipe_items')
      .insert(clean.map((l) => ({ ...l, structure_id: session.structureId, [column]: id })));
    if (error) return { success: false, error: await te('errors.updateFailed') };
  }

  revalidatePath('/stock/food-cost');
  revalidatePath('/stock/ingredients');
  if ('productId' in owner) revalidatePath(`/products/${owner.productId}`);
  return { success: true, error: '' };
}

export type FoodCostRow = {
  id: string;
  type: 'product' | 'accompaniment';
  name: string;
  price: number;
  priceExcludingTax: number;
  cost: number | null;
  margin: number | null;
  percent: number | null;
  ingredientCount: number;
};

/** Coût matière de chaque produit et accompagnement du point (null : sans fiche recette). */
export async function getFoodCostReport(): Promise<FoodCostRow[] | null> {
  const session = await requireRecipeAccess();
  if (!session) return [];
  const admin = getAdminSupabase();
  const [{ data: lines, error }, { data: ingredients }, { data: products }, { data: accompaniments }, taxSettings] = await Promise.all([
    admin.from('recipe_items').select('product_id, accompaniment_id, ingredient_id, quantity, unit, waste_percent').eq('structure_id', session.structureId),
    admin.from('ingredients').select('id, unit, cost_per_unit').eq('structure_id', session.structureId),
    admin.from('products').select('id, name, price').eq('structure_id', session.structureId).eq('is_deleted', false).order('name'),
    admin.from('accompaniments').select('id, name, price').eq('structure_id', session.structureId).eq('is_deleted', false).order('name'),
    getStructureTaxSettings(session.structureId),
  ]);
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? null : [];

  const costs = new Map<string, IngredientCost>(
    (ingredients || []).map((i) => [i.id, { id: i.id, unit: i.unit as IngredientUnit, cost_per_unit: Number(i.cost_per_unit) || 0 }])
  );
  const byOwner = new Map<string, RecipeLine[]>();
  for (const l of lines || []) {
    const key = (l.product_id ?? l.accompaniment_id) as string;
    byOwner.set(key, [
      ...(byOwner.get(key) ?? []),
      { ingredient_id: l.ingredient_id, quantity: Number(l.quantity), unit: l.unit as RecipeUnit, waste_percent: Number(l.waste_percent) || 0 },
    ]);
  }

  const row = (item: { id: string; name: string; price: number }, type: FoodCostRow['type']): FoodCostRow => {
    const recipe = byOwner.get(item.id) ?? [];
    const price = Number(item.price) || 0;
    if (!recipe.length) {
      const net = foodCost(0, price, taxSettings).priceExcludingTax;
      return { id: item.id, type, name: item.name, price, priceExcludingTax: net, cost: null, margin: null, percent: null, ingredientCount: 0 };
    }
    const result = foodCost(recipeCost(recipe, costs), price, taxSettings);
    return { id: item.id, type, name: item.name, price, ...result, ingredientCount: recipe.length };
  };

  return [
    ...(products || []).map((p) => row(p, 'product')),
    ...(accompaniments || []).map((a) => row(a, 'accompaniment')),
  ];
}
