-- ============================================================
-- SHEDE ERP — Phase 5 : Nettoyage de structures.modules
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- Contexte : le formulaire de modification de structure
-- (app/(main)/structures/[id]/edit/page.tsx) ré-encodait inutilement la
-- sélection de modules en JSON puis la rajoutait comme une entrée
-- supplémentaire du FormData. `parseModulesFromFormData` (qui découpe
-- chaque entrée sur les virgules pour supporter le format historique
-- "POS,CLIENT_APP,...") découpait alors ce blob JSON lui-même, produisant
-- des fragments invalides comme `["POS"` ou `"CRM"]` stockés à côté des
-- vraies valeurs. Le bug applicatif est corrigé ; cette migration nettoie
-- les données déjà écrites en base.

UPDATE structures
SET modules = COALESCE(
  (
    SELECT array_agg(DISTINCT m)
    FROM unnest(modules) AS m
    WHERE m = ANY (ARRAY['POS','CLIENT_APP','CUISINE','BAR','LIVRAISON','TABLES','HOTEL','STOCK','PROMOTION','RH','CRM'])
  ),
  ARRAY['POS']
)
WHERE modules IS DISTINCT FROM COALESCE(
  (
    SELECT array_agg(DISTINCT m)
    FROM unnest(modules) AS m
    WHERE m = ANY (ARRAY['POS','CLIENT_APP','CUISINE','BAR','LIVRAISON','TABLES','HOTEL','STOCK','PROMOTION','RH','CRM'])
  ),
  ARRAY['POS']
);

-- ============================================================
-- FIN DE LA MIGRATION PHASE 5
-- ============================================================
