import { describe, expect, it } from 'vitest';
import { CAMEROON_VAT_RATE, computeTax, toTaxSettings } from '@/lib/tax';
import { foodCost, grossQuantity, isCompatibleUnit, recipeCost, toIngredientUnit, type IngredientCost } from '@/lib/recipes';

const TTC = { rate: CAMEROON_VAT_RATE, pricesIncludeTax: true };
const HT = { rate: CAMEROON_VAT_RATE, pricesIncludeTax: false };

describe('TVA (computeTax)', () => {
  it('extrait la TVA d’un prix TTC sans changer le total', () => {
    expect(computeTax(11925, TTC)).toEqual({ net: 10000, tax: 1925, total: 11925 });
  });

  it('ajoute la TVA à un prix HT', () => {
    expect(computeTax(10000, HT)).toEqual({ net: 10000, tax: 1925, total: 11925 });
  });

  it('sans TVA, le montant est inchangé', () => {
    expect(computeTax(5000, { rate: 0, pricesIncludeTax: true })).toEqual({ net: 5000, tax: 0, total: 5000 });
  });

  it('arrondit au franc et refuse les montants négatifs', () => {
    expect(computeTax(1000.4, { rate: 0, pricesIncludeTax: true }).total).toBe(1000);
    expect(computeTax(-500, HT)).toEqual({ net: 0, tax: 0, total: 0 });
  });

  it('net + TVA = total, quel que soit le montant', () => {
    for (const amount of [1, 99, 1250, 3333, 75000, 1234567]) {
      for (const settings of [TTC, HT]) {
        const r = computeTax(amount, settings);
        expect(r.net + r.tax).toBe(r.total);
      }
    }
  });
});

describe('Réglages de TVA (toTaxSettings)', () => {
  it('prix TTC sans TVA par défaut', () => {
    expect(toTaxSettings(null)).toEqual({ rate: 0, pricesIncludeTax: true });
  });
  it('lit les colonnes du point', () => {
    expect(toTaxSettings({ tax_rate: '19.25', prices_include_tax: false })).toEqual({ rate: 19.25, pricesIncludeTax: false });
  });
  it('ignore un taux négatif', () => {
    expect(toTaxSettings({ tax_rate: -5 }).rate).toBe(0);
  });
});

describe('Fiches recettes et coût matière', () => {
  it('convertit g et ml dans l’unité de stock', () => {
    expect(toIngredientUnit(250, 'g')).toBe(0.25);
    expect(toIngredientUnit(330, 'ml')).toBeCloseTo(0.33);
    expect(toIngredientUnit(2, 'kg')).toBe(2);
  });

  it('ajoute la perte de préparation à la quantité sortie du stock', () => {
    // 200 g nets avec 20 % de perte : 250 g bruts
    expect(grossQuantity({ quantity: 200, unit: 'g', waste_percent: 20 })).toBeCloseTo(0.25);
  });

  it('plafonne la perte pour éviter une division par zéro', () => {
    expect(Number.isFinite(grossQuantity({ quantity: 1, unit: 'kg', waste_percent: 150 }))).toBe(true);
  });

  it('calcule le coût d’une recette et ignore un ingrédient inconnu', () => {
    const ingredients = new Map<string, IngredientCost>([
      ['riz', { id: 'riz', unit: 'kg', cost_per_unit: 2000 }],
      ['huile', { id: 'huile', unit: 'l', cost_per_unit: 1200 }],
    ]);
    const cost = recipeCost(
      [
        { ingredient_id: 'riz', quantity: 250, unit: 'g', waste_percent: 0 }, // 500
        { ingredient_id: 'huile', quantity: 0.5, unit: 'l', waste_percent: 0 }, // 600
        { ingredient_id: 'inconnu', quantity: 3, unit: 'kg', waste_percent: 0 }, // 0
      ],
      ingredients
    );
    expect(cost).toBe(1100);
  });

  it('rapporte le coût matière au prix HT (TVA extraite d’un prix TTC)', () => {
    expect(foodCost(3500, 11925, TTC)).toEqual({ cost: 3500, priceExcludingTax: 10000, margin: 6500, percent: 35 });
  });

  it('pas de pourcentage pour un plat gratuit', () => {
    expect(foodCost(500, 0, TTC).percent).toBeNull();
  });

  it('n’accepte que des unités compatibles avec le stock', () => {
    expect(isCompatibleUnit('kg', 'g')).toBe(true);
    expect(isCompatibleUnit('kg', 'ml')).toBe(false);
    expect(isCompatibleUnit('piece', 'piece')).toBe(true);
  });
});
