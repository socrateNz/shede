const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

function readEnv(filePath) {
  const envRaw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of envRaw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

(async () => {
  const env = readEnv(path.join(process.cwd(), '.env'));
  const rawConn = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL;
  if (!rawConn) throw new Error('POSTGRES_URL missing');
  const conn = rawConn
    .replace(/([?&])sslmode=[^&]*/g, '$1')
    .replace(/[?&]$/, '');

  const sql = `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS structures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      country VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      role VARCHAR(50) NOT NULL DEFAULT 'SERVEUR',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(structure_id, email)
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      structure_id uuid NOT NULL UNIQUE REFERENCES structures(id) ON DELETE CASCADE,
      license_key VARCHAR(255) UNIQUE,
      plan VARCHAR(50) NOT NULL DEFAULT 'FREE',
      max_users INTEGER DEFAULT 5,
      max_tables INTEGER DEFAULT 10,
      features JSONB DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      category VARCHAR(100),
      is_available BOOLEAN DEFAULT TRUE,
      is_deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      table_number INTEGER,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      subtotal DECIMAL(10, 2) DEFAULT 0,
      tax DECIMAL(10, 2) DEFAULT 0,
      total DECIMAL(10, 2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price DECIMAL(10, 2) NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      reference VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_structure_id ON users(structure_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_products_structure_id ON products(structure_id);
    CREATE INDEX IF NOT EXISTS idx_orders_structure_id ON orders(structure_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  `;

  const client = new Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query(sql);

  const email = 'etarcos3@gmail.com';
  const password = 'Etarcos123';
  const passHash = await bcrypt.hash(password, 10);

  let structureResult = await client.query(
    'SELECT id FROM structures WHERE email = $1 LIMIT 1',
    [email]
  );

  let structureId;
  if (structureResult.rowCount) {
    structureId = structureResult.rows[0].id;
  } else {
    const created = await client.query(
      'INSERT INTO structures(name, email) VALUES($1, $2) RETURNING id',
      ['Shede HQ', email]
    );
    structureId = created.rows[0].id;
  }

  const existingUser = await client.query(
    'SELECT id FROM users WHERE structure_id = $1 AND email = $2 LIMIT 1',
    [structureId, email]
  );

  if (existingUser.rowCount) {
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           role = $2,
           is_active = true,
           first_name = $3,
           last_name = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [passHash, 'SUPER_ADMIN', 'Super', 'Admin', existingUser.rows[0].id]
    );
    console.log('SUPER_ADMIN mis a jour');
  } else {
    await client.query(
      `INSERT INTO users(structure_id, email, password_hash, first_name, last_name, role, is_active)
       VALUES($1, $2, $3, $4, $5, $6, true)`,
      [structureId, email, passHash, 'Super', 'Admin', 'SUPER_ADMIN']
    );
    console.log('SUPER_ADMIN cree');
  }

  const existingLicense = await client.query(
    'SELECT id FROM licenses WHERE structure_id = $1 LIMIT 1',
    [structureId]
  );

  if (!existingLicense.rowCount) {
    await client.query(
      'INSERT INTO licenses(structure_id, plan, max_users, max_tables, is_active) VALUES($1, $2, $3, $4, true)',
      [structureId, 'ENTERPRISE', 999, 999]
    );
    console.log('Licence creee');
  } else {
    console.log('Licence deja existante');
  }

  await client.end();
  console.log('INITIALISATION TERMINEE');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
