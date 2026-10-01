'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { API_MODULE } from '@/lib/api/keys';
import { emitWebhook, syncOrderWebhook } from '@/lib/api/webhooks';

// Côté restaurant : commandes reçues des marketplaces (docs/phase13-api.sql).

const DECISION_ROLES = ['ADMIN', 'MANAGER', 'CAISSE'];

type Result = { success: true } | { success: false; error: string };

async function requirePointStaff(roles: string[]) {
  const session = await getSession();
  if (!session?.structureId || !roles.includes(session.role)) return null;
  if (!session.modules?.includes(API_MODULE)) return null;
  return session as typeof session & { structureId: string };
}

export type MarketplaceInboxOrder = {
  id: string;
  externalId: string | null;
  partner: string | null;
  customerName: string | null;
  phone: string | null;
  total: number;
  createdAt: string;
  items: { name: string; quantity: number }[];
};

/** Commandes marketplace à accepter et état de la pause, pour la page Commandes. */
export async function getMarketplaceInbox() {
  const session = await requirePointStaff([...DECISION_ROLES, 'SERVEUR']);
  if (!session) return null;
  const admin = getAdminSupabase();
  const [{ data: structure }, { data: orders, error }] = await Promise.all([
    admin.from('structures').select('*').eq('id', session.structureId).maybeSingle(),
    admin
      .from('orders')
      .select('id, external_id, partner, customer_name, phone, total, created_at, order_items(quantity, parent_order_item_id, products(name))')
      .eq('structure_id', session.structureId)
      .eq('source', 'API')
      .eq('acceptance', 'PENDING')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: true }),
  ]);
  if (error) return null; // migration phase 13 pas encore exécutée

  return {
    paused: Boolean(structure?.api_paused),
    canDecide: DECISION_ROLES.includes(session.role),
    orders: (orders || []).map(
      (o: any): MarketplaceInboxOrder => ({
        id: o.id,
        externalId: o.external_id,
        partner: o.partner,
        customerName: o.customer_name,
        phone: o.phone,
        total: Number(o.total) || 0,
        createdAt: o.created_at,
        items: (o.order_items || [])
          .filter((i: any) => !i.parent_order_item_id)
          .map((i: any) => ({ name: i.products?.name ?? '?', quantity: Number(i.quantity) })),
      })
    ),
  };
}

async function loadPendingOrder(structureId: string, orderId: string) {
  const { data } = await getAdminSupabase()
    .from('orders')
    .select('id, acceptance, status')
    .eq('id', orderId)
    .eq('structure_id', structureId)
    .eq('source', 'API')
    .maybeSingle();
  return data && data.acceptance === 'PENDING' && data.status !== 'CANCELLED' ? data : null;
}

/** Accepte la commande : elle part en cuisine / au bar avec le temps de préparation annoncé. */
export async function acceptMarketplaceOrder(orderId: string, prepMinutes: number): Promise<Result> {
  const session = await requirePointStaff(DECISION_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const minutes = Math.round(Number(prepMinutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    return { success: false, error: await te('marketplace.errors.invalidPrepTime') };
  }
  if (!(await loadPendingOrder(session.structureId, orderId))) {
    return { success: false, error: await te('marketplace.errors.notPending') };
  }
  const { error } = await getAdminSupabase()
    .from('orders')
    .update({
      acceptance: 'ACCEPTED',
      accepted_at: new Date().toISOString(),
      prep_minutes: minutes,
      kitchen_status: 'PENDING',
      bar_status: 'PENDING',
      user_id: session.userId,
    })
    .eq('id', orderId)
    .eq('acceptance', 'PENDING');
  if (error) return { success: false, error: await te('errors.orderUpdateFailed') };
  await syncOrderWebhook(orderId);
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

/** Refuse la commande (rupture, fermeture…) : elle est annulée, rien n'est comptabilisé. */
export async function rejectMarketplaceOrder(orderId: string, reason: string): Promise<Result> {
  const session = await requirePointStaff(DECISION_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) return { success: false, error: await te('marketplace.errors.reasonRequired') };
  if (!(await loadPendingOrder(session.structureId, orderId))) {
    return { success: false, error: await te('marketplace.errors.notPending') };
  }
  const { error } = await getAdminSupabase()
    .from('orders')
    .update({
      acceptance: 'REJECTED',
      status: 'CANCELLED',
      rejection_reason: cleanReason.slice(0, 300),
      kitchen_status: 'CANCELLED',
      bar_status: 'CANCELLED',
      user_id: session.userId,
    })
    .eq('id', orderId)
    .eq('acceptance', 'PENDING');
  if (error) return { success: false, error: await te('errors.orderUpdateFailed') };
  await syncOrderWebhook(orderId);
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

/** Met en pause (ou relance) la réception des commandes marketplace du point. */
export async function setMarketplacePaused(paused: boolean): Promise<Result> {
  const session = await requirePointStaff(DECISION_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { error } = await getAdminSupabase()
    .from('structures')
    .update({ api_paused: paused })
    .eq('id', session.structureId);
  if (error) return { success: false, error: await te('errors.unexpected') };
  await emitWebhook(session.structureId, paused ? 'point.paused' : 'point.resumed', { paused });
  revalidatePath('/orders');
  return { success: true };
}
