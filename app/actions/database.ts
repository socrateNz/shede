'use server';

import { getAdminSupabase } from '@/lib/supabase';

export async function initializeDatabase() {
  const admin = getAdminSupabase();

  const tables = [
    {
      name: 'structures',
      sql: `
        CREATE TABLE IF NOT EXISTS structures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          phone VARCHAR(20),
          address TEXT,
          city VARCHAR(100),
          country VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
    },
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          role VARCHAR(50) NOT NULL DEFAULT 'SERVEUR',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(structure_id, email)
        );
        CREATE INDEX IF NOT EXISTS idx_users_structure_id ON users(structure_id);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `,
    },
    {
      name: 'licenses',
      sql: `
        CREATE TABLE IF NOT EXISTS licenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          structure_id UUID NOT NULL UNIQUE REFERENCES structures(id) ON DELETE CASCADE,
          license_key VARCHAR(255) UNIQUE,
          plan VARCHAR(50) NOT NULL DEFAULT 'FREE',
          max_users INTEGER DEFAULT 5,
          max_tables INTEGER DEFAULT 10,
          features JSONB DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
    },
    {
      name: 'products',
      sql: `
        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) NOT NULL,
          category VARCHAR(100),
          is_available BOOLEAN DEFAULT TRUE,
          is_deleted BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_products_structure_id ON products(structure_id);
      `,
    },
    {
      name: 'accompaniments',
      sql: `
        CREATE TABLE IF NOT EXISTS accompaniments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10, 2) NOT NULL,
          is_available BOOLEAN DEFAULT TRUE,
          is_deleted BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_accompaniments_structure_id ON accompaniments(structure_id);
      `,
    },
    {
      name: 'orders',
      sql: `
        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          table_number INTEGER,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          subtotal DECIMAL(10, 2) DEFAULT 0,
          tax DECIMAL(10, 2) DEFAULT 0,
          total DECIMAL(10, 2) DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_orders_structure_id ON orders(structure_id);
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      `,
    },
    {
      name: 'order_items',
      sql: `
        CREATE TABLE IF NOT EXISTS order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id UUID NOT NULL REFERENCES products(id),
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10, 2) NOT NULL,
          total_price DECIMAL(10, 2) NOT NULL,
          notes TEXT,
          -- Indique si cette ligne doit contribuer au total de la commande.
          -- Cas typique: accompagnement avec prix optionnel/inclus.
          is_price_counted BOOLEAN NOT NULL DEFAULT TRUE,
          -- Si cet order_item est ajouté automatiquement à cause d'un autre item,
          -- ce champ référence l'item parent (le produit principal).
          parent_order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_parent_order_item_id ON order_items(parent_order_item_id);
      `,
    },
    {
      name: 'product_accompaniments',
      sql: `
        DROP TABLE IF EXISTS product_accompaniments;

        CREATE TABLE IF NOT EXISTS product_accompaniments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
          product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          accompaniment_id UUID NOT NULL REFERENCES accompaniments(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(structure_id, product_id, accompaniment_id)
        );
        CREATE INDEX IF NOT EXISTS idx_product_accompaniments_structure_id ON product_accompaniments(structure_id);
        CREATE INDEX IF NOT EXISTS idx_product_accompaniments_product_id ON product_accompaniments(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_accompaniments_accompaniment_id ON product_accompaniments(accompaniment_id);
      `,
    },
    {
      name: 'order_accompaniments',
      sql: `
        CREATE TABLE IF NOT EXISTS order_accompaniments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          parent_order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
          accompaniment_id UUID NOT NULL REFERENCES accompaniments(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price_snapshot DECIMAL(10, 2) NOT NULL,
          total_price_snapshot DECIMAL(10, 2) NOT NULL,
          is_price_counted BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(order_id, parent_order_item_id, accompaniment_id)
        );
        CREATE INDEX IF NOT EXISTS idx_order_accompaniments_order_id ON order_accompaniments(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_accompaniments_parent_order_item_id ON order_accompaniments(parent_order_item_id);
        CREATE INDEX IF NOT EXISTS idx_order_accompaniments_accompaniment_id ON order_accompaniments(accompaniment_id);
      `,
    },
    {
      name: 'payments',
      sql: `
        CREATE TABLE IF NOT EXISTS payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          reference VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
        CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      `,
    },
    {
      name: 'push_subscriptions',
      sql: `
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_push_structure_id ON push_subscriptions(structure_id);
      `,
    },
    {
      name: 'notifications',
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          url TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_structure_id ON notifications(structure_id);
      `,
    },
  ];

  for (const table of tables) {
    const { error } = await admin.rpc('exec', {
      sql: table.sql,
    } as any);

    if (error) {
      console.error(`Error creating table ${table.name}:`, error);
    }
  }

  return { success: true };
}
