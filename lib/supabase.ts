import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client (only use in server actions)
export function getAdminSupabase() {
  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl!, supabaseServiceRoleKey);
}

// Database type definitions
export interface Structure {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  type?: 'RESTAURANT' | 'HOTEL' | 'MIXTE';
  modules?: string[];
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  structure_id?: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CAISSE' | 'SERVEUR' | 'CLIENT';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserStructure {
  id: string;
  user_id: string;
  structure_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  structure_id: string;
  number: string;
  type?: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING';
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  room_id: string;
  client_id?: string;
  check_in?: string;
  check_out?: string;
  phone?: string;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  structure_id: string;
  license_key?: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  max_users: number;
  max_tables: number;
  features: Record<string, unknown>;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  structure_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  is_available: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Accompaniment {
  id: string;
  structure_id: string;
  name: string;
  price: number;
  is_available: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  structure_id: string;
  user_id?: string;
  client_id?: string;
  room_id?: string;
  phone?: string;
  source?: 'CAISSE' | 'CLIENT';
  table_number?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  subtotal: number;
  total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  // True si le prix de cette ligne doit contribuer au `orders.total/subtotal`.
  // Exemple: accompagnement dont le prix est optionnel / inclus dans le prix du produit.
  is_price_counted?: boolean;
  // Si cet order_item provient d'un accompagnement ajouté automatiquement,
  // ce champ pointe vers l'order_item parent (le produit principal).
  parent_order_item_id?: string | null;
  notes?: string;
  created_at: string;
}

export interface OrderAccompaniment {
  id: string;
  order_id: string;
  parent_order_item_id: string;
  accompaniment_id: string;
  quantity: number;
  unit_price_snapshot: number;
  total_price_snapshot: number;
  is_price_counted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: 'CASH' | 'CARD' | 'CHEQUE' | 'TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  reference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
