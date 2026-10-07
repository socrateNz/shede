'use server';

import { revalidatePath } from 'next/cache';
import { getSession, type SessionPayload } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { getActiveDeliveryZones, type DeliveryStatus } from '@/lib/delivery';
import { te } from '@/lib/i18n/server';
import { emitWebhook, syncOrderWebhook } from '@/lib/api/webhooks';

// ─────────────────────────────────────────────────────────
// Livraison : zones (ADMIN / MANAGER) et suivi des courses
// (ADMIN / MANAGER / LIVREUR). Tout est scopé par le point connecté.
// ─────────────────────────────────────────────────────────

type ActionState = { success: boolean; error: string };

const MANAGER_ROLES = ['ADMIN', 'MANAGER'];
const BOARD_ROLES = ['ADMIN', 'MANAGER', 'LIVREUR'];

async function requirePointRole(roles: string[]): Promise<(SessionPayload & { structureId: string }) | null> {
  const session = await getSession();
  if (!session?.structureId || !roles.includes(session.role)) return null;
  if (!session.modules?.includes('LIVRAISON')) return null;
  return session as SessionPayload & { structureId: string };
}

async function parseZoneForm(formData: FormData): Promise<{ name: string; fee: number } | { error: string }> {
  const name = String(formData.get('name') || '').trim();
  const fee = Number(formData.get('fee'));
  if (!name) return { error: await te('errors.zoneNameRequired') };
  if (!Number.isFinite(fee) || fee < 0) return { error: await te('errors.invalidFee') };
  return { name: name.slice(0, 120), fee: Math.round(fee) };
}

// ── Zones ────────────────────────────────────────────────

/** Zones actives d'un point, pour le panier client (lecture publique). */
export async function getDeliveryOptions(structureId: string) {
  const admin = getAdminSupabase();
  const { data: structure } = await admin
    .from('structures')
    .select('modules')
    .eq('id', structureId)
    .maybeSingle();
  if (!(structure?.modules as string[] | null)?.includes('LIVRAISON')) return { available: false, zones: [] };
  const zones = await getActiveDeliveryZones(structureId);
  return { available: zones.length > 0, zones };
}

export async function listDeliveryZones() {
  const session = await requirePointRole(MANAGER_ROLES);
  if (!session) return [];
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('delivery_zones')
    .select('id, name, fee, is_active')
    .eq('structure_id', session.structureId)
    .order('name', { ascending: true });
  return (data || []).map((z) => ({ ...z, fee: Number(z.fee) || 0 }));
}

export async function createDeliveryZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePointRole(MANAGER_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const zone = await parseZoneForm(formData);
  if ('error' in zone) return { success: false, error: zone.error };

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('delivery_zones')
    .insert({ structure_id: session.structureId, name: zone.name, fee: zone.fee });
  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? await te('errors.zoneExists') : await te('errors.zoneCreateFailed'),
    };
  }

  revalidatePath('/delivery', 'layout');
  void emitWebhook(session.structureId, 'delivery_zones.updated', {});
  return { success: true, error: '' };
}

export async function updateDeliveryZone(zoneId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePointRole(MANAGER_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const zone = await parseZoneForm(formData);
  if ('error' in zone) return { success: false, error: zone.error };

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('delivery_zones')
    .update({ name: zone.name, fee: zone.fee })
    .eq('id', zoneId)
    .eq('structure_id', session.structureId);
  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? await te('errors.zoneExists') : await te('errors.zoneUpdateFailed'),
    };
  }

  revalidatePath('/delivery', 'layout');
  void emitWebhook(session.structureId, 'delivery_zones.updated', {});
  return { success: true, error: '' };
}

export async function setDeliveryZoneActive(zoneId: string, isActive: boolean) {
  const session = await requirePointRole(MANAGER_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const admin = getAdminSupabase();
  await admin
    .from('delivery_zones')
    .update({ is_active: isActive })
    .eq('id', zoneId)
    .eq('structure_id', session.structureId);

  revalidatePath('/delivery', 'layout');
  void emitWebhook(session.structureId, 'delivery_zones.updated', {});
  return { success: true, error: '' };
}

// ── Courses ──────────────────────────────────────────────

export async function getDeliveryBoard() {
  const session = await requirePointRole(BOARD_ROLES);
  if (!session) return null;

  const admin = getAdminSupabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ data: active }, { data: done }, { data: couriers }] = await Promise.all([
    admin
      .from('orders')
      .select('*, courier:users!courier_id(first_name, last_name), order_items(quantity, products(name))')
      .eq('structure_id', session.structureId)
      .eq('consumption_type', 'DELIVERY')
      .in('delivery_status', ['TO_ASSIGN', 'ASSIGNED', 'IN_TRANSIT'])
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: true }),
    admin
      .from('orders')
      .select('*, courier:users!courier_id(first_name, last_name)')
      .eq('structure_id', session.structureId)
      .eq('consumption_type', 'DELIVERY')
      .in('delivery_status', ['DELIVERED', 'FAILED'])
      .gte('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false }),
    admin
      .from('users')
      .select('id, first_name, last_name')
      .eq('structure_id', session.structureId)
      .eq('role', 'LIVREUR')
      .eq('is_active', true)
      .order('first_name', { ascending: true }),
  ]);

  // Le livreur voit les courses à prendre et les siennes.
  const isCourier = session.role === 'LIVREUR';
  const visible = (active || []).filter(
    (o) => !isCourier || o.delivery_status === 'TO_ASSIGN' || o.courier_id === session.userId
  );

  return {
    role: session.role,
    userId: session.userId,
    active: visible,
    done: (done || []).filter((o) => !isCourier || o.courier_id === session.userId),
    couriers: couriers || [],
  };
}

export async function assignCourier(orderId: string, courierId: string | null) {
  const session = await requirePointRole(BOARD_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  // Un livreur ne peut que prendre une course libre pour lui-même.
  if (session.role === 'LIVREUR' && courierId !== session.userId) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  const admin = getAdminSupabase();
  if (courierId) {
    const { data: courier } = await admin
      .from('users')
      .select('id')
      .eq('id', courierId)
      .eq('structure_id', session.structureId)
      .eq('role', 'LIVREUR')
      .eq('is_active', true)
      .maybeSingle();
    if (!courier) return { success: false, error: await te('errors.courierNotFound') };
  }

  let query = admin
    .from('orders')
    .update({ courier_id: courierId, delivery_status: courierId ? 'ASSIGNED' : 'TO_ASSIGN' })
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .eq('consumption_type', 'DELIVERY')
    .in('delivery_status', ['TO_ASSIGN', 'ASSIGNED']);
  if (session.role === 'LIVREUR') query = query.eq('delivery_status', 'TO_ASSIGN');

  const { data, error } = await query.select('id');
  if (error) return { success: false, error: await te('errors.assignFailed') };
  if (!data?.length) return { success: false, error: await te('errors.deliveryTaken') };

  revalidatePath('/delivery');
  return { success: true, error: '' };
}

const NEXT_STATUSES: Record<string, DeliveryStatus[]> = {
  ASSIGNED: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
};

export async function updateDeliveryStatus(orderId: string, status: DeliveryStatus, note?: string) {
  const session = await requirePointRole(BOARD_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const admin = getAdminSupabase();
  const { data: order } = await admin
    .from('orders')
    .select('id, delivery_status, courier_id, source, status, external_id, partner')
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .eq('consumption_type', 'DELIVERY')
    .maybeSingle();
  if (!order) return { success: false, error: await te('errors.deliveryNotFound') };

  if (session.role === 'LIVREUR' && order.courier_id !== session.userId) {
    return { success: false, error: await te('errors.notYourDelivery') };
  }
  if (!NEXT_STATUSES[order.delivery_status]?.includes(status)) {
    return { success: false, error: await te('errors.statusChangeImpossible') };
  }
  const cleanNote = String(note ?? '').trim();
  if (status === 'FAILED' && !cleanNote) {
    return { success: false, error: await te('errors.failReasonRequired') };
  }

  const { error } = await admin
    .from('orders')
    .update({
      delivery_status: status,
      delivery_note: cleanNote || null,
      ...(status === 'DELIVERED' ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq('id', orderId)
    .eq('delivery_status', order.delivery_status);
  if (error) return { success: false, error: await te('errors.deliveryUpdateFailed') };

  if (order.source === 'API') {
    // Commande marketplace livrée par le restaurant : la marketplace a encaissé
    // le client, la vente est clôturée à la livraison (paiement, facture, stock).
    if (status === 'DELIVERED' && order.status !== 'COMPLETED') {
      const { completeMarketplaceSale } = await import('@/lib/api/orders');
      await completeMarketplaceSale(order);
    }
    await syncOrderWebhook(orderId);
  }

  revalidatePath('/delivery');
  return { success: true, error: '' };
}
