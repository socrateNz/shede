-- ============================================================
-- SHEDE ERP — Phase 4 Migration : Gestion des salles (floors)
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- -------------------------------------------------------
-- 1. Table Floors (Salles / Zones)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_floors_updated_at'
  ) THEN
    CREATE TRIGGER update_floors_updated_at
    BEFORE UPDATE ON floors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- Unicité insensible à la casse par structure (évite les doublons "Terrasse" / "terrasse")
CREATE UNIQUE INDEX IF NOT EXISTS idx_floors_structure_name
  ON floors(structure_id, lower(name));

-- -------------------------------------------------------
-- 2. tables.floor_id (lien vers floors ; floor_name conservé
--    comme colonne dénormalisée pour les lecteurs existants)
-- -------------------------------------------------------
ALTER TABLE tables ADD COLUMN IF NOT EXISTS floor_id UUID REFERENCES floors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tables_floor_id ON tables(floor_id);

-- -------------------------------------------------------
-- 3. Backfill : une ligne floors par (structure_id, floor_name)
--    distincts déjà présents dans tables
-- -------------------------------------------------------
INSERT INTO floors (structure_id, name)
SELECT DISTINCT t.structure_id, COALESCE(NULLIF(TRIM(t.floor_name), ''), 'Salle principale')
FROM tables t
WHERE t.structure_id IS NOT NULL
ON CONFLICT (structure_id, (lower(name))) DO NOTHING;

-- Rattache chaque table existante à sa salle (ne touche que les lignes
-- pas encore liées → sûr à ré-exécuter)
UPDATE tables t
SET floor_id = f.id
FROM floors f
WHERE f.structure_id = t.structure_id
  AND lower(f.name) = lower(COALESCE(NULLIF(TRIM(t.floor_name), ''), 'Salle principale'))
  AND t.floor_id IS NULL;

-- -------------------------------------------------------
-- 4. Sécurité RLS — deny-by-default (convention scripts/05-enable-rls.sql :
--    anon/authenticated n'ont aucune policy, accès exclusivement via
--    service_role dans les server actions Next.js, qui contourne RLS)
-- -------------------------------------------------------
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 4
-- ============================================================
