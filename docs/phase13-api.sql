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
-- Étape 2 : commandes reçues des marketplaces
-- ============================================================

-- 6. Pause : le point n'accepte temporairement plus de commandes marketplace
ALTER TABLE structures ADD COLUMN IF NOT EXISTS api_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- 7. Champs des commandes marketplace (source = 'API')
--    acceptance  : PENDING (à accepter), ACCEPTED, REJECTED — NULL hors API
--    courier_*   : livreur de la marketplace (ASSIGNED, PICKED_UP, DELIVERED, FAILED)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS acceptance VARCHAR(12);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prep_minutes INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_status VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(30);

-- Une commande marketplace n'est créée qu'une fois, même si la requête est rejouée.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_structure_external
  ON orders(structure_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_structure_updated ON orders(structure_id, updated_at);

-- 8. Date de dernière modification des commandes (synchronisation des marketplaces)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_orders') THEN
    CREATE TRIGGER set_updated_at_orders
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 9. Compte une commande reçue par l'API et vérifie le quota mensuel de
--    l'organisation. Renvoie FALSE (sans compter) si le quota est atteint.
CREATE OR REPLACE FUNCTION public.api_count_order(p_structure_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month DATE := date_trunc('month', NOW())::DATE;
  v_org UUID;
  v_quota INTEGER;
  v_used INTEGER;
BEGIN
  SELECT s.organization_id, l.api_monthly_orders INTO v_org, v_quota
  FROM structures s
  LEFT JOIN licenses l ON l.organization_id = s.organization_id
  WHERE s.id = p_structure_id;

  -- Verrou sur l'organisation : deux commandes simultanées ne dépassent pas le quota.
  PERFORM 1 FROM organizations WHERE id = v_org FOR UPDATE;

  IF v_quota IS NOT NULL THEN
    SELECT COALESCE(SUM(u.orders), 0) INTO v_used
    FROM api_usage u JOIN structures s ON s.id = u.structure_id
    WHERE s.organization_id = v_org AND u.month = v_month;
    IF v_used >= v_quota THEN
      RETURN FALSE;
    END IF;
  END IF;

  INSERT INTO api_usage (structure_id, month, orders)
  VALUES (p_structure_id, v_month, 1)
  ON CONFLICT (structure_id, month) DO UPDATE SET orders = api_usage.orders + 1;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.api_count_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_count_order(UUID) TO service_role;

-- ============================================================
-- Étape 3 : webhooks (Shede prévient la marketplace)
-- ============================================================

-- 10. Adresse et secret de signature du webhook du point
ALTER TABLE point_api_credentials ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE point_api_credentials ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- 11. Dernier statut communiqué à la marketplace (évite les doublons d'événements)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS api_last_status VARCHAR(30);

-- 12. Événements à envoyer, avec leurs tentatives
--     status : PENDING (à envoyer / à réessayer), DELIVERED, FAILED (abandon)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_status_code INTEGER,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
  ON webhook_deliveries(next_attempt_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_structure
  ON webhook_deliveries(structure_id, created_at DESC);
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- 13. Réserve les envois à faire (un envoi n'est jamais traité deux fois en
--     parallèle : la ligne est « louée » 2 minutes, puis l'envoi met à jour
--     la vraie date de prochaine tentative).
CREATE OR REPLACE FUNCTION public.claim_due_webhooks(p_limit INTEGER, p_structure_id UUID DEFAULT NULL)
RETURNS SETOF webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE webhook_deliveries d
  SET next_attempt_at = NOW() + INTERVAL '2 minutes'
  WHERE d.id IN (
    SELECT w.id FROM webhook_deliveries w
    WHERE w.status = 'PENDING'
      AND w.next_attempt_at <= NOW()
      AND (p_structure_id IS NULL OR w.structure_id = p_structure_id)
    ORDER BY w.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING d.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_webhooks(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_webhooks(INTEGER, UUID) TO service_role;

-- 14. Relances automatiques chaque minute (gratuit, sans Vercel Pro) :
--     Supabase appelle /api/cron/webhooks grâce aux extensions pg_cron et pg_net.
--     1) Dashboard Supabase → Database → Extensions : activez « pg_cron » et « pg_net ».
--     2) Remplacez <DOMAINE> et <CRON_SECRET> (la valeur de CRON_SECRET de votre
--        hébergement), puis exécutez une seule fois, à part (copiez le bloc sans
--        les « -- » dans un nouvel onglet du SQL Editor) — ne le décommentez pas
--        ici : ré-exécuter ce fichier écraserait la tâche avec les valeurs génériques.
--
-- SELECT cron.schedule(
--   'shede-webhooks',
--   '* * * * *',
--   $cron$
--   SELECT net.http_get(
--     url := 'https://<DOMAINE>/api/cron/webhooks',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--   );
--   $cron$
-- );
--
--     Pour arrêter : SELECT cron.unschedule('shede-webhooks');

-- ============================================================
-- Étape 4 : clé de test (mode bac à sable)
-- ============================================================

-- 15. Clé de test de chaque point (shd_test_…). Avec cette clé, l'API valide et
--     simule les commandes sans rien écrire en base (ni commande, ni quota, ni
--     webhook enregistré). Seule l'empreinte SHA-256 est stockée.
CREATE TABLE IF NOT EXISTS point_api_test_credentials (
  structure_id UUID PRIMARY KEY REFERENCES structures(id) ON DELETE CASCADE,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE point_api_test_credentials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 13 (étapes 1 à 4)
-- Activez ensuite le module « API » dans la licence de l'organisation.
-- ============================================================
