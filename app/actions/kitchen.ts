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
      kitchen_status,
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
    .in('kitchen_status', ['PENDING', 'IN_PROGRESS'])
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
    status: o.kitchen_status || 'PENDING',
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
    .select('id, kitchen_status, bar_status, order_items(products(destination))')
    .eq('id', orderId)
    .eq('structure_id', session.structureId!)
    .single();

  if (fetchError || !order) {
    return { success: false, error: 'Commande introuvable' };
  }

  const currentStatus = order.kitchen_status || 'PENDING';
  const allowedTransitions: Record<string, string[]> = {
    PENDING:     ['IN_PROGRESS', 'READY'],
    IN_PROGRESS: ['READY'],
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    return { success: false, error: `Transition ${currentStatus} → ${newStatus} non autorisée` };
  }

  // Update kitchen_status
  const { error: updateError } = await admin
    .from('orders')
    .update({ kitchen_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('structure_id', session.structureId!);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Calculate if global status should be updated
  const hasBarItems = order.order_items?.some((i: any) => 
    i.products?.destination === 'BAR' || i.products?.destination === 'BOISSON'
  );
  
  const barReady = !hasBarItems || order.bar_status === 'READY';
  
  if (newStatus === 'READY' && barReady) {
    await admin.from('orders').update({ status: 'READY' }).eq('id', orderId);
  } else if (newStatus === 'IN_PROGRESS') {
    // If kitchen starts working, global status is at least IN_PROGRESS
    await admin.from('orders').update({ status: 'IN_PROGRESS' }).eq('id', orderId);
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
      bar_status,
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
    .in('bar_status', ['PENDING', 'IN_PROGRESS'])
    .order('created_at', { ascending: true });

  return (orders || [])
    .map((o: any) => ({
      id: o.id,
      table_number: o.table_number,
      room_id: o.room_id,
      phone: o.phone,
      status: o.bar_status || 'PENDING',
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

/**
 * Met à jour le statut d'une commande depuis le bar.
 */
export async function updateOrderStatusFromBar(
  orderId: string,
  newStatus: 'IN_PROGRESS' | 'READY'
) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminSupabase();

  const { data: order, error: fetchError } = await admin
    .from('orders')
    .select('id, kitchen_status, bar_status, order_items(products(destination))')
    .eq('id', orderId)
    .eq('structure_id', session.structureId!)
    .single();

  if (fetchError || !order) {
    return { success: false, error: 'Commande introuvable' };
  }

  const currentStatus = order.bar_status || 'PENDING';
  const allowedTransitions: Record<string, string[]> = {
    PENDING:     ['IN_PROGRESS', 'READY'],
    IN_PROGRESS: ['READY'],
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    return { success: false, error: `Transition ${currentStatus} → ${newStatus} non autorisée` };
  }

  // Update bar_status
  const { error: updateError } = await admin
    .from('orders')
    .update({ bar_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('structure_id', session.structureId!);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Calculate if global status should be updated
  const hasKitchenItems = order.order_items?.some((i: any) => 
    i.products?.destination === 'CUISINE'
  );
  
  const kitchenReady = !hasKitchenItems || order.kitchen_status === 'READY';
  
  if (newStatus === 'READY' && kitchenReady) {
    await admin.from('orders').update({ status: 'READY' }).eq('id', orderId);
  } else if (newStatus === 'IN_PROGRESS') {
    await admin.from('orders').update({ status: 'IN_PROGRESS' }).eq('id', orderId);
  }

  revalidatePath('/bar');
  return { success: true };
}
