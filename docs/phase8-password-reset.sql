-- ============================================================
-- SHEDE ERP — Phase 8 : Liens de (ré)initialisation de mot de passe
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- Utilisée par :
--   - « Mot de passe oublié » (lien valable 1 heure)
--   - les emails de création de compte (lien « choisir mon mot de passe »,
--     valable 7 jours)
-- Seule l'empreinte SHA-256 du jeton est stockée : le jeton en clair
-- n'existe que dans l'email envoyé.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'RESET' CHECK (purpose IN ('RESET', 'INVITE')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Accès exclusivement via service_role (server actions), aucune policy anon.
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 8
-- ============================================================
