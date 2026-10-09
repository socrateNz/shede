'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { te } from '@/lib/i18n/server';
import { syncOrderWebhook } from '@/lib/api/webhooks';
import { notifyUser } from '@/lib/notifications';
import { notifyStructureStaff } from '@/lib/notifications';

const KITCHEN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CUISINIER'] as const;

export interface KitchenOrder {
  id: string;
  table_number: number | null;
  room_id: string | null;
  phone: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY';
  notes: string | null;
  created_at: string;
  /** Où servir : table (nom + salle), chambre, livraison ou à emporter. */
  place: { kind: 'TABLE' | 'ROOM' | 'DELIVERY' | 'TAKEAWAY'; label: string | null; floor: string | null };
  covers: number | null;
  waiter: string | null;
  customer: string | null;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    notes: string | null;
    accompaniments: Array<{ name: string; quantity: number }>;
    /** Envoyé après la commande (suite d'un envoi en deux temps ou ajout). */
    late: boolean;
  }>;
}

// Tout ce qu'il faut à la cuisine et au bar pour préparer et servir sans aller voir la caisse.
const DISPLAY_SELECT = `
  id, table_number, room_id, phone, status, kitchen_status, bar_status, notes, created_at,
  consumption_type, covers, customer_name,
  tables(name, floor_name), rooms(number), waiter:users!user_id(first_name, last_name, role),
  order_items(
    id, quantity, notes, held, fired_at, parent_order_item_id,
    products(name, category, destination),
    order_accompaniments(quantity, accompaniments(name))
  )
`;

function toDisplayOrder(o: any, status: string, keep: (item: any) => boolean, unknownProduct: string): KitchenOrder {
  const place: KitchenOrder['place'] = o.tables?.name
    ? { kind: 'TABLE', label: o.tables.name, floor: o.tables.floor_name ?? null }
    : o.table_number
    ? { kind: 'TABLE', label: String(o.table_number), floor: null }
    : o.rooms?.number || o.room_id
    ? { kind: 'ROOM', label: o.rooms?.number ?? null, floor: null }
    : o.consumption_type === 'DELIVERY'
    ? { kind: 'DELIVERY', label: null, floor: null }
    : { kind: 'TAKEAWAY', label: null, floor: null };
  const waiter = o.waiter ? [o.waiter.first_name, o.waiter.last_name].filter(Boolean).join(' ') : '';
  const created = new Date(o.created_at).getTime();
  return {
    id: o.id,
    table_number: o.table_number,
    room_id: o.room_id,
    phone: o.phone,
    status: (status || 'PENDING') as KitchenOrder['status'],
    notes: o.notes,
    created_at: o.created_at,
    place,
    covers: Number(o.covers) || null,
    waiter: waiter || null,
    customer: o.customer_name || null,
    items: (o.order_items || [])
      // Plats en attente (envoi en deux temps) : pas encore partis en cuisine / au bar
      .filter((item: any) => !item.held && !item.parent_order_item_id && keep(item))
      .sort((a: any, b: any) => String(a.fired_at ?? '').localeCompare(String(b.fired_at ?? '')))
      .map((item: any) => ({
        id: item.id,
        product_name: item.products?.name ?? unknownProduct,
        quantity: item.quantity,
        notes: item.notes ?? null,
        accompaniments: (item.order_accompaniments || []).map((a: any) => ({
          name: a.accompaniments?.name ?? unknownProduct,
          quantity: Number(a.quantity) || 1,
        })),
        late: Boolean(item.fired_at) && new Date(item.fired_at).getTime() - created > 60_000,
      })),
  };
}

/**
 * Récupère les commandes actives pour la cuisine.
 * Statuts : PENDING, IN_PROGRESS (pas READY ni COMPLETED).
 */
export async function getKitchenOrders(structureId: string): Promise<KitchenOrder[]> {
  const session = await getSession();
  if (!session || !KITCHEN_ROLES.includes(session.role as any)) return [];
  // Toujours le point de l'utilisateur connecté, jamais celui envoyé par le navigateur.
  if (session.role !== 'SUPER_ADMIN' && session.structureId !== structureId) return [];

  const admin = getAdminSupabase();
  const unknownProduct = await te('errors.unknownProduct');

  const { data: orders, error } = await admin
    .from('orders')
    .select(DISPLAY_SELECT)
    .eq('structure_id', structureId)
    // kitchen_status vaut NULL tant que la cuisine n'a pas commencé (aucune valeur par
    // défaut en base) ; ON_HOLD = commande marketplace pas encore acceptée.
    .or('kitchen_status.is.null,kitchen_status.in.(PENDING,IN_PROGRESS)')
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Kitchen] getKitchenOrders error:', error);
    return [];
  }

  return (orders || [])
    .map((o: any) => toDisplayOrder(o, o.kitchen_status, (item) => item.products?.destination === 'CUISINE', unknownProduct))
    .filter((o) => o.items.length > 0);
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
    return { success: false, error: await te('errors.unauthorized') };
  }

  const admin = getAdminSupabase();

  // Vérifier que la commande appartient à la structure
  const { data: order, error: fetchError } = await admin
    .from('orders')
    .select('id, kitchen_status, bar_status, order_items(held, products(destination))')
    .eq('id', orderId)
    .eq('structure_id', session.structureId!)
    .single();

  if (fetchError || !order) {
    return { success: false, error: await te('errors.orderNotFound') };
  }

  const currentStatus = order.kitchen_status || 'PENDING';
  const allowedTransitions: Record<string, string[]> = {
    PENDING:     ['IN_PROGRESS', 'READY'],
    IN_PROGRESS: ['READY'],
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    return { success: false, error: await te('errors.invalidTransition', { from: currentStatus, to: newStatus }) };
  }

  // Update kitchen_status
  const { error: updateError } = await admin
    .from('orders')
    .update({ kitchen_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('structure_id', session.structureId!);

  if (updateError) {
    console.error('[kitchen] status update:', updateError.message);
    return { success: false, error: await te('errors.statusUpdateFailed') };
  }

  // Calculate if global status should be updated
  const hasBarItems = order.order_items?.some((i: any) =>
    !i.held && (i.products?.destination === 'BAR' || i.products?.destination === 'BOISSON')
  );
  
  const barReady = !hasBarItems || order.bar_status === 'READY';
  
  if (newStatus === 'READY' && barReady) {
    await admin.from('orders').update({ status: 'READY' }).eq('id', orderId);
    await notifyOrderReady(orderId, session.structureId!);
  } else if (newStatus === 'IN_PROGRESS') {
    // If kitchen starts working, global status is at least IN_PROGRESS
    await admin.from('orders').update({ status: 'IN_PROGRESS' }).eq('id', orderId);
  }

  await syncOrderWebhook(orderId); // commande marketplace : « en préparation » / « prête »
  revalidatePath('/kitchen');
  return { success: true };
}

/**
 * Données pour le display Bar.
 * Filtre les items contenant des produits de catégorie BAR/BOISSON.
 */
export async function getBarOrders(structureId: string): Promise<KitchenOrder[]> {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BAR'].includes(session.role)) return [];
  if (session.role !== 'SUPER_ADMIN' && session.structureId !== structureId) return [];

  const admin = getAdminSupabase();
  const unknownProduct = await te('errors.unknownProduct');

  const { data: orders } = await admin
    .from('orders')
    .select(DISPLAY_SELECT)
    .eq('structure_id', structureId)
    .or('bar_status.is.null,bar_status.in.(PENDING,IN_PROGRESS)')
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .order('created_at', { ascending: true });

  return (orders || [])
    .map((o: any) =>
      toDisplayOrder(o, o.bar_status, (item) => {
        if (item.products?.destination) return item.products.destination === 'BAR';
        // Destination pas encore renseignée : on se fie à la catégorie
        const cat = (item.products?.category || '').toUpperCase();
        return cat.includes('BAR') || cat.includes('BOISSON') || cat.includes('DRINK');
      }, unknownProduct),
    )
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
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BAR'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  const admin = getAdminSupabase();

  const { data: order, error: fetchError } = await admin
    .from('orders')
    .select('id, kitchen_status, bar_status, order_items(held, products(destination))')
    .eq('id', orderId)
    .eq('structure_id', session.structureId!)
    .single();

  if (fetchError || !order) {
    return { success: false, error: await te('errors.orderNotFound') };
  }

  const currentStatus = order.bar_status || 'PENDING';
  const allowedTransitions: Record<string, string[]> = {
    PENDING:     ['IN_PROGRESS', 'READY'],
    IN_PROGRESS: ['READY'],
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    return { success: false, error: await te('errors.invalidTransition', { from: currentStatus, to: newStatus }) };
  }

  // Update bar_status
  const { error: updateError } = await admin
    .from('orders')
    .update({ bar_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('structure_id', session.structureId!);

  if (updateError) {
    console.error('[kitchen] status update:', updateError.message);
    return { success: false, error: await te('errors.statusUpdateFailed') };
  }

  // Calculate if global status should be updated
  const hasKitchenItems = order.order_items?.some((i: any) =>
    !i.held && i.products?.destination === 'CUISINE'
  );
  
  const kitchenReady = !hasKitchenItems || order.kitchen_status === 'READY';
  
  if (newStatus === 'READY' && kitchenReady) {
    await admin.from('orders').update({ status: 'READY' }).eq('id', orderId);
    await notifyOrderReady(orderId, session.structureId!);
  } else if (newStatus === 'IN_PROGRESS') {
    await admin.from('orders').update({ status: 'IN_PROGRESS' }).eq('id', orderId);
  }

  await syncOrderWebhook(orderId);
  revalidatePath('/bar');
  return { success: true };
}

/**
 * Commande entièrement prête. Prévenu : le serveur qui l'a prise (sur son téléphone) ;
 * pour une livraison, les livreurs et le responsable ; sinon la caisse (à emporter, caisse).
 */
async function notifyOrderReady(orderId: string, structureId: string) {
  const { data: order } = await getAdminSupabase()
    .from('orders')
    .select('user_id, table_number, consumption_type, customer_name, tables(name), users!user_id(role)')
    .eq('id', orderId)
    .single();
  if (!order) return;
  const taker = order.users as { role?: string } | null;
  const table = (order.tables as { name?: string } | null)?.name ?? (order.table_number ? String(order.table_number) : null);
  const ref = orderId.slice(0, 8);

  if (order.user_id && taker?.role === 'SERVEUR') {
    await notifyUser({
      userId: order.user_id,
      structureId,
      message: ({ t }) => ({
        title: t('notify.orderReady.title'),
        body: t('notify.orderReady.body', { table: table ?? '—' }),
      }),
      url: '/serveur',
    });
    return;
  }
  if (order.consumption_type === 'DELIVERY') {
    await notifyStructureStaff({
      structureId,
      roles: ['LIVREUR', 'MANAGER', 'ADMIN'],
      message: ({ t }) => ({
        title: t('notify.deliveryReady.title'),
        body: t('notify.deliveryReady.body', { ref, name: order.customer_name || '—' }),
      }),
      url: '/delivery',
    });
    return;
  }
  await notifyStructureStaff({
    structureId,
    roles: ['CAISSE', 'ADMIN'],
    message: ({ t }) => ({
      title: t('notify.counterReady.title'),
      body: table ? t('notify.counterReady.bodyTable', { table, ref }) : t('notify.counterReady.body', { ref }),
    }),
    url: `/orders/${orderId}`,
  });
}
