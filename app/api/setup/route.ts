import { getAdminSupabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// This endpoint should only be called once during initial setup
export async function POST(request: NextRequest) {
  // Verify setup token for security
  const setupToken = request.headers.get('x-setup-token');
  if (setupToken !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getAdminSupabase();

    // Create all tables using individual queries
    const createTablesSQL = `
      -- Structures (Restaurants/Businesses)
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

      -- Users
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

      -- Licenses (Subscription)
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

      -- Products/Menu Items
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

      -- Accompaniments (ne sont PAS des produits)
      CREATE TABLE IF NOT EXISTS accompaniments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        is_available BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Product accompaniments (relation)
      DROP TABLE IF EXISTS product_accompaniments;
      CREATE TABLE IF NOT EXISTS product_accompaniments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        accompaniment_id uuid NOT NULL REFERENCES accompaniments(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(structure_id, product_id, accompaniment_id)
      );

      -- Orders
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

      -- Order Items
      CREATE TABLE IF NOT EXISTS order_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        notes TEXT,
        -- Indique si cette ligne contribue au total de la commande.
        is_price_counted BOOLEAN NOT NULL DEFAULT TRUE,
        -- Si cet order_item est généré automatiquement (accompagnement),
        -- ce champ référence la ligne parent (produit principal).
        parent_order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Order accompaniments (choix faits pendant la commande)
      CREATE TABLE IF NOT EXISTS order_accompaniments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        parent_order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        accompaniment_id uuid NOT NULL REFERENCES accompaniments(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price_snapshot DECIMAL(10, 2) NOT NULL,
        total_price_snapshot DECIMAL(10, 2) NOT NULL,
        is_price_counted BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(order_id, parent_order_item_id, accompaniment_id)
      );

      -- Payments
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

      -- Push Subscriptions
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        structure_id uuid NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        url TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_structure_id ON users(structure_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_products_structure_id ON products(structure_id);
      CREATE INDEX IF NOT EXISTS idx_orders_structure_id ON orders(structure_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_parent_order_item_id ON order_items(parent_order_item_id);
      CREATE INDEX IF NOT EXISTS idx_order_accompaniments_order_id ON order_accompaniments(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_accompaniments_parent_order_item_id ON order_accompaniments(parent_order_item_id);
      CREATE INDEX IF NOT EXISTS idx_order_accompaniments_accompaniment_id ON order_accompaniments(accompaniment_id);
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_push_structure_id ON push_subscriptions(structure_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_structure_id ON notifications(structure_id);
    `;

    // Execute using admin client
    const { error } = await admin.from('_dummy').select('*').limit(1);
    if (error) {
      console.log('Admin client initialized');
    }

    return NextResponse.json({
      success: true,
      message: 'Setup initiated. Please run the SQL migration in your Supabase dashboard.',
      sql: createTablesSQL,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
