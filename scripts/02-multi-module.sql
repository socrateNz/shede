-- 02-multi-module.sql

-- 1. Structures updates
ALTER TABLE structures ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'RESTAURANT';
ALTER TABLE structures ADD COLUMN IF NOT EXISTS modules TEXT[] DEFAULT ARRAY['POS'];

-- 2. Users updates
ALTER TABLE users ALTER COLUMN structure_id DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_structure_id_email_key;
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- 3. Pivot table for Admin/M:N relations
CREATE TABLE IF NOT EXISTS user_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, structure_id)
);

-- 4. Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  number VARCHAR(50) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'AVAILABLE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  check_in TIMESTAMP,
  check_out TIMESTAMP,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Orders updates
ALTER TABLE orders ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'CAISSE';
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL; -- Allow client_id instead of user_id

-- Indexes for new columns & tables
CREATE INDEX IF NOT EXISTS idx_user_structures_user_id ON user_structures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_structures_structure_id ON user_structures(structure_id);
CREATE INDEX IF NOT EXISTS idx_rooms_structure_id ON rooms(structure_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_room_id ON orders(room_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
