-- ============================================================
-- SHEDE ERP — Phase 19 : Prévisions de ventes (module PREVISIONS)
-- À exécuter dans le SQL Editor de votre projet Supabase.
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Ventes par jour (heure du Cameroun) et par produit, pour l'historique des prévisions.
--    Commandes non annulées ; lignes principales (pas les sous-lignes de menu).
CREATE OR REPLACE FUNCTION daily_product_sales(p_structure_id UUID, p_from DATE, p_to DATE)
RETURNS TABLE (day DATE, product_id UUID, quantity NUMERIC, revenue NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (o.created_at AT TIME ZONE 'Africa/Douala')::DATE AS day,
         oi.product_id,
         SUM(oi.quantity)::NUMERIC AS quantity,
         SUM(oi.total_price)::NUMERIC AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.structure_id = p_structure_id
    AND o.status <> 'CANCELLED'
    AND oi.parent_order_item_id IS NULL
    AND oi.product_id IS NOT NULL
    AND o.created_at >= (p_from::TIMESTAMP AT TIME ZONE 'Africa/Douala')
    AND o.created_at < ((p_to + 1)::TIMESTAMP AT TIME ZONE 'Africa/Douala')
  GROUP BY 1, 2;
$$;
REVOKE ALL ON FUNCTION daily_product_sales(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION daily_product_sales(UUID, DATE, DATE) TO service_role;

CREATE INDEX IF NOT EXISTS idx_orders_structure_created ON orders (structure_id, created_at);

-- 2. Événements saisis par le restaurant : impact en % sur les ventes du jour
--    (+40 : match, fête ; -100 : fermeture). Ils servent aussi à écarter ces jours
--    de l'historique, pour ne pas fausser les moyennes.
CREATE TABLE IF NOT EXISTS forecast_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  label VARCHAR(120) NOT NULL,
  impact_percent INTEGER NOT NULL DEFAULT 0 CHECK (impact_percent BETWEEN -100 AND 500),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (structure_id, event_date)
);
ALTER TABLE forecast_events ENABLE ROW LEVEL SECURITY;

-- 3. Prévisions conservées, pour mesurer la fiabilité (prévu / réalisé).
--    Mises à jour tant que le jour n'est pas commencé : la valeur gardée est la
--    dernière prévision faite avant le jour.
CREATE TABLE IF NOT EXISTS forecast_snapshots (
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 2) NOT NULL,
  revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (structure_id, forecast_date, product_id)
);
CREATE INDEX IF NOT EXISTS idx_forecast_snapshots_date ON forecast_snapshots (structure_id, forecast_date);
ALTER TABLE forecast_snapshots ENABLE ROW LEVEL SECURITY;

-- 4. Calcul quotidien des prévisions (tâche planifiée Supabase, comme les webhooks).
--    À exécuter UNE fois, à part, dans un nouvel onglet du SQL Editor, en
--    remplaçant <DOMAINE> et <CRON_SECRET> — ne le décommentez pas ici :
--    ré-exécuter ce fichier écraserait la tâche avec les valeurs génériques.
--    « 0 3 * * * » = 3 h UTC = 4 h au Cameroun, avant l'ouverture.
--
-- SELECT cron.schedule(
--   'shede-forecasts',
--   '0 3 * * *',
--   $cron$
--   SELECT net.http_get(
--     url := 'https://<DOMAINE>/api/cron/forecasts',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
--     timeout_milliseconds := 60000
--   );
--   $cron$
-- );
--
--     Pour arrêter : SELECT cron.unschedule('shede-forecasts');

-- ============================================================
-- FIN DE LA MIGRATION PHASE 19
-- ============================================================
