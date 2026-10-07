import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { normalizeCameroonPhone } from '@/lib/phone';
import { assignInvoiceNumber } from '@/lib/fiscal';
import { deductOrderStock } from '@/lib/stock';
import { postSaleSafely } from '@/lib/accounting/posting';
import { notifyStructureStaff } from '@/lib/notifications';
import { recomputeOrderTotal } from '@/lib/order-totals';
import { syncOrderWebhook } from '@/lib/api/webhooks';

// Commandes des marketplaces (source = 'API'). Module serveur appelé par les
// routes /api/v1 : les prix, la disponibilité et les accompagnements sont
// toujours relus en base, jamais pris dans la requête.

// ── Schémas d'entrée ─────────────────────────────────────

export const createOrderSchema = z.object({
  external_id: z.string().trim().min(1).max(100),
  partner: z.string().trim().max(50).optional(),
  customer: z.object({
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().min(6).max(30),
  }),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        notes: z.string().trim().max(300).optional(),
        accompaniments: z
          .array(z.object({ id: z.string().uuid(), quantity: z.number().int().min(1).max(20).optional() }))
          .max(20)
          .optional(),
      })
    )
    .min(1)
    .max(50),
  notes: z.string().trim().max(500).optional(),
  delivery_address: z.string().trim().max(300).optional(),
  /** Qui livre : le livreur de la marketplace (par défaut) ou un livreur du restaurant. */
  delivery_by: z.enum(['marketplace', 'restaurant']).default('marketplace'),
  /** Obligatoire si delivery_by = restaurant : zone de GET /delivery-zones et point de repère. */
  delivery: z
    .object({
      zone_id: z.string().uuid(),
      landmark: z.string().trim().min(3).max(500),
      district: z.string().trim().max(120).optional(),
      city: z.string().trim().max(100).optional(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    })
    .optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const cancelOrderSchema = z.object({ reason: z.string().trim().max(300).optional() });

export const COURIER_STATUSES = ['ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED'] as const;
export const courierEventSchema = z.object({
  status: z.enum(COURIER_STATUSES),
  courier_name: z.string().trim().max(120).optional(),
  courier_phone: z.string().trim().max(30).optional(),
  reason: z.string().trim().max(300).optional(),
});

/** Erreurs de validation au format { champ: code } pour la réponse 422. */
export function zodDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), code: issue.code, message: issue.message }));
}

// ── Lecture et représentation ────────────────────────────

const ORDER_SELECT =
  '*, order_items(id, product_id, quantity, unit_price, total_price, notes, parent_order_item_id, products(name)), ' +
  'order_accompaniments(id, parent_order_item_id, accompaniment_id, quantity, unit_price_snapshot, total_price_snapshot, accompaniments(name))';

export type ApiOrderStatus =
  | 'pending_acceptance'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'delivery_failed'
  | 'rejected'
  | 'cancelled';

/** Statut vu par la marketplace, déduit des colonnes de la commande. */
export function apiOrderStatus(order: Record<string, any>): ApiOrderStatus {
  if (order.acceptance === 'REJECTED') return 'rejected';
  if (order.status === 'CANCELLED') return 'cancelled';
  if (order.acceptance === 'PENDING') return 'pending_acceptance';
  // Livreur de la marketplace (courier_status) ou du restaurant (delivery_status)
  if (order.courier_status === 'DELIVERED' || order.delivery_status === 'DELIVERED') return 'delivered';
  if (order.delivery_status === 'FAILED') return 'delivery_failed';
  if (order.courier_status === 'PICKED_UP' || order.delivery_status === 'IN_TRANSIT' || order.status === 'COMPLETED') {
    return 'picked_up';
  }
  if (order.status === 'READY' || order.status === 'SERVED') return 'ready';
  if (order.status === 'IN_PROGRESS') return 'preparing';
  return 'accepted';
}

export function serializeOrder(order: Record<string, any>) {
  const accompaniments = (order.order_accompaniments || []) as any[];
  const readyAt =
    order.accepted_at && order.prep_minutes
      ? new Date(new Date(order.accepted_at).getTime() + Number(order.prep_minutes) * 60_000).toISOString()
      : null;
  return {
    id: order.id as string,
    // false : commande simulée avec une clé de test (rien n'est enregistré).
    livemode: order.livemode ?? true,
    external_id: order.external_id ?? null,
    partner: order.partner ?? null,
    status: apiOrderStatus(order),
    created_at: order.created_at,
    updated_at: order.updated_at ?? order.created_at,
    accepted_at: order.accepted_at ?? null,
    prep_minutes: order.prep_minutes ?? null,
    estimated_ready_at: readyAt,
    rejection_reason: order.rejection_reason ?? null,
    cancel_reason: order.cancel_reason ?? null,
    invoice_number: order.invoice_number ?? null,
    customer: { name: order.customer_name ?? null, phone: order.phone ?? null },
    notes: order.notes ?? null,
    items: ((order.order_items || []) as any[])
      .filter((i) => !i.parent_order_item_id)
      .map((i) => ({
        id: i.id as string,
        product_id: i.product_id as string,
        name: i.products?.name ?? null,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
        notes: i.notes ?? null,
        accompaniments: accompaniments
          .filter((a) => a.parent_order_item_id === i.id)
          .map((a) => ({
            id: a.accompaniment_id as string,
            name: a.accompaniments?.name ?? null,
            quantity: Number(a.quantity),
            unit_price: Number(a.unit_price_snapshot),
            total_price: Number(a.total_price_snapshot),
          })),
      })),
    amounts: {
      currency: 'XAF',
      subtotal: Number(order.subtotal) || 0,
      discount: Number(order.discount_amount) || 0,
      tax: Number(order.tax) || 0,
      delivery_fee: Number(order.delivery_fee) || 0,
      total: Number(order.total) || 0,
    },
    delivery: serializeDelivery(order),
    courier: { status: order.courier_status ?? null, name: order.courier_name ?? null, phone: order.courier_phone ?? null },
  };
}

/** Livraison : par la marketplace, ou par un livreur du restaurant (zone, repère, suivi). */
function serializeDelivery(order: Record<string, any>) {
  if (order.consumption_type !== 'DELIVERY') return { by: 'marketplace' as const };
  return {
    by: 'restaurant' as const,
    zone: order.delivery_zone_id ? { id: order.delivery_zone_id as string, name: order.delivery_zone_name ?? null } : null,
    fee: Number(order.delivery_fee) || 0,
    city: order.delivery_city ?? null,
    district: order.delivery_district ?? null,
    landmark: order.delivery_landmark ?? null,
    lat: order.delivery_lat ?? null,
    lng: order.delivery_lng ?? null,
    // to_assign, assigned, in_transit, delivered, failed — null avant l'acceptation
    status: order.delivery_status ? String(order.delivery_status).toLowerCase() : null,
    note: order.delivery_note ?? null,
  };
}

/** Commande marketplace d'un point, par id Shede ou par numéro de la marketplace. */
export async function loadApiOrder(structureId: string, id: string) {
  const admin = getAdminSupabase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const query = admin.from('orders').select(ORDER_SELECT).eq('structure_id', structureId).eq('source', 'API');
  const { data } = await (isUuid ? query.eq('id', id) : query.eq('external_id', id)).maybeSingle();
  return data as Record<string, any> | null;
}

export const API_ORDER_STATUSES: ApiOrderStatus[] = [
  'pending_acceptance',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'delivery_failed',
  'rejected',
  'cancelled',
];

// Traduction de chaque statut API en filtre PostgREST : même logique que apiOrderStatus().
const LIVE = 'acceptance.eq.ACCEPTED,status.neq.CANCELLED';
const NOT_DONE =
  'or(courier_status.is.null,courier_status.neq.DELIVERED),or(delivery_status.is.null,delivery_status.not.in.(DELIVERED,FAILED))';
const NOT_PICKED =
  'or(courier_status.is.null,courier_status.not.in.(PICKED_UP,DELIVERED)),' +
  'or(delivery_status.is.null,delivery_status.not.in.(IN_TRANSIT,DELIVERED,FAILED))';
export const STATUS_FILTERS: Record<ApiOrderStatus, string> = {
  pending_acceptance: 'and(acceptance.eq.PENDING,status.neq.CANCELLED)',
  rejected: 'acceptance.eq.REJECTED',
  cancelled: 'and(status.eq.CANCELLED,acceptance.neq.REJECTED)',
  delivered: `and(${LIVE},or(courier_status.eq.DELIVERED,delivery_status.eq.DELIVERED))`,
  delivery_failed: `and(${LIVE},delivery_status.eq.FAILED,or(courier_status.is.null,courier_status.neq.DELIVERED))`,
  picked_up: `and(${LIVE},${NOT_DONE},or(courier_status.eq.PICKED_UP,delivery_status.eq.IN_TRANSIT,status.eq.COMPLETED))`,
  ready: `and(${LIVE},status.in.(READY,SERVED),${NOT_PICKED})`,
  preparing: `and(${LIVE},status.eq.IN_PROGRESS,${NOT_PICKED})`,
  accepted: `and(${LIVE},status.not.in.(COMPLETED,READY,SERVED,IN_PROGRESS),${NOT_PICKED})`,
};

export type ListOrdersOptions = {
  updatedSince?: string;
  createdFrom?: string;
  createdTo?: string;
  statuses?: ApiOrderStatus[];
  limit: number;
  offset?: number;
};

/**
 * Commandes marketplace du point. Avec updated_since : triées par date de
 * modification (resynchronisation) ; sinon par date de création (rapprochement).
 * Renvoie une ligne de plus que `limit` pour savoir s'il reste des résultats.
 */
export async function listApiOrders(structureId: string, options: ListOrdersOptions) {
  const offset = options.offset ?? 0;
  let query = getAdminSupabase()
    .from('orders')
    .select(ORDER_SELECT)
    .eq('structure_id', structureId)
    .eq('source', 'API')
    .order(options.updatedSince ? 'updated_at' : 'created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + options.limit);
  if (options.updatedSince) query = query.gt('updated_at', options.updatedSince);
  if (options.createdFrom) query = query.gte('created_at', options.createdFrom);
  if (options.createdTo) query = query.lt('created_at', options.createdTo);
  if (options.statuses?.length) query = query.or(options.statuses.map((s) => STATUS_FILTERS[s]).join(','));
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as Record<string, any>[];
  return { orders: rows.slice(0, options.limit), hasMore: rows.length > options.limit };
}

// ── Création ─────────────────────────────────────────────

export type CreateOrderResult =
  | { kind: 'created' | 'replayed'; order: Record<string, any> }
  | { kind: 'paused' | 'quota_exceeded' }
  | { kind: 'invalid'; details: { field: string; code: string }[] };

/**
 * Relit en base les produits et accompagnements demandés et vérifie qu'ils
 * peuvent être commandés. Partagé avec le mode test : mêmes règles qu'en production.
 */
export async function validateOrderItems(structureId: string, input: CreateOrderInput) {
  const productIds = [...new Set(input.items.map((i) => i.product_id))];
  const { data: products, error } = await getAdminSupabase()
    .from('products')
    // * : tolère l'absence de is_deliverable avant docs/phase15-categories.sql
    .select('*, product_accompaniments(accompaniment_id, quantity, accompaniments(id, name, price, is_available, is_deleted))')
    .eq('structure_id', structureId)
    .in('id', productIds);
  if (error) throw error;
  const productById = new Map((products || []).map((p: any) => [p.id as string, p]));

  const details: { field: string; code: string }[] = [];
  input.items.forEach((item, i) => {
    const product = productById.get(item.product_id);
    if (!product || product.is_deleted) return details.push({ field: `items.${i}.product_id`, code: 'product_not_found' });
    if (!product.is_available) details.push({ field: `items.${i}.product_id`, code: 'product_unavailable' });
    // Toute commande marketplace est livrée (par la marketplace ou le restaurant).
    else if (product.is_deliverable === false) details.push({ field: `items.${i}.product_id`, code: 'product_not_deliverable' });
    (item.accompaniments || []).forEach((acc, j) => {
      const mapping = (product.product_accompaniments || []).find((m: any) => m.accompaniment_id === acc.id);
      const field = `items.${i}.accompaniments.${j}`;
      if (!mapping || !mapping.accompaniments || mapping.accompaniments.is_deleted) {
        details.push({ field, code: 'accompaniment_not_offered' });
      } else if (!mapping.accompaniments.is_available) {
        details.push({ field, code: 'accompaniment_unavailable' });
      } else if ((acc.quantity ?? 1) > (Number(mapping.quantity) || 1)) {
        details.push({ field, code: 'accompaniment_quantity_exceeded' });
      }
    });
  });
  return { details, productById };
}

/**
 * Livraison par un livreur du restaurant : le point doit proposer la livraison
 * (module LIVRAISON) et la zone doit être active. Les frais viennent de la zone.
 */
export async function resolveApiDelivery(structure: Record<string, any>, input: CreateOrderInput) {
  const none = { details: [] as { field: string; code: string }[], fields: null };
  if (input.delivery_by !== 'restaurant') return none;
  if (!(structure.modules as string[] | null)?.includes('LIVRAISON')) {
    return { ...none, details: [{ field: 'delivery_by', code: 'restaurant_delivery_not_offered' }] };
  }
  if (!input.delivery) return { ...none, details: [{ field: 'delivery', code: 'required' }] };

  const { data: zone } = await getAdminSupabase()
    .from('delivery_zones')
    .select('id, name, fee, is_active')
    .eq('id', input.delivery.zone_id)
    .eq('structure_id', structure.id)
    .maybeSingle();
  if (!zone || !zone.is_active) return { ...none, details: [{ field: 'delivery.zone_id', code: 'delivery_zone_unavailable' }] };

  return {
    details: [],
    fields: {
      consumption_type: 'DELIVERY' as const,
      delivery_zone_id: zone.id as string,
      delivery_zone_name: zone.name as string,
      delivery_fee: Math.max(0, Math.round(Number(zone.fee) || 0)),
      delivery_city: input.delivery.city || structure.city || null,
      delivery_district: input.delivery.district || (zone.name as string),
      delivery_landmark: input.delivery.landmark,
      delivery_lat: input.delivery.lat ?? null,
      delivery_lng: input.delivery.lng ?? null,
    },
  };
}

export async function createApiOrder(structure: Record<string, any>, input: CreateOrderInput): Promise<CreateOrderResult> {
  const admin = getAdminSupabase();
  const structureId = structure.id as string;

  // Requête rejouée (même numéro de commande marketplace) : on renvoie l'existante.
  const existing = await loadApiOrder(structureId, input.external_id);
  if (existing) return { kind: 'replayed', order: existing };
  if (structure.api_paused) return { kind: 'paused' };

  // 1. Produits et accompagnements du point, relus en base
  const { details, productById } = await validateOrderItems(structureId, input);
  const delivery = await resolveApiDelivery(structure, input);
  details.push(...delivery.details);
  if (details.length) return { kind: 'invalid', details };

  // 2. Quota mensuel de l'organisation
  const { data: allowed, error: quotaError } = await admin.rpc('api_count_order', { p_structure_id: structureId });
  if (quotaError) throw quotaError;
  if (!allowed) return { kind: 'quota_exceeded' };

  // 3. Commande : en attente d'acceptation, hors écrans cuisine/bar jusque-là
  const notes = [input.notes, input.delivery_address ? `📍 ${input.delivery_address}` : null].filter(Boolean).join(' — ') || null;
  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      structure_id: structureId,
      source: 'API',
      external_id: input.external_id,
      partner: input.partner?.toLowerCase() || null,
      customer_name: input.customer.name || null,
      phone: normalizeCameroonPhone(input.customer.phone) ?? input.customer.phone,
      notes,
      status: 'PENDING',
      acceptance: 'PENDING',
      // La marketplace connaît déjà ce statut (elle vient de créer la commande).
      api_last_status: 'pending_acceptance',
      kitchen_status: 'ON_HOLD',
      bar_status: 'ON_HOLD',
      consumption_type: 'TAKEAWAY',
      takeaway_fee: 0,
      subtotal: 0,
      total: 0,
      // Livraison par le restaurant : zone et frais ; la course apparaît dans
      // l'écran Livraison à l'acceptation (delivery_status renseigné à ce moment).
      ...(delivery.fields ?? {}),
    })
    .select('id')
    .single();

  if (orderError || !order) {
    // Deux requêtes simultanées pour la même commande : l'autre l'a créée.
    if (orderError?.code === '23505') {
      const raced = await loadApiOrder(structureId, input.external_id);
      if (raced) return { kind: 'replayed', order: raced };
    }
    throw orderError ?? new Error('order insert failed');
  }

  try {
    // 4. Lignes (une par article reçu, prix de la base)
    const { data: inserted, error: itemsError } = await admin
      .from('order_items')
      .insert(
        input.items.map((item) => {
          const price = Number(productById.get(item.product_id).price) || 0;
          return {
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: price,
            total_price: price * item.quantity,
            notes: item.notes || null,
            is_price_counted: true,
            parent_order_item_id: null,
          };
        })
      )
      .select('id');
    if (itemsError || !inserted || inserted.length !== input.items.length) throw itemsError ?? new Error('items insert failed');

    const accompanimentRows = input.items.flatMap((item, i) =>
      (item.accompaniments || []).map((acc) => {
        const mapping = productById
          .get(item.product_id)
          .product_accompaniments.find((m: any) => m.accompaniment_id === acc.id);
        const unitPrice = Number(mapping.accompaniments.price) || 0;
        const quantity = (acc.quantity ?? 1) * item.quantity;
        return {
          order_id: order.id,
          parent_order_item_id: inserted[i].id,
          accompaniment_id: acc.id,
          quantity,
          unit_price_snapshot: unitPrice,
          total_price_snapshot: unitPrice * quantity,
          is_price_counted: true,
        };
      })
    );
    if (accompanimentRows.length) {
      const { error: accError } = await admin.from('order_accompaniments').insert(accompanimentRows);
      if (accError) throw accError;
    }

    // 5. Totaux (TVA du point, promotions automatiques)
    await recomputeOrderTotal(order.id);
  } catch (failure) {
    await admin.from('orders').delete().eq('id', order.id);
    throw failure;
  }

  await notifyStructureStaff({
    structureId,
    message: ({ t }) => ({
      title: t('notify.marketplaceOrder.title', { partner: input.partner || 'Marketplace' }),
      body: t('notify.marketplaceOrder.body', { ref: input.external_id }),
    }),
    url: `/orders/${order.id}`,
    roles: ['ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR', 'SUPER_ADMIN'],
  });

  return { kind: 'created', order: (await loadApiOrder(structureId, order.id))! };
}

// ── Annulation par la marketplace ────────────────────────

export async function cancelApiOrder(order: Record<string, any>, reason?: string) {
  const status = apiOrderStatus(order);
  if (status === 'cancelled' || status === 'rejected') return { ok: true as const };
  // Plus d'annulation possible une fois la préparation commencée.
  if (status !== 'pending_acceptance' && status !== 'accepted') return { ok: false as const, status };

  await getAdminSupabase()
    .from('orders')
    .update({ status: 'CANCELLED', cancel_reason: reason || null, kitchen_status: 'CANCELLED', bar_status: 'CANCELLED' })
    .eq('id', order.id);

  await notifyStructureStaff({
    structureId: order.structure_id,
    message: ({ t }) => ({
      title: t('notify.marketplaceCancelled.title'),
      body: t('notify.marketplaceCancelled.body', { ref: order.external_id ?? order.id.slice(0, 8) }),
    }),
    url: `/orders/${order.id}`,
    roles: ['ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR', 'CUISINIER', 'BAR', 'SUPER_ADMIN'],
  });
  await syncOrderWebhook(order.id);
  return { ok: true as const };
}

// ── Livreur de la marketplace ────────────────────────────

const COURIER_ORDER: Record<string, number> = { ASSIGNED: 1, PICKED_UP: 2, DELIVERED: 3 };

/**
 * Enregistre une étape de la livraison. La remise au livreur (PICKED_UP) ou la
 * livraison clôt la vente : paiement « marketplace », facture, stock, écriture.
 */
export async function recordCourierEvent(order: Record<string, any>, event: z.infer<typeof courierEventSchema>) {
  if (order.consumption_type === 'DELIVERY') return { ok: false as const, reason: 'restaurant_delivery' };
  if (order.acceptance !== 'ACCEPTED' || order.status === 'CANCELLED') return { ok: false as const, reason: 'not_accepted' };
  const current = order.courier_status as string | null;
  if (current === 'DELIVERED' || current === 'FAILED') return { ok: false as const, reason: 'finished' };
  if (event.status !== 'FAILED' && current && COURIER_ORDER[event.status] < COURIER_ORDER[current]) {
    return { ok: false as const, reason: 'backwards' };
  }

  const admin = getAdminSupabase();
  await admin
    .from('orders')
    .update({
      courier_status: event.status,
      courier_name: event.courier_name ?? order.courier_name ?? null,
      courier_phone: event.courier_phone ?? order.courier_phone ?? null,
      ...(event.status === 'FAILED' && event.reason ? { cancel_reason: event.reason } : {}),
    })
    .eq('id', order.id);

  if ((event.status === 'PICKED_UP' || event.status === 'DELIVERED') && order.status !== 'COMPLETED') {
    await completeMarketplaceSale(order);
  }
  await syncOrderWebhook(order.id);
  return { ok: true as const };
}

/** Clôture la vente : la marketplace a encaissé le client et reversera le montant. */
export async function completeMarketplaceSale(order: Record<string, any>) {
  const admin = getAdminSupabase();
  const { data: fresh } = await admin.from('orders').select('id, total, status').eq('id', order.id).single();
  if (!fresh || fresh.status === 'COMPLETED') return;

  await admin.from('payments').insert({
    order_id: order.id,
    amount: Number(fresh.total) || 0,
    payment_method: 'MARKETPLACE',
    status: 'COMPLETED',
    reference: order.external_id ?? null,
    notes: order.partner ?? null,
  });
  await admin
    .from('orders')
    .update({ status: 'COMPLETED', paid_at: new Date().toISOString(), kitchen_status: 'READY', bar_status: 'READY' })
    .eq('id', order.id);

  await deductOrderStock(order.id);
  await assignInvoiceNumber('ORDER', order.id);
  await postSaleSafely('ORDER', order.id);
}
