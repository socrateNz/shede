-- Migration: Add paid_at column to orders table
-- Run this in your Supabase SQL Editor

-- 1. Add the paid_at column (nullable timestamptz)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Backfill: for existing COMPLETED orders, use updated_at as approximation
UPDATE orders
SET paid_at = updated_at
WHERE status = 'COMPLETED'
  AND paid_at IS NULL;

-- 3. Index for efficient shift filtering by paid_at
CREATE INDEX IF NOT EXISTS idx_orders_paid_at
  ON orders (structure_id, paid_at)
  WHERE paid_at IS NOT NULL;

-- Done!
