-- ============================================================
-- SHEDE ERP — Phase 1 Migration
-- À exécuter dans le SQL Editor de votre projet Supabase
-- ============================================================

-- -------------------------------------------------------
-- 1. Étendre la table structures (devise, timezone, etc.)
-- -------------------------------------------------------
ALTER TABLE structures
  ADD COLUMN IF NOT EXISTS currency    TEXT          DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS timezone    TEXT          DEFAULT 'Africa/Abidjan',
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS address     TEXT,
  ADD COLUMN IF NOT EXISTS country     TEXT          DEFAULT 'Côte d''Ivoire',
  ADD COLUMN IF NOT EXISTS logo_url    TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate    NUMERIC(5,2)  DEFAULT 0;

-- -------------------------------------------------------
-- 2. Trigger updated_at sur structures (si inexistant)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_structures'
  ) THEN
    CREATE TRIGGER set_updated_at_structures
    BEFORE UPDATE ON structures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- -------------------------------------------------------
-- 3. Supabase Realtime — Kitchen Display System (KDS)
--    Permet à la cuisine de recevoir les mises à jour
--    en temps réel via le client anon (clé publique).
--
--    SÉCURITÉ : La politique SELECT anon est nécessaire
--    pour que Supabase Realtime puisse diffuser les
--    changements. Les données sensibles restent
--    protégées côté serveur (service role).
-- -------------------------------------------------------

-- Activer la réplication complète sur la table orders
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Activer RLS sur orders (si pas déjà fait)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Politique permettant la lecture anon (pour Realtime)
-- Note: Upgrader vers Supabase Auth en production pour
--       une isolation stricte par structure.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
    AND policyname = 'anon_select_orders_realtime'
  ) THEN
    CREATE POLICY anon_select_orders_realtime ON orders
      FOR SELECT USING (true);
  END IF;
END;
$$;

-- -------------------------------------------------------
-- 4. Activer Realtime pour la table orders dans Supabase
--    (à faire aussi dans le Dashboard Supabase)
--    Database → Replication → orders → Enable
-- -------------------------------------------------------

-- -------------------------------------------------------
-- 5. Index de performance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_structure_status
  ON orders (structure_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_structure_paid_at
  ON orders (structure_id, paid_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_stocks_structure_id
  ON stocks (structure_id);

-- -------------------------------------------------------
-- DONE ✓
-- Redémarrez votre application après cette migration.
-- -------------------------------------------------------
