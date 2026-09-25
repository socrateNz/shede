-- ============================================================
-- SHEDE ERP — Phase 10 : Livraison (zones, adresse par repère, suivi)
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- 1. Zones de livraison d'un point (quartier / secteur + frais)
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (structure_id, name)
);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_structure_id ON delivery_zones(structure_id);

-- Lecture et écriture via le service role uniquement (server actions).
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- 2. Livraison sur la commande
--    consumption_type = 'DELIVERY' pour une commande à livrer.
--    L'adresse suit l'usage camerounais : ville + quartier + point de repère,
--    avec une position GPS facultative (partagée depuis le téléphone).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_name VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_district VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_landmark TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20)
  CHECK (delivery_status IN ('TO_ASSIGN', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(structure_id, delivery_status)
  WHERE delivery_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON orders(courier_id) WHERE courier_id IS NOT NULL;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 10
-- ============================================================
