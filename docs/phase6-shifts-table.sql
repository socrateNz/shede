  -- ============================================================
  -- SHEDE ERP — Phase 6 : Table Shifts (Sessions de caisse)
  -- À exécuter dans le SQL Editor de votre projet Supabase
  -- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
  -- ============================================================

  -- Contexte : `shifts` existe déjà en production mais avait été créée
  -- manuellement (jamais versionnée dans une migration). Cette migration
  -- se contente de documenter son schéma exact (vérifié en base) et de
  -- permettre à une nouvelle installation de démarrer avec la même
  -- structure — CREATE TABLE IF NOT EXISTS, donc sans effet sur une base
  -- où `shifts` existe déjà.

  CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_id UUID REFERENCES structures(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_amount NUMERIC(12, 2) DEFAULT 0,
    actual_amount NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    notes TEXT,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Index absents en production à ce jour (seule la clé primaire existait) —
  -- ajoutés ici car `shifts` est systématiquement filtrée par ces colonnes
  -- (session active d'un caissier, historique d'une structure).
  CREATE INDEX IF NOT EXISTS idx_shifts_structure_id ON shifts(structure_id);
  CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
  CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

  ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
  -- Aucune policy anon/authenticated : accès exclusivement via service_role
  -- (server actions), cohérent avec le modèle décrit dans scripts/05-enable-rls.sql.
  -- (Déjà le cas en production — RLS y est activé sur `shifts` sans policy.)

  -- ============================================================
  -- FIN DE LA MIGRATION PHASE 6
  -- ============================================================
