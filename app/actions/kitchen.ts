'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

const KITCHEN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CUISINIER'] as const;

export interface KitchenOrder {
  id: string;
  table_number: number | null;
  room_id: string | null;
  phone: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY';
  notes: string | null;
  created_at: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    notes: string | null;
  }>;
}

/**
 * Récupère les commandes actives pour la cuisine.
 * Statuts : PENDING, IN_PROGRESS (pas READY ni COMPLETED).
 */
export async function getKitchenOrders(structureId: string): Promise<KitchenOrder[]> {
  const session = await getSession();
  if (!session || !KITCHEN_ROLES.includes(session.role as any)) return [];

  const admin = getAdminSupabase();

  const { data: orders, error } = await admin
    .from('orders')
    .select(`
      id,
      table_number,
      room_id,
      phone,
      status,
      notes,
      created_at,
      order_items(
        id,
        quantity,
        notes,
        products(name, destination)
      )
    `)
    .eq('structure_id', structureId)
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Kitchen] getKitchenOrders error:', error);
    return [];
  }

  return (orders || []).map((o: any) => ({
    id: o.id,
    table_number: o.table_number,
    room_id: o.room_id,
    phone: o.phone,
    status: o.status,
    notes: o.notes,
    created_at: o.created_at,
    items: (o.order_items || [])
      .filter((item: any) => item.products?.destination === 'CUISINE')
      .map((item: any) => ({
        id: item.id,
        product_name: item.products?.name ?? 'Produit inconnu',
        quantity: item.quantity,
        notes: item.notes ?? null,
      })),
  })).filter((o) => o.items.length > 0);
}

/**
 * Met à jour le statut d'une commande depuis la cuisine.
 * PENDING → IN_PROGRESS → READY
 */
export async function updateOrderStatusFromKitchen(
  orderId: string,
  newStatus: 'IN_PROGRESS' | 'READY'
) {
  const session = await getSession();
  if (!session || !KITCHEN_ROLES.includes(session.role as any)) {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminSupabase();

  // Vérifier que la commande appartient à la structure
  const { data: order, error: fetchError } = await admin
    .from('orders')
    .select('id, status, structure_id')
    .eq('id', orderId)
    .eq('structure_id', session.structureId!)
    .single();

  if (fetchError || !order) {
    return { success: false, error: 'Commande introuvable' };
  }

  // Transitions autorisées
  const allowedTransitions: Record<string, string[]> = {
    PENDING:     ['IN_PROGRESS'],
    IN_PROGRESS: ['READY'],
  };

  if (!allowedTransitions[order.status]?.includes(newStatus)) {
    return { success: false, error: `Transition ${order.status} → ${newStatus} non autorisée` };
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('structure_id', session.structureId!);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/kitchen');
  return { success: true };
}

/**
 * Données pour le display Bar.
 * Filtre les items contenant des produits de catégorie BAR/BOISSON.
 */
export async function getBarOrders(structureId: string): Promise<KitchenOrder[]> {
  const session = await getSession();
  if (!session) return [];

  const admin = getAdminSupabase();

  const { data: orders } = await admin
    .from('orders')
    .select(`
      id,
      table_number,
      room_id,
      phone,
      status,
      notes,
      created_at,
      order_items(
        id,
        quantity,
        notes,
        products(name, category, destination)
      )
    `)
    .eq('structure_id', structureId)
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .order('created_at', { ascending: true });

  return (orders || [])
    .map((o: any) => ({
      id: o.id,
      table_number: o.table_number,
      room_id: o.room_id,
      phone: o.phone,
      status: o.status,
      notes: o.notes,
      created_at: o.created_at,
      items: (o.order_items || [])
        .filter((item: any) => {
          if (item.products?.destination) {
            return item.products.destination === 'BAR';
          }
          // Fallback if destination is not yet fully populated
          const cat = (item.products?.category || '').toUpperCase();
          return cat.includes('BAR') || cat.includes('BOISSON') || cat.includes('DRINK');
        })
        .map((item: any) => ({
          id: item.id,
          product_name: item.products?.name ?? 'Produit inconnu',
          quantity: item.quantity,
          notes: item.notes ?? null,
        })),
    }))
    .filter((o) => o.items.length > 0);
}
