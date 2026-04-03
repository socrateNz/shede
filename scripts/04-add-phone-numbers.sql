-- 04-add-phone-numbers.sql
-- Add phone number for clients on orders and bookings

ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Indexes might be useful if searching by phone later
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
