-- ============================================================
-- SHEDE ERP — Phase 13 : API publique (marketplaces de livraison)
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
--
-- Étape 1 : clé d'API par point, quota mensuel, limitation de débit.
-- (Les étapes suivantes — commandes, idempotence, webhooks — compléteront
--  ce fichier ; il suffira de le ré-exécuter.)
-- ============================================================

-- 1. Quota de la licence : nombre de commandes reçues par l'API par mois,
--    pour toute l'organisation. NULL = illimité.
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS api_monthly_orders INTEGER DEFAULT 500;

-- 2. Clé d'API de chaque point (une seule par point).
--    Seule l'empreinte SHA-256 de la clé est stockée ; la clé en clair n'est
--    montrée qu'une fois, à sa génération.
CREATE TABLE IF NOT EXISTS point_api_credentials (
  structure_id UUID PRIMARY KEY REFERENCES structures(id) ON DELETE CASCADE,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- 3. Consommation mensuelle par point (appels et commandes reçues)
CREATE TABLE IF NOT EXISTS api_usage (
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- 1er jour du mois
  requests INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (structure_id, month)
);

-- 4. Fenêtres de limitation de débit (une ligne par point et par minute)
CREATE TABLE IF NOT EXISTS api_rate_windows (
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (structure_id, window_start)
);

ALTER TABLE point_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_windows ENABLE ROW LEVEL SECURITY;

-- 5. Compte un appel : incrémente la fenêtre de la minute en cours et la
--    consommation du mois, renvoie le nombre d'appels de la minute.
--    Atomique : deux appels simultanés ne peuvent pas passer sous la limite.
CREATE OR REPLACE FUNCTION public.api_hit(p_structure_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('minute', NOW());
  v_hits INTEGER;
BEGIN
  INSERT INTO api_rate_windows (structure_id, window_start, hits)
  VALUES (p_structure_id, v_window, 1)
  ON CONFLICT (structure_id, window_start)
  DO UPDATE SET hits = api_rate_windows.hits + 1
  RETURNING hits INTO v_hits;

  INSERT INTO api_usage (structure_id, month, requests)
  VALUES (p_structure_id, date_trunc('month', NOW())::DATE, 1)
  ON CONFLICT (structure_id, month)
  DO UPDATE SET requests = api_usage.requests + 1;

  -- Ménage : les fenêtres de plus d'une heure ne servent plus.
  IF v_hits = 1 THEN
    DELETE FROM api_rate_windows
    WHERE structure_id = p_structure_id AND window_start < NOW() - INTERVAL '1 hour';
  END IF;

  RETURN v_hits;
END;
$$;

REVOKE ALL ON FUNCTION public.api_hit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_hit(UUID) TO service_role;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 13 (étape 1)
-- Activez ensuite le module « API » dans la licence de l'organisation.
-- ============================================================
