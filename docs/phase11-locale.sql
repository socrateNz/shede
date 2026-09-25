-- ============================================================
-- SHEDE ERP — Phase 11 : Langue préférée des utilisateurs
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- Langue choisie par l'utilisateur (sélecteur FR / EN). Sert aux emails,
-- envoyés dans la langue du destinataire.
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale VARCHAR(5) NOT NULL DEFAULT 'fr'
  CHECK (locale IN ('fr', 'en'));

-- ============================================================
-- FIN DE LA MIGRATION PHASE 11
-- ============================================================
