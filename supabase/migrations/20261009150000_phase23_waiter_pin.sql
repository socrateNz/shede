-- ============================================================
-- SHEDE ERP — Phase 23 : téléphones partagés et connexion par code PIN (mode serveur)
-- À exécuter dans le SQL Editor de votre projet Supabase, après la phase 22.
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Code PIN des serveurs (4 chiffres), stocké haché (bcrypt), jamais en clair.
--    Blocage temporaire après plusieurs codes faux : un code à 4 chiffres se devine vite.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_failed_attempts SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- 2. Téléphones enregistrés par un admin. Le téléphone garde une clé secrète (cookie) ;
--    seule son empreinte SHA-256 est stockée ici. Révocable à tout moment.
CREATE TABLE IF NOT EXISTS waiter_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_waiter_devices_structure ON waiter_devices (structure_id) WHERE revoked_at IS NULL;

-- 3. Liens d'enregistrement : à usage unique, valables quelques minutes (empreinte seulement).
CREATE TABLE IF NOT EXISTS waiter_device_enrollments (
  code_hash TEXT PRIMARY KEY,
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- Lecture et écriture via le service role uniquement (server actions).
ALTER TABLE waiter_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_device_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE waiter_devices FROM anon, authenticated;
REVOKE ALL ON TABLE waiter_device_enrollments FROM anon, authenticated;

-- L'empreinte du PIN ne doit jamais sortir par l'API publique (les users ont déjà la RLS sans policy).
REVOKE SELECT (pin_hash) ON users FROM anon, authenticated;
