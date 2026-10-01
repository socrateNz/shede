-- ============================================================
-- SHEDE ERP — Phase 14 : corrections
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Remise manuelle saisie en caisse, séparée de la remise totale.
--    Avant : orders.discount_amount servait à la fois de remise manuelle
--    (à la création) et de remise totale (promotions + manuelle, après calcul).
--    Chaque recalcul relisait la remise totale comme remise manuelle : la
--    remise promo était déduite une fois de plus à chaque ajout/retrait d'article.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manual_discount NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Reprise approximative des commandes encore ouvertes (les commandes payées ou
-- annulées ne sont plus recalculées) : on considère comme remise manuelle celle
-- des commandes qui ont un motif de remise. Les commandes ouvertes sans motif
-- repartent sans remise manuelle ; ressaisissez-la si besoin.
UPDATE orders
SET manual_discount = COALESCE(discount_amount, 0)
WHERE manual_discount = 0
  AND discount_reason IS NOT NULL
  AND COALESCE(discount_amount, 0) > 0
  AND status NOT IN ('COMPLETED', 'CANCELLED');

-- ============================================================
-- FIN DE LA MIGRATION PHASE 14
-- ============================================================
