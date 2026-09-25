-- ============================================================
-- SHEDE ERP — Phase 7 : Organisations multi-points
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- Modèle :
--   organizations (licence + modules)  1 ── n  structures (= "points")
--   - La licence et les modules appartiennent à l'organisation ; chaque
--     point en hérite (structures.modules est une copie synchronisée par
--     l'application, conservée pour ne pas toucher aux lecteurs existants).
--   - ORG_ADMIN : users.organization_id renseigné, structure_id NULL.
--   - ADMIN (admin de point) et staff : structure_id = le point,
--     organization_id = l'organisation du point.
--   - Toutes les données métier restent scopées par structure_id : chaque
--     point est indépendant.
--
-- Migration des données : chaque structure existante devient une
-- organisation à un seul point, avec le même id. Sa licence est rattachée
-- à cette organisation. Aucun ORG_ADMIN n'est créé automatiquement : le
-- Super Admin peut en créer un depuis /structures.

-- 1. Table organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(100),
  modules TEXT[] DEFAULT ARRAY['POS'],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Colonnes de rattachement
ALTER TABLE structures ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE licenses   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE licenses   ADD COLUMN IF NOT EXISTS max_points INTEGER DEFAULT 1;
ALTER TABLE licenses   ALTER COLUMN structure_id DROP NOT NULL;

UPDATE structures SET is_active = TRUE WHERE is_active IS NULL;

-- 3. Backfill : une organisation par structure existante (même id)
INSERT INTO organizations (id, name, email, phone, city, country, modules, created_at)
SELECT
  s.id,
  s.name,
  s.email,
  s.phone,
  s.city,
  s.country,
  COALESCE(
    (
      SELECT array_agg(DISTINCT m)
      FROM unnest(s.modules) AS m
      WHERE m = ANY (ARRAY['POS','CLIENT_APP','CUISINE','BAR','LIVRAISON','TABLES','HOTEL','STOCK','PROMOTION','RH','CRM'])
    ),
    ARRAY['POS']
  ),
  s.created_at
FROM structures s
WHERE s.organization_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE structures SET organization_id = id WHERE organization_id IS NULL;

UPDATE licenses
SET organization_id = structure_id
WHERE organization_id IS NULL AND structure_id IS NOT NULL;

UPDATE users u
SET organization_id = s.organization_id
FROM structures s
WHERE u.structure_id = s.id AND u.organization_id IS NULL;

-- 4. Une licence par organisation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licenses_organization_id_key'
  ) THEN
    ALTER TABLE licenses ADD CONSTRAINT licenses_organization_id_key UNIQUE (organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_structures_organization_id ON structures(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

-- 5. RLS : la visibilité catalogue dépend désormais de la licence de
--    l'organisation et du statut du point.
CREATE OR REPLACE FUNCTION public.is_organization_license_active(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.licenses l
    WHERE l.organization_id = p_organization_id
      AND l.is_active IS TRUE
      AND (l.expires_at IS NULL OR l.expires_at > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_structure_license_active(p_structure_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.structures s
    WHERE s.id = p_structure_id
      AND s.is_active IS NOT FALSE
      AND public.is_organization_license_active(s.organization_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_organization_license_active(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_structure_license_active(UUID) TO anon, authenticated, service_role;

ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_anon_select ON public.organizations;
CREATE POLICY organizations_anon_select ON public.organizations
  FOR SELECT TO anon
  USING (public.is_organization_license_active(id));

DROP POLICY IF EXISTS licenses_anon_select ON public.licenses;
CREATE POLICY licenses_anon_select ON public.licenses
  FOR SELECT TO anon
  USING (public.is_organization_license_active(organization_id));

-- ============================================================
-- FIN DE LA MIGRATION PHASE 7
-- ============================================================
