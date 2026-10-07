-- ============================================================
-- SHEDE ERP — Phase 15 : Catégories et sous-catégories de produits,
-- produits livrables
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord
-- (y compris si une version précédente de ce fichier a déjà été exécutée).
-- ============================================================

-- 1. Catégories d'un point (créées à part, choisies sur chaque produit)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  -- Ordre d'affichage parmi les catégories de même niveau (menu client, caisse, API)
  position INTEGER NOT NULL DEFAULT 0,
  -- Désactivée : masquée des filtres et du menu, sans être supprimée
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sous-catégorie : un seul niveau. Une catégorie parente doit être de premier
-- niveau, et une sous-catégorie ne peut pas avoir elle-même de sous-catégories.
-- Une catégorie qui a des sous-catégories ne peut pas être supprimée (RESTRICT).
ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES product_categories(id) ON DELETE RESTRICT;

-- Pas deux catégories du même nom (sans tenir compte des majuscules) au même
-- niveau : « Poulet » peut exister sous « Grillades » et sous « Braisés ».
DROP INDEX IF EXISTS uq_product_categories_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_name_level
  ON product_categories (structure_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::UUID), lower(name));
CREATE INDEX IF NOT EXISTS idx_product_categories_structure
  ON product_categories (structure_id, position);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent
  ON product_categories (parent_id) WHERE parent_id IS NOT NULL;

-- Règle des deux niveaux, vérifiée par la base à chaque création ou déplacement.
CREATE OR REPLACE FUNCTION check_product_category_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent RECORD;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'category_parent_invalid' USING ERRCODE = 'check_violation';
  END IF;

  -- Verrou sur le parent : deux déplacements simultanés ne peuvent pas créer un 3e niveau.
  SELECT structure_id, parent_id INTO parent
  FROM product_categories
  WHERE id = NEW.parent_id
  FOR UPDATE;

  IF NOT FOUND OR parent.structure_id <> NEW.structure_id OR parent.parent_id IS NOT NULL THEN
    -- Parent introuvable, d'un autre point, ou lui-même sous-catégorie
    RAISE EXCEPTION 'category_parent_invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM product_categories WHERE parent_id = NEW.id) THEN
    -- Une catégorie qui a des sous-catégories ne peut pas devenir sous-catégorie
    RAISE EXCEPTION 'category_has_children' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_category_parent ON product_categories;
CREATE TRIGGER trg_product_category_parent
  BEFORE INSERT OR UPDATE OF parent_id, structure_id ON product_categories
  FOR EACH ROW EXECUTE FUNCTION check_product_category_parent();

-- 2. Un produit peut appartenir à plusieurs catégories (ou sous-catégories)
CREATE TABLE IF NOT EXISTS product_category_links (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_product_category_links_category ON product_category_links (category_id);

-- Lecture et écriture via le service role uniquement (server actions, API).
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_links ENABLE ROW LEVEL SECURITY;

-- 3. Produit livrable ou non (ex. glaces, plats à servir chauds sur place)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deliverable BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. Reprise de l'ancienne catégorie texte (products.category) :
--    une catégorie de premier niveau par nom distinct et par point, puis le lien produit → catégorie.
INSERT INTO product_categories (structure_id, name, position)
SELECT structure_id, name, (ROW_NUMBER() OVER (PARTITION BY structure_id ORDER BY lower(name)))::INTEGER
FROM (
  SELECT DISTINCT ON (structure_id, lower(TRIM(category))) structure_id, LEFT(TRIM(category), 80) AS name
  FROM products
  WHERE category IS NOT NULL AND TRIM(category) <> '' AND COALESCE(is_deleted, FALSE) = FALSE
    -- Reprise unique : seulement pour un point qui n'a encore aucune catégorie
    -- (ensuite products.category contient des noms recopiés, ex. « Plats, Desserts »).
    AND NOT EXISTS (SELECT 1 FROM product_categories pc WHERE pc.structure_id = products.structure_id)
  ORDER BY structure_id, lower(TRIM(category)), TRIM(category)
) AS distinct_categories
ON CONFLICT DO NOTHING;

INSERT INTO product_category_links (product_id, category_id)
SELECT p.id, c.id
FROM products p
JOIN product_categories c
  ON c.structure_id = p.structure_id
 AND c.parent_id IS NULL
 AND lower(c.name) = lower(LEFT(TRIM(p.category), 80))
WHERE p.category IS NOT NULL AND TRIM(p.category) <> ''
  -- Produits encore sans aucune catégorie choisie. (Shede vide products.category
  -- quand on retire toutes les catégories d'un produit : rien n'est recréé.)
  AND NOT EXISTS (SELECT 1 FROM product_category_links l WHERE l.product_id = p.id)
ON CONFLICT DO NOTHING;

-- products.category reste en place (texte) : Shede y recopie les noms des
-- catégories choisies, pour les anciens écrans et exports qui la lisent encore.

-- ============================================================
-- FIN DE LA MIGRATION PHASE 15
-- ============================================================
