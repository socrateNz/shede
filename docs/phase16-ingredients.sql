-- ============================================================
-- SHEDE ERP — Phase 16 : Ingrédients, fiches recettes, coût matière
-- (module STOCK ; base des modules ACHATS et PREVISIONS)
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Ingrédients : ce qu'on achète et stocke (distinct des produits du menu)
--    unit = unité de stock et de coût : kg, l (litre) ou piece.
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('kg', 'l', 'piece')),
  -- Coût d'une unité de stock (XAF) ; mis à jour à la main, puis par les réceptions (module ACHATS)
  cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_name ON ingredients (structure_id, lower(name));
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- 2. Fiches recettes : un produit OU un accompagnement consomme des ingrédients.
--    quantity est exprimée dans unit (g / kg, ml / l, piece), convertie vers l'unité
--    de l'ingrédient. waste_percent : perte à la préparation (épluchage, cuisson…) ;
--    quantité brute consommée = quantité / (1 - perte).
CREATE TABLE IF NOT EXISTS recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  accompaniment_id UUID REFERENCES accompaniments(id) ON DELETE CASCADE,
  -- RESTRICT : un ingrédient utilisé dans une recette ne peut pas être supprimé (on le désactive)
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('kg', 'g', 'l', 'ml', 'piece')),
  waste_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (waste_percent >= 0 AND waste_percent < 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Exactement un élément vendu : un produit ou un accompagnement
  CONSTRAINT recipe_items_one_owner CHECK ((product_id IS NULL) <> (accompaniment_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_items_product ON recipe_items (product_id, ingredient_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_items_accompaniment ON recipe_items (accompaniment_id, ingredient_id) WHERE accompaniment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON recipe_items (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_structure ON recipe_items (structure_id);
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;

-- Unité de la ligne compatible avec celle de l'ingrédient (kg ↔ g, l ↔ ml, piece ↔ piece),
-- et ingrédient du même point que la recette.
CREATE OR REPLACE FUNCTION check_recipe_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ing RECORD;
BEGIN
  SELECT structure_id, unit INTO ing FROM ingredients WHERE id = NEW.ingredient_id;
  IF NOT FOUND OR ing.structure_id <> NEW.structure_id THEN
    RAISE EXCEPTION 'recipe_ingredient_invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (
    (ing.unit = 'kg' AND NEW.unit IN ('kg', 'g')) OR
    (ing.unit = 'l' AND NEW.unit IN ('l', 'ml')) OR
    (ing.unit = 'piece' AND NEW.unit = 'piece')
  ) THEN
    RAISE EXCEPTION 'recipe_unit_mismatch' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recipe_item_check ON recipe_items;
CREATE TRIGGER trg_recipe_item_check
  BEFORE INSERT OR UPDATE ON recipe_items
  FOR EACH ROW EXECUTE FUNCTION check_recipe_item();

-- Changer l'unité d'un ingrédient déjà utilisé rendrait ses recettes fausses : refusé.
CREATE OR REPLACE FUNCTION check_ingredient_unit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.unit <> OLD.unit AND EXISTS (SELECT 1 FROM recipe_items WHERE ingredient_id = NEW.id) THEN
    RAISE EXCEPTION 'ingredient_unit_in_use' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ingredient_unit_change ON ingredients;
CREATE TRIGGER trg_ingredient_unit_change
  BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION check_ingredient_unit_change();

-- 3. Stock et mouvements des ingrédients (mêmes tables que produits et accompagnements)
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stocks_ingredient ON stocks (structure_id, ingredient_id);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;
-- Coût unitaire au moment du mouvement (valorisation des sorties, pertes, écarts)
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements (ingredient_id) WHERE ingredient_id IS NOT NULL;

-- L'ancienne table product_recipes (ingrédient = produit) reste lue tant qu'un
-- produit n'a pas de fiche recette ; elle n'est plus alimentée.

-- ============================================================
-- FIN DE LA MIGRATION PHASE 16
-- ============================================================
