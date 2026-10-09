-- ============================================================
-- SHEDE ERP — Phase 22 : mode serveur (prise de commande sur téléphone)
-- À exécuter dans le SQL Editor de votre projet Supabase.
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Nombre de couverts de la table, saisi à l'ouverture.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS covers SMALLINT;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_covers_check CHECK (covers IS NULL OR covers BETWEEN 1 AND 99);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Envoi en deux temps : une ligne « en attente » n'est pas encore partie en cuisine
--    (les boissons d'abord, les plats au signal du serveur). Elle ne s'affiche pas sur
--    les écrans cuisine et bar tant qu'elle n'est pas envoyée (fired_at).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS held BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fired_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_order_items_held ON order_items (order_id) WHERE held;

-- 3. Envois du téléphone : chacun porte un identifiant unique créé sur le téléphone.
--    Un envoi répété (double appui, réseau instable, file hors ligne) n'est traité
--    qu'une fois : la clé primaire refuse le doublon, même en cas d'envois simultanés.
CREATE TABLE IF NOT EXISTS order_submissions (
  ref UUID PRIMARY KEY,
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_submissions_structure ON order_submissions (structure_id, created_at DESC);

-- Lecture et écriture via le service role uniquement (server actions).
ALTER TABLE order_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE order_submissions FROM anon, authenticated;

-- 4. Commande ouverte d'une table (plan de salle du serveur).
CREATE INDEX IF NOT EXISTS idx_orders_table_open ON orders (table_id, created_at DESC)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED');
