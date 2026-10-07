import { computeTax, type TaxSettings } from '@/lib/tax';

// Fiches recettes et coût matière (docs/phase16-ingredients.sql). Fonctions pures,
// utilisables côté serveur comme dans le navigateur.

export const INGREDIENT_UNITS = ['kg', 'l', 'piece'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export const RECIPE_UNITS = ['kg', 'g', 'l', 'ml', 'piece'] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

/** Unités utilisables dans une recette pour un ingrédient stocké dans `unit`. */
export const COMPATIBLE_UNITS: Record<IngredientUnit, RecipeUnit[]> = {
  kg: ['g', 'kg'],
  l: ['ml', 'l'],
  piece: ['piece'],
};

/** Coût matière au-delà duquel un plat est signalé (part du prix HT). */
export const FOOD_COST_TARGET_PERCENT = 35;

export type RecipeLine = {
  ingredient_id: string;
  quantity: number;
  unit: RecipeUnit;
  waste_percent: number;
};

export type IngredientCost = { id: string; unit: IngredientUnit; cost_per_unit: number };

/** Quantité nette dans l'unité de l'ingrédient (g → kg, ml → l). */
export function toIngredientUnit(quantity: number, unit: RecipeUnit) {
  return unit === 'g' || unit === 'ml' ? quantity / 1000 : quantity;
}

/** Quantité réellement sortie du stock, perte de préparation comprise. */
export function grossQuantity(line: Pick<RecipeLine, 'quantity' | 'unit' | 'waste_percent'>) {
  const waste = Math.min(Math.max(Number(line.waste_percent) || 0, 0), 89.99);
  return toIngredientUnit(Number(line.quantity) || 0, line.unit) / (1 - waste / 100);
}

/** Coût d'une ligne de recette (XAF, non arrondi). */
export function lineCost(line: RecipeLine, ingredient: IngredientCost | undefined) {
  if (!ingredient) return 0;
  return grossQuantity(line) * (Number(ingredient.cost_per_unit) || 0);
}

/** Coût matière d'une recette (XAF, arrondi). */
export function recipeCost(lines: RecipeLine[], ingredients: Map<string, IngredientCost>) {
  return Math.round(lines.reduce((sum, line) => sum + lineCost(line, ingredients.get(line.ingredient_id)), 0));
}

/** Prix de vente hors taxe, selon le régime de TVA du point. */
export function priceExcludingTax(price: number, settings: TaxSettings) {
  return computeTax(Number(price) || 0, settings).net;
}

/**
 * Coût matière d'un plat : coût de la recette, marge brute et part du prix HT.
 * percent = null quand le prix HT est nul.
 */
export function foodCost(cost: number, price: number, settings: TaxSettings) {
  const net = priceExcludingTax(price, settings);
  return {
    cost,
    priceExcludingTax: net,
    margin: net - cost,
    percent: net > 0 ? Math.round((cost / net) * 1000) / 10 : null,
  };
}

export function isCompatibleUnit(ingredientUnit: IngredientUnit, unit: RecipeUnit) {
  return COMPATIBLE_UNITS[ingredientUnit]?.includes(unit) ?? false;
}
