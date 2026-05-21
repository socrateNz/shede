-- =============================================================================
-- Shede — Row Level Security (RLS)
-- =============================================================================
-- À exécuter dans l’éditeur SQL Supabase (après 01–04 et promotions.sql).
--
-- Modèle :
--   • rôle `anon`     → lecture catalogue B2C uniquement (policies ci-dessous)
--   • rôle `authenticated` → aucune policy (tout refusé par défaut)
--   • `service_role`  → contourne le RLS (server actions Next.js — inchangé)
--
-- L’app utilise une session JWT maison (cookie), pas Supabase Auth : les policies
-- ne s’appuient PAS sur auth.uid().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions utilitaires (SECURITY DEFINER — lecture licences sans fuite RLS)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_structure_license_active(p_structure_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.licenses l
    WHERE l.structure_id = p_structure_id
      AND l.is_active IS TRUE
      AND (l.expires_at IS NULL OR l.expires_at > NOW())
  );
$$;

COMMENT ON FUNCTION public.is_structure_license_active(UUID) IS
  'True si la structure a une licence active et non expirée.';

CREATE OR REPLACE FUNCTION public.is_structure_catalog_visible(p_structure_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_structure_license_active(p_structure_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_structure_license_active(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_structure_catalog_visible(UUID) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Nettoyage des anciennes policies (promotions.sql — auth.uid() incompatible)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their structure's promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can manage their structure's promotions" ON public.promotions;

-- -----------------------------------------------------------------------------
-- Activer RLS sur toutes les tables métier
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accompaniments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_accompaniments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_accompaniments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_code_usages ENABLE ROW LEVEL SECURITY;

-- Tables optionnelles (modules stock / shifts — si présentes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stocks') THEN
    ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_movements') THEN
    ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_recipes') THEN
    ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shifts') THEN
    ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- CATALOGUE PUBLIC (rôle anon — SELECT uniquement)
-- -----------------------------------------------------------------------------

-- structures : établissements avec licence active
DROP POLICY IF EXISTS structures_anon_select ON public.structures;
CREATE POLICY structures_anon_select ON public.structures
  FOR SELECT TO anon
  USING (public.is_structure_catalog_visible(id));

-- licenses : jointure client (pas de fuite sur structures hors catalogue)
DROP POLICY IF EXISTS licenses_anon_select ON public.licenses;
CREATE POLICY licenses_anon_select ON public.licenses
  FOR SELECT TO anon
  USING (public.is_structure_catalog_visible(structure_id));

-- products : menu public
DROP POLICY IF EXISTS products_anon_select ON public.products;
CREATE POLICY products_anon_select ON public.products
  FOR SELECT TO anon
  USING (
    public.is_structure_catalog_visible(structure_id)
    AND is_available IS TRUE
    AND is_deleted IS FALSE
  );

-- accompaniments
DROP POLICY IF EXISTS accompaniments_anon_select ON public.accompaniments;
CREATE POLICY accompaniments_anon_select ON public.accompaniments
  FOR SELECT TO anon
  USING (
    public.is_structure_catalog_visible(structure_id)
    AND is_available IS TRUE
    AND is_deleted IS FALSE
  );

-- product_accompaniments
DROP POLICY IF EXISTS product_accompaniments_anon_select ON public.product_accompaniments;
CREATE POLICY product_accompaniments_anon_select ON public.product_accompaniments
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_id
        AND p.is_available IS TRUE
        AND p.is_deleted IS FALSE
        AND public.is_structure_catalog_visible(p.structure_id)
    )
  );

-- rooms : consultation / réservation (tous statuts — filtrage UI côté app)
DROP POLICY IF EXISTS rooms_anon_select ON public.rooms;
CREATE POLICY rooms_anon_select ON public.rooms
  FOR SELECT TO anon
  USING (public.is_structure_catalog_visible(structure_id));

-- promotions : offres actives visibles (hors codes secrets si colonne promo_mode)
DROP POLICY IF EXISTS promotions_anon_select ON public.promotions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'promotions'
      AND column_name = 'promo_mode'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY promotions_anon_select ON public.promotions
        FOR SELECT TO anon
        USING (
          public.is_structure_catalog_visible(structure_id)
          AND is_active IS TRUE
          AND start_date <= NOW()
          AND end_date >= NOW()
          AND (promo_mode IS NULL OR promo_mode IS DISTINCT FROM 'CODE')
        )
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE POLICY promotions_anon_select ON public.promotions
        FOR SELECT TO anon
        USING (
          public.is_structure_catalog_visible(structure_id)
          AND is_active IS TRUE
          AND start_date <= NOW()
          AND end_date >= NOW()
        )
    $sql$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Aucune policy anon sur les tables sensibles → refus implicite :
-- users, orders, order_items, order_accompaniments, payments,
-- push_subscriptions, notifications, user_structures, bookings,
-- promo_codes, promo_code_usages, stocks, stock_movements, product_recipes, shifts
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Rôle authenticated (Supabase Auth non utilisé par Shede aujourd’hui)
-- Aucune policy → tout refusé si quelqu’un utilise la clé anon avec un JWT Supabase
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Fin — Vérification rapide (à lancer après application) :
-- SET ROLE anon;
-- SELECT count(*) FROM structures;
-- RESET ROLE;
-- =============================================================================
