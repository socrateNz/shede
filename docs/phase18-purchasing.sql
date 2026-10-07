-- ============================================================
-- SHEDE ERP — Phase 18 : Achats (module ACHATS)
-- Catalogue fournisseurs, bons de commande, réceptions, coût moyen pondéré.
-- À exécuter dans le SQL Editor de votre projet Supabase,
-- APRÈS phase12-accounting.sql (table suppliers), phase16-ingredients.sql et phase17-inventory.sql.
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Fournisseurs : conditions de livraison (table créée par la comptabilité)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_name TEXT;
-- Jours de livraison, norme ISO : 1 = lundi … 7 = dimanche
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivery_days SMALLINT[] NOT NULL DEFAULT '{}';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time_days SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
-- false : fournisseur non assujetti (marché, petit producteur) — pas de TVA récupérable
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS charges_vat BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Coût d'achat moyen des produits revendus tels quels (boissons…), comme ingredients.cost_per_unit
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(12, 2);

-- 3. Catalogue fournisseur : ce qu'un fournisseur vend, conditionnement et prix HT.
--    pack_size = quantité en unité de stock par conditionnement
--    (ex. « Sac de 25 kg » → 25 pour un ingrédient en kg ; « Casier de 12 » → 12 bouteilles).
CREATE TABLE IF NOT EXISTS supplier_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  reference VARCHAR(60),
  pack_label VARCHAR(60) NOT NULL,
  pack_size NUMERIC(12, 3) NOT NULL CHECK (pack_size > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_items_one_item CHECK ((ingredient_id IS NULL) <> (product_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_items_ingredient ON supplier_items (supplier_id, ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_items_product ON supplier_items (supplier_id, product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_items_structure ON supplier_items (structure_id);
ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;

-- 4. Numérotation des documents d'achat par point et par année : BC-2026-0001, BR-2026-0001
CREATE TABLE IF NOT EXISTS purchase_counters (
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  kind VARCHAR(4) NOT NULL,
  year INTEGER NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (structure_id, kind, year)
);
ALTER TABLE purchase_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION next_purchase_number(p_structure_id UUID, p_kind TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INTEGER := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Africa/Douala'))::INTEGER;
  n INTEGER;
BEGIN
  INSERT INTO purchase_counters (structure_id, kind, year, last_value)
  VALUES (p_structure_id, p_kind, y, 1)
  ON CONFLICT (structure_id, kind, year) DO UPDATE SET last_value = purchase_counters.last_value + 1
  RETURNING last_value INTO n;
  RETURN p_kind || '-' || y || '-' || LPAD(n::TEXT, 4, '0');
END;
$$;
REVOKE ALL ON FUNCTION next_purchase_number(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION next_purchase_number(UUID, TEXT) TO service_role;

-- 5. Bons de commande
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  number VARCHAR(30) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED')),
  expected_date DATE,
  note TEXT,
  total_ht NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (structure_id, number)
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_structure ON purchase_orders (structure_id, created_at DESC);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Lignes : quantités en conditionnements ; libellé, conditionnement et prix figés à la commande
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_item_id UUID REFERENCES supplier_items(id) ON DELETE SET NULL,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  label VARCHAR(150) NOT NULL,
  pack_label VARCHAR(60) NOT NULL,
  pack_size NUMERIC(12, 3) NOT NULL CHECK (pack_size > 0),
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  received_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_order ON purchase_order_lines (purchase_order_id);
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

-- 6. Réceptions (bons de réception), avec ou sans bon de commande
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  number VARCHAR(30) NOT NULL,
  -- Numéro de la facture ou du bon de livraison du fournisseur
  invoice_reference VARCHAR(60),
  note TEXT,
  total_ht NUMERIC(14, 2) NOT NULL DEFAULT 0,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Dépenses comptables créées (module COMPTABILITE) : matières premières / marchandises
  expense_ids UUID[] NOT NULL DEFAULT '{}',
  UNIQUE (structure_id, number)
);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_structure ON goods_receipts (structure_id, received_at DESC);
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  label VARCHAR(150) NOT NULL,
  pack_label VARCHAR(60) NOT NULL,
  pack_size NUMERIC(12, 3) NOT NULL CHECK (pack_size > 0),
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_receipt ON goods_receipt_lines (receipt_id);
ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY;

-- 7. Réception atomique : bon de réception, entrées en stock, coût moyen pondéré,
--    quantités reçues du bon de commande et son statut. Tout ou rien.
--    p_lines : [{ ingredient_id | product_id, order_line_id?, label, pack_label, pack_size, quantity, unit_price }]
CREATE OR REPLACE FUNCTION receive_goods(
  p_structure_id UUID,
  p_supplier_id UUID,
  p_order_id UUID,
  p_user_id UUID,
  p_invoice_reference TEXT,
  p_note TEXT,
  p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po RECORD;
  line JSONB;
  receipt_id UUID;
  receipt_number TEXT;
  ingredient UUID;
  product UUID;
  order_line UUID;
  packs NUMERIC;
  pack NUMERIC;
  price NUMERIC;
  stock_qty NUMERIC;
  unit_cost NUMERIC;
  old_qty NUMERIC;
  old_cost NUMERIC;
  new_cost NUMERIC;
  total NUMERIC := 0;
BEGIN
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'receipt_empty' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND structure_id = p_structure_id) THEN
    RAISE EXCEPTION 'supplier_invalid' USING ERRCODE = 'check_violation';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT * INTO po FROM purchase_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND OR po.structure_id <> p_structure_id OR po.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION 'order_invalid' USING ERRCODE = 'check_violation';
    END IF;
    IF po.status IN ('RECEIVED', 'CANCELLED') THEN
      RAISE EXCEPTION 'order_closed' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  receipt_number := next_purchase_number(p_structure_id, 'BR');
  INSERT INTO goods_receipts (structure_id, supplier_id, purchase_order_id, number, invoice_reference, note, received_by)
  VALUES (p_structure_id, p_supplier_id, p_order_id, receipt_number, NULLIF(TRIM(p_invoice_reference), ''), NULLIF(TRIM(p_note), ''), p_user_id)
  RETURNING id INTO receipt_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    ingredient := NULLIF(line->>'ingredient_id', '')::UUID;
    product := NULLIF(line->>'product_id', '')::UUID;
    order_line := NULLIF(line->>'order_line_id', '')::UUID;
    packs := (line->>'quantity')::NUMERIC;
    pack := (line->>'pack_size')::NUMERIC;
    price := (line->>'unit_price')::NUMERIC;

    IF (ingredient IS NULL) = (product IS NULL) OR packs IS NULL OR packs <= 0 OR pack IS NULL OR pack <= 0 OR price IS NULL OR price < 0 THEN
      RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation';
    END IF;

    stock_qty := packs * pack;
    unit_cost := price / pack;

    IF ingredient IS NOT NULL THEN
      SELECT cost_per_unit INTO old_cost FROM ingredients WHERE id = ingredient AND structure_id = p_structure_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation'; END IF;
      SELECT quantity INTO old_qty FROM stocks WHERE structure_id = p_structure_id AND ingredient_id = ingredient FOR UPDATE;
    ELSE
      SELECT purchase_cost INTO old_cost FROM products WHERE id = product AND structure_id = p_structure_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation'; END IF;
      SELECT quantity INTO old_qty FROM stocks WHERE structure_id = p_structure_id AND product_id = product FOR UPDATE;
    END IF;

    -- Coût moyen pondéré : le stock négatif ou nul ne pèse pas ; sans coût connu, le prix reçu.
    old_qty := GREATEST(COALESCE(old_qty, 0), 0);
    IF old_cost IS NULL OR old_qty = 0 THEN
      new_cost := unit_cost;
    ELSE
      new_cost := (old_qty * old_cost + stock_qty * unit_cost) / (old_qty + stock_qty);
    END IF;

    IF ingredient IS NOT NULL THEN
      UPDATE ingredients SET cost_per_unit = ROUND(new_cost, 2) WHERE id = ingredient;
      UPDATE stocks SET quantity = quantity + stock_qty, updated_at = NOW() WHERE structure_id = p_structure_id AND ingredient_id = ingredient;
      IF NOT FOUND THEN
        INSERT INTO stocks (structure_id, ingredient_id, quantity, threshold, updated_at) VALUES (p_structure_id, ingredient, stock_qty, 0, NOW());
      END IF;
    ELSE
      UPDATE products SET purchase_cost = ROUND(new_cost, 2) WHERE id = product;
      UPDATE stocks SET quantity = quantity + stock_qty, updated_at = NOW() WHERE structure_id = p_structure_id AND product_id = product;
      IF NOT FOUND THEN
        INSERT INTO stocks (structure_id, product_id, quantity, threshold, updated_at) VALUES (p_structure_id, product, stock_qty, 5, NOW());
      END IF;
    END IF;

    INSERT INTO stock_movements (structure_id, product_id, ingredient_id, type, quantity, reason, reference_id, user_id, unit_cost)
    VALUES (p_structure_id, product, ingredient, 'IN', stock_qty, 'purchase', receipt_id::TEXT, p_user_id, ROUND(unit_cost, 2));

    IF order_line IS NOT NULL THEN
      UPDATE purchase_order_lines SET received_quantity = received_quantity + packs
      WHERE id = order_line AND purchase_order_id = p_order_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation'; END IF;
    END IF;

    INSERT INTO goods_receipt_lines (receipt_id, purchase_order_line_id, ingredient_id, product_id, label, pack_label, pack_size, quantity, unit_price)
    VALUES (receipt_id, order_line, ingredient, product, LEFT(COALESCE(line->>'label', '—'), 150), LEFT(COALESCE(line->>'pack_label', '—'), 60), pack, packs, price);

    total := total + packs * price;
  END LOOP;

  UPDATE goods_receipts SET total_ht = ROUND(total, 2) WHERE id = receipt_id;

  IF p_order_id IS NOT NULL THEN
    UPDATE purchase_orders
    SET status = CASE
          WHEN NOT EXISTS (SELECT 1 FROM purchase_order_lines WHERE purchase_order_id = p_order_id AND received_quantity < quantity)
          THEN 'RECEIVED' ELSE 'PARTIAL' END,
        updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object('receipt_id', receipt_id, 'number', receipt_number, 'total_ht', ROUND(total, 2));
END;
$$;
REVOKE ALL ON FUNCTION receive_goods(UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION receive_goods(UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB) TO service_role;

-- 8. Inventaires (phase 17) : les produits revendus sont maintenant valorisés à leur
--    coût d'achat moyen (products.purchase_cost), comme les ingrédients.
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

    EXECUTE format('SELECT quantity FROM stocks WHERE structure_id = $1 AND %I = $2 FOR UPDATE', item_column)
      INTO expected USING inv.structure_id, item_id;
    expected := COALESCE(expected, 0);

    cost := NULL;
    IF line.item_type = 'ingredient' THEN
      SELECT cost_per_unit INTO cost FROM ingredients WHERE id = item_id;
    ELSIF line.item_type = 'product' THEN
      SELECT purchase_cost INTO cost FROM products WHERE id = item_id;
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
-- FIN DE LA MIGRATION PHASE 18
-- ============================================================
