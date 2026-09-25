-- ============================================================
-- SHEDE ERP — Phase 9 : Fiscalité (TVA, NIU/RCCM, numérotation)
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Identité fiscale et régime de TVA de chaque point
--    - niu  : Numéro d'Identifiant Unique (DGI)
--    - rccm : Registre du Commerce et du Crédit Mobilier
--    - prices_include_tax : TRUE = prix saisis TTC (la TVA est extraite
--      du total), FALSE = prix HT (la TVA s'ajoute au total)
--    - tax_rate : existe déjà (en %), 19,25 % = taux normal au Cameroun
ALTER TABLE structures ADD COLUMN IF NOT EXISTS niu VARCHAR(50);
ALTER TABLE structures ADD COLUMN IF NOT EXISTS rccm VARCHAR(100);
ALTER TABLE structures ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN DEFAULT TRUE;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS invoice_counter INTEGER NOT NULL DEFAULT 0;
UPDATE structures SET prices_include_tax = TRUE WHERE prices_include_tax IS NULL;

-- 2. Photographie fiscale de chaque vente (un changement de taux ne
--    modifie pas les documents déjà émis)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN DEFAULT TRUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN DEFAULT TRUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_structure_invoice
  ON orders(structure_id, invoice_number) WHERE invoice_number IS NOT NULL;

-- 3. Numérotation continue des factures, par point, commune aux commandes
--    et aux réservations. Atomique (verrou de ligne sur le point) et
--    idempotente : un document déjà numéroté garde son numéro.
--    Format : AAAA-000001 (le compteur ne repart pas à zéro chaque année).
CREATE OR REPLACE FUNCTION public.assign_invoice_number(p_kind TEXT, p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_structure_id UUID;
  v_existing TEXT;
  v_counter INTEGER;
  v_number TEXT;
BEGIN
  IF p_kind = 'ORDER' THEN
    SELECT structure_id, invoice_number INTO v_structure_id, v_existing
    FROM orders WHERE id = p_id FOR UPDATE;
  ELSIF p_kind = 'BOOKING' THEN
    SELECT r.structure_id, b.invoice_number INTO v_structure_id, v_existing
    FROM bookings b JOIN rooms r ON r.id = b.room_id
    WHERE b.id = p_id FOR UPDATE OF b;
  ELSE
    RAISE EXCEPTION 'assign_invoice_number: type inconnu %', p_kind;
  END IF;

  IF v_structure_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  UPDATE structures
  SET invoice_counter = invoice_counter + 1
  WHERE id = v_structure_id
  RETURNING invoice_counter INTO v_counter;

  v_number := to_char(NOW(), 'YYYY') || '-' || lpad(v_counter::TEXT, 6, '0');

  IF p_kind = 'ORDER' THEN
    UPDATE orders SET invoice_number = v_number WHERE id = p_id;
  ELSE
    UPDATE bookings SET invoice_number = v_number WHERE id = p_id;
  END IF;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_invoice_number(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invoice_number(TEXT, UUID) TO service_role;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 9
-- ============================================================
