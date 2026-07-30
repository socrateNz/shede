-- ============================================================
-- MIGRATION PHASE 3 : Types de Consommation & Statuts Mixtes
-- ============================================================

-- 1. Ajout des frais d'emballage à la structure
ALTER TABLE structures
  ADD COLUMN IF NOT EXISTS takeaway_fee NUMERIC(10,2) DEFAULT 0;

-- 2. Ajout des types de consommation et statuts indépendants aux commandes
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS consumption_type VARCHAR(50) DEFAULT 'DINE_IN',
  ADD COLUMN IF NOT EXISTS kitchen_status VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bar_status VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS takeaway_fee NUMERIC(10,2) DEFAULT 0;

-- Note : 'consumption_type' peut être 'DINE_IN' ou 'TAKEAWAY'.
-- Note : 'kitchen_status' et 'bar_status' peuvent être 'PENDING', 'IN_PROGRESS', ou 'READY'.
