-- Migration: Support accompaniments in stock management
-- Run this in your Supabase SQL Editor

-- 1. Add accompaniment_id to stocks table (nullable — either product_id OR accompaniment_id)
ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS accompaniment_id UUID REFERENCES accompaniments(id) ON DELETE CASCADE;

-- 2. Add accompaniment_id to stock_movements table
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS accompaniment_id UUID REFERENCES accompaniments(id) ON DELETE CASCADE;

-- 3. Drop old unique constraint on (structure_id, product_id) and replace with flexible ones
-- Note: find the existing constraint name first if needed, then:
ALTER TABLE stocks
  DROP CONSTRAINT IF EXISTS stocks_structure_id_product_id_key;

-- 4. Add new unique constraints for each type
CREATE UNIQUE INDEX IF NOT EXISTS stocks_product_unique
  ON stocks (structure_id, product_id)
  WHERE product_id IS NOT NULL AND accompaniment_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stocks_accompaniment_unique
  ON stocks (structure_id, accompaniment_id)
  WHERE accompaniment_id IS NOT NULL AND product_id IS NULL;

-- Done!
