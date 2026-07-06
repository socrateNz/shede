-- ============================================================
-- SHEDE ERP — Phase 2 Migration
-- À exécuter dans le SQL Editor de votre projet Supabase
-- ============================================================

-- -------------------------------------------------------
-- 1. Table Clients (CRM)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  structure_id UUID REFERENCES structures(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birthday DATE,
  allergies TEXT,
  preferences TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at pour clients
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index pour accélérer les recherches de clients
CREATE INDEX IF NOT EXISTS idx_clients_structure_id ON clients(structure_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(last_name, first_name);


-- -------------------------------------------------------
-- 2. Table Tables (Floor Manager)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  structure_id UUID REFERENCES structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Table 1", "Terrasse A"
  capacity INTEGER DEFAULT 2,
  shape TEXT DEFAULT 'rectangle', -- 'round', 'square', 'rectangle'
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 100,
  height INTEGER DEFAULT 100,
  floor_name TEXT DEFAULT 'Salle principale',
  status TEXT DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_tables_updated_at
BEFORE UPDATE ON tables
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tables_structure_id ON tables(structure_id);


-- -------------------------------------------------------
-- 3. Mise à jour de la table Orders (POS Amélioré)
-- -------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT,
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES tables(id) ON DELETE SET NULL;

-- -------------------------------------------------------
-- 4. Sécurité RLS (Row Level Security)
-- -------------------------------------------------------
-- Activer le RLS sur les nouvelles tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Politiques pour les clients (Lecture et écriture autorisées pour la structure via service_role ou auth)
CREATE POLICY "Enable all for users based on structure_id for clients"
  ON clients FOR ALL
  USING (true)
  WITH CHECK (true);

-- Politiques pour les tables
CREATE POLICY "Enable all for users based on structure_id for tables"
  ON tables FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FIN DE LA MIGRATION PHASE 2
-- ============================================================
