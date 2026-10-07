-- ============================================================
-- SHEDE ERP — Phase 17 : Inventaires, pertes et écarts de stock (module STOCK)
-- À exécuter dans le SQL Editor de votre projet Supabase, APRÈS phase16-ingredients.sql
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Pertes déclarées : motif et commentaire sur le mouvement de sortie
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS loss_reason VARCHAR(30);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS note TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_loss_reason_check') THEN
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_loss_reason_check
      CHECK (loss_reason IS NULL OR loss_reason IN ('expired', 'damaged', 'preparation_error', 'theft', 'staff_meal', 'other'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_stock_movements_reason_date ON stock_movements (structure_id, reason, created_at);

-- 2. Inventaires : comptage physique, puis validation (le stock prend les quantités comptées)
CREATE TABLE IF NOT EXISTS inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  status VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'CANCELLED')),
  note TEXT,
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  -- Totaux figés à la validation (XAF) : écart valorisé = Σ (compté − attendu) × coût
  variance_value NUMERIC(14, 2),
  counted_lines INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Un seul inventaire en cours par point
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventories_one_draft ON inventories (structure_id) WHERE status = 'DRAFT';
CREATE INDEX IF NOT EXISTS idx_inventories_structure ON inventories (structure_id, created_at DESC);
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;

-- Lignes : un article (ingrédient, produit ou accompagnement) et sa quantité comptée.
-- expected_quantity et unit_cost sont figés à la validation.
CREATE TABLE IF NOT EXISTS inventory_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
  item_type VARCHAR(15) NOT NULL CHECK (item_type IN ('ingredient', 'product', 'accompaniment')),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  accompaniment_id UUID REFERENCES accompaniments(id) ON DELETE CASCADE,
  counted_quantity NUMERIC(12, 3) CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
  expected_quantity NUMERIC(12, 3),
  unit_cost NUMERIC(12, 2),
  counted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  counted_at TIMESTAMPTZ,
  CONSTRAINT inventory_lines_one_item CHECK (
    (item_type = 'ingredient' AND ingredient_id IS NOT NULL AND product_id IS NULL AND accompaniment_id IS NULL) OR
    (item_type = 'product' AND product_id IS NOT NULL AND ingredient_id IS NULL AND accompaniment_id IS NULL) OR
    (item_type = 'accompaniment' AND accompaniment_id IS NOT NULL AND ingredient_id IS NULL AND product_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_lines_ingredient ON inventory_lines (inventory_id, ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_lines_product ON inventory_lines (inventory_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_lines_accompaniment ON inventory_lines (inventory_id, accompaniment_id) WHERE accompaniment_id IS NOT NULL;
ALTER TABLE inventory_lines ENABLE ROW LEVEL SECURITY;

-- Un inventaire validé ou annulé ne se modifie plus (ajout ou modification de lignes).
-- Les suppressions restent possibles pour la suppression en cascade d'un point.
CREATE OR REPLACE FUNCTION lock_closed_inventory_lines()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_status VARCHAR(12);
BEGIN
  SELECT status INTO current_status FROM inventories WHERE id = NEW.inventory_id;
  -- La validation elle-même fige attendu et coût : autorisée tant que le statut est DRAFT.
  IF current_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'inventory_closed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_closed_inventory_lines ON inventory_lines;
CREATE TRIGGER trg_lock_closed_inventory_lines
  BEFORE INSERT OR UPDATE ON inventory_lines
  FOR EACH ROW EXECUTE FUNCTION lock_closed_inventory_lines();

-- 3. Validation atomique d'un inventaire : pour chaque ligne comptée, le stock
--    attendu et le coût sont figés, le stock prend la quantité comptée (mouvement
--    ADJUSTMENT « inventory ») et l'écart valorisé est totalisé. Tout ou rien ;
--    deux validations simultanées ne peuvent pas corriger le stock deux fois.
CREATE OR REPLACE FUNCTION validate_inventory(p_inventory_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  line RECORD;
  item_column TEXT;
  item_id UUID;
  expected NUMERIC;
  cost NUMERIC;
  total NUMERIC := 0;
  lines_count INTEGER := 0;
BEGIN
  SELECT * INTO inv FROM inventories WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  IF inv.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'inventory_closed' USING ERRCODE = 'check_violation';
  END IF;

  FOR line IN
    SELECT * FROM inventory_lines WHERE inventory_id = p_inventory_id AND counted_quantity IS NOT NULL
  LOOP
    item_column := line.item_type || '_id';
    item_id := COALESCE(line.ingredient_id, line.product_id, line.accompaniment_id);

    -- Stock théorique au moment de la validation (verrouillé)
    EXECUTE format('SELECT quantity FROM stocks WHERE structure_id = $1 AND %I = $2 FOR UPDATE', item_column)
      INTO expected USING inv.structure_id, item_id;
    expected := COALESCE(expected, 0);

    -- Coût unitaire : connu pour les ingrédients (les produits seront valorisés par le module ACHATS)
    cost := NULL;
    IF line.item_type = 'ingredient' THEN
      SELECT cost_per_unit INTO cost FROM ingredients WHERE id = item_id;
    END IF;

    UPDATE inventory_lines SET expected_quantity = expected, unit_cost = cost WHERE id = line.id;

    INSERT INTO stock_movements (structure_id, product_id, accompaniment_id, ingredient_id, type, quantity, reason, reference_id, user_id, unit_cost)
    VALUES (inv.structure_id, line.product_id, line.accompaniment_id, line.ingredient_id,
            'ADJUSTMENT', line.counted_quantity, 'inventory', p_inventory_id::TEXT, p_user_id, cost);

    EXECUTE format('UPDATE stocks SET quantity = $1, updated_at = NOW() WHERE structure_id = $2 AND %I = $3', item_column)
      USING line.counted_quantity, inv.structure_id, item_id;
    IF NOT FOUND THEN
      INSERT INTO stocks (structure_id, product_id, accompaniment_id, ingredient_id, quantity, threshold, updated_at)
      VALUES (inv.structure_id, line.product_id, line.accompaniment_id, line.ingredient_id, line.counted_quantity,
              CASE WHEN line.item_type = 'ingredient' THEN 0 ELSE 5 END, NOW());
    END IF;

    total := total + (line.counted_quantity - expected) * COALESCE(cost, 0);
    lines_count := lines_count + 1;
  END LOOP;

  UPDATE inventories
  SET status = 'VALIDATED', validated_by = p_user_id, validated_at = NOW(),
      variance_value = ROUND(total, 2), counted_lines = lines_count
  WHERE id = p_inventory_id;

  RETURN jsonb_build_object('counted_lines', lines_count, 'variance_value', ROUND(total, 2));
END;
$$;

REVOKE ALL ON FUNCTION validate_inventory(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_inventory(UUID, UUID) TO service_role;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 17
-- ============================================================
