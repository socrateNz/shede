import { describe, expect, it, vi } from 'vitest';

// Le module importe le client Supabase et les traductions serveur : inutiles pour ces calculs purs.
vi.mock('@/lib/supabase', () => ({ getAdminSupabase: () => ({}) }));
vi.mock('@/lib/i18n/server', () => ({ te: async (key: string) => key }));
vi.mock('@/lib/stock', () => ({ loadRecipeLines: async () => ({ byProduct: new Map(), byAccompaniment: new Map() }) }));

import { addNeeds, perUnit, unitsFor } from '@/lib/stock-availability';
import type { RecipeRow } from '@/lib/stock';

const line = (ingredient: string, quantity: number, unit: RecipeRow['unit'], waste = 0): RecipeRow => ({
  product_id: 'poulet',
  accompaniment_id: null,
  ingredient_id: ingredient,
  quantity,
  unit,
  waste_percent: waste,
  cost_per_unit: 0,
});

const recipes = {
  // Poulet DG : 250 g de poulet + 1 plantain
  byProduct: new Map([['poulet', [line('ing-poulet', 250, 'g'), line('ing-plantain', 1, 'piece')]]]),
  byAccompaniment: new Map<string, RecipeRow[]>(),
};

describe('disponibilité en stock', () => {
  it('un plat sans recette consomme une unité de lui-même', () => {
    expect([...perUnit('product', 'coca', recipes)]).toEqual([['product:coca', 1]]);
  });

  it('un plat avec recette consomme ses ingrédients (g → kg)', () => {
    const unit = perUnit('product', 'poulet', recipes);
    expect(unit.get('ingredient:ing-poulet')).toBeCloseTo(0.25);
    expect(unit.get('ingredient:ing-plantain')).toBe(1);
  });

  it("l'ingrédient le plus limitant fixe le nombre de plats", () => {
    const unit = perUnit('product', 'poulet', recipes);
    // 2 kg de poulet (8 plats) mais 3 plantains → 3 plats
    const remaining = new Map([
      ['ingredient:ing-poulet', 2],
      ['ingredient:ing-plantain', 3],
    ]);
    expect(unitsFor(unit, remaining)).toBe(3);
  });

  it('rupture quand une ressource est épuisée ou négative', () => {
    const unit = perUnit('product', 'coca', recipes);
    expect(unitsFor(unit, new Map([['product:coca', 0]]))).toBe(0);
    expect(unitsFor(unit, new Map([['product:coca', -2]]))).toBe(0);
  });

  it("un article sans ligne de stock n'est pas suivi (null = illimité)", () => {
    expect(unitsFor(perUnit('product', 'coca', recipes), new Map())).toBeNull();
    // Recette dont un seul ingrédient est suivi : seul celui-ci compte
    expect(unitsFor(perUnit('product', 'poulet', recipes), new Map([['ingredient:ing-plantain', 4]]))).toBe(4);
  });

  it('les commandes en cours sont déduites avant de calculer ce qui reste', () => {
    const reserved = new Map<string, number>();
    addNeeds(reserved, perUnit('product', 'poulet', recipes), 2); // 2 Poulet DG pas encore payés
    const stock = new Map([
      ['ingredient:ing-poulet', 1],
      ['ingredient:ing-plantain', 10],
    ]);
    const remaining = new Map([...stock].map(([k, q]) => [k, q - (reserved.get(k) ?? 0)]));
    // 1 kg − 0,5 kg = 0,5 kg → 2 plats ; les arrondis flottants ne font pas perdre un plat
    expect(unitsFor(perUnit('product', 'poulet', recipes), remaining)).toBe(2);
  });
});
