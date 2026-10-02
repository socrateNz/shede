import { createHmac, timingSafeEqual } from 'crypto';
import { deflateRawSync, inflateRawSync } from 'zlib';
import { getStructureTaxSettings } from '@/lib/fiscal';
import { computeOrderAmounts, loadActivePromotions } from '@/lib/order-totals';
import { normalizeCameroonPhone } from '@/lib/phone';
import {
  apiOrderStatus,
  serializeOrder,
  validateOrderItems,
  type ApiOrderStatus,
  type CreateOrderInput,
  type courierEventSchema,
} from '@/lib/api/orders';
import type { z } from 'zod';

// Mode test de l'API (clés shd_test_) : RIEN n'est écrit en base.
//
// Une commande de test est validée exactement comme en production (produits,
// disponibilité, accompagnements, prix, promotions, TVA), puis renvoyée sans être
// enregistrée. Son `id` contient la commande elle-même, compressée et signée par
// le serveur : GET /orders/{id} la relit sans base de données.
//
// Son statut avance tout seul avec le temps, pour tester le suivi :
//   0–30 s pending_acceptance → 30–60 s accepted → 60–120 s preparing → ready
// Un `external_id` terminé par `-reject` simule un refus du restaurant à 30 s.
// Annulation et événements du livreur renvoient le résultat simulé sans le conserver.

export const SANDBOX_ID_PREFIX = 'test_';
const TTL_MS = 7 * 24 * 3600_000;
const ACCEPT_AFTER_S = 30;
const PREPARING_AFTER_S = 60;
const READY_AFTER_S = 120;
const SANDBOX_PREP_MINUTES = 15;

type SandboxItem = [productId: string, name: string, quantity: number, unitPrice: number, notes: string | null, acc: [string, string, number, number][]];
type SandboxPayload = {
  v: 1;
  s: string; // point
  e: string; // external_id
  p: string | null; // partner
  c: [string | null, string]; // client : nom, téléphone
  n: string | null; // notes
  t: number; // création (ms)
  i: SandboxItem[];
  a: [subtotal: number, discount: number, tax: number, total: number];
};

function signingKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  // Clé dérivée : la clé service ne sert jamais directement à signer.
  return createHmac('sha256', secret).update('shede-api-sandbox-v1').digest();
}

function sign(data: string) {
  return createHmac('sha256', signingKey()).update(data).digest('base64url').slice(0, 32);
}

function encode(payload: SandboxPayload) {
  const data = deflateRawSync(Buffer.from(JSON.stringify(payload))).toString('base64url');
  return `${SANDBOX_ID_PREFIX}${data}.${sign(data)}`;
}

function decode(id: string): SandboxPayload | null {
  if (!id.startsWith(SANDBOX_ID_PREFIX) || id.length > 8000) return null;
  const [data, signature] = id.slice(SANDBOX_ID_PREFIX.length).split('.');
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(inflateRawSync(Buffer.from(data, 'base64url')).toString()) as SandboxPayload;
    return payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
}

export function isSandboxOrderId(id: string) {
  return id.startsWith(SANDBOX_ID_PREFIX);
}

/**
 * Reconstitue la « ligne » de commande (même forme qu'en base) pour la passer à
 * serializeOrder ; `overrides` applique une action simulée (annulation, livreur).
 */
function toOrderRow(id: string, payload: SandboxPayload, overrides: Record<string, unknown> = {}) {
  const createdAt = new Date(payload.t);
  const elapsed = (Date.now() - payload.t) / 1000;
  const rejects = payload.e.endsWith('-reject');

  let columns: Record<string, unknown>;
  if (elapsed < ACCEPT_AFTER_S) {
    columns = { acceptance: 'PENDING', status: 'PENDING' };
  } else if (rejects) {
    columns = { acceptance: 'REJECTED', status: 'CANCELLED', rejection_reason: 'Test : commande refusée par le restaurant' };
  } else {
    columns = {
      acceptance: 'ACCEPTED',
      accepted_at: new Date(payload.t + ACCEPT_AFTER_S * 1000).toISOString(),
      prep_minutes: SANDBOX_PREP_MINUTES,
      status: elapsed < PREPARING_AFTER_S ? 'PENDING' : elapsed < READY_AFTER_S ? 'IN_PROGRESS' : 'READY',
    };
  }

  const changedAt =
    elapsed >= READY_AFTER_S && !rejects ? READY_AFTER_S
      : elapsed >= PREPARING_AFTER_S && !rejects ? PREPARING_AFTER_S
        : elapsed >= ACCEPT_AFTER_S ? ACCEPT_AFTER_S
          : 0;

  return {
    id,
    livemode: false,
    structure_id: payload.s,
    external_id: payload.e,
    partner: payload.p,
    customer_name: payload.c[0],
    phone: payload.c[1],
    notes: payload.n,
    created_at: createdAt.toISOString(),
    updated_at: new Date(payload.t + changedAt * 1000).toISOString(),
    invoice_number: null,
    subtotal: payload.a[0],
    discount_amount: payload.a[1],
    tax: payload.a[2],
    total: payload.a[3],
    order_items: payload.i.map(([productId, name, quantity, unitPrice, notes], index) => ({
      id: `test_item_${index + 1}`,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      total_price: unitPrice * quantity,
      notes,
      parent_order_item_id: null,
      products: { name },
    })),
    order_accompaniments: payload.i.flatMap(([, , , , , accompaniments], index) =>
      accompaniments.map(([accId, name, quantity, unitPrice]) => ({
        parent_order_item_id: `test_item_${index + 1}`,
        accompaniment_id: accId,
        quantity,
        unit_price_snapshot: unitPrice,
        total_price_snapshot: unitPrice * quantity,
        accompaniments: { name },
      }))
    ),
    ...columns,
    ...overrides,
  } as Record<string, any>;
}

export type SandboxCreateResult =
  | { kind: 'created'; order: ReturnType<typeof serializeOrder> }
  | { kind: 'paused' }
  | { kind: 'invalid'; details: { field: string; code: string }[] };

/** POST /orders en mode test : mêmes contrôles et mêmes montants, aucune écriture. */
export async function createSandboxOrder(structure: Record<string, any>, input: CreateOrderInput): Promise<SandboxCreateResult> {
  const structureId = structure.id as string;
  if (structure.api_paused) return { kind: 'paused' };

  const { details, productById } = await validateOrderItems(structureId, input);
  if (details.length) return { kind: 'invalid', details };

  const items: SandboxItem[] = input.items.map((item) => {
    const product = productById.get(item.product_id);
    const unitPrice = Number(product.price) || 0;
    const accompaniments = (item.accompaniments || []).map((acc): [string, string, number, number] => {
      const mapping = product.product_accompaniments.find((m: any) => m.accompaniment_id === acc.id);
      return [acc.id, mapping.accompaniments.name, (acc.quantity ?? 1) * item.quantity, Number(mapping.accompaniments.price) || 0];
    });
    return [item.product_id, product.name, item.quantity, unitPrice, item.notes || null, accompaniments];
  });

  // Montants calculés comme recomputeOrderTotal() le ferait pour une vraie commande.
  const amounts = computeOrderAmounts({
    productItems: items.map(([productId, , quantity, unitPrice]) => ({
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      total_price: unitPrice * quantity,
    })),
    accompaniments: items.flatMap(([, , , , , acc]) => acc.map(([, , quantity, unitPrice]) => ({ total_price_snapshot: unitPrice * quantity }))),
    promotions: await loadActivePromotions(structureId),
    taxSettings: await getStructureTaxSettings(structureId),
    takeawayFee: 0,
  });

  const payload: SandboxPayload = {
    v: 1,
    s: structureId,
    e: input.external_id,
    p: input.partner?.toLowerCase() || null,
    c: [input.customer.name || null, normalizeCameroonPhone(input.customer.phone) ?? input.customer.phone],
    n: [input.notes, input.delivery_address ? `📍 ${input.delivery_address}` : null].filter(Boolean).join(' — ') || null,
    t: Date.now(),
    i: items,
    a: [amounts.subtotal, amounts.discount, amounts.tax, amounts.total],
  };
  const id = encode(payload);
  return { kind: 'created', order: serializeOrder(toOrderRow(id, payload)) };
}

/** Commande de test d'un point, ou null (id invalide, falsifié, expiré ou d'un autre point). */
export function loadSandboxOrder(structureId: string, id: string) {
  const payload = decode(id);
  if (!payload || payload.s !== structureId || Date.now() - payload.t > TTL_MS) return null;
  return { id, payload, row: toOrderRow(id, payload) };
}

type SandboxOrder = NonNullable<ReturnType<typeof loadSandboxOrder>>;

/** Annulation simulée : mêmes règles qu'en production, résultat non conservé. */
export function cancelSandboxOrder(order: SandboxOrder, reason?: string) {
  const status: ApiOrderStatus = apiOrderStatus(order.row);
  if (status === 'cancelled' || status === 'rejected') return { ok: true as const, order: serializeOrder(order.row) };
  if (status !== 'pending_acceptance' && status !== 'accepted') return { ok: false as const, status };
  return {
    ok: true as const,
    order: serializeOrder(toOrderRow(order.id, order.payload, {
      status: 'CANCELLED',
      cancel_reason: reason || null,
      updated_at: new Date().toISOString(),
    })),
  };
}

/** Événement livreur simulé : mêmes règles qu'en production, résultat non conservé. */
export function sandboxCourierEvent(order: SandboxOrder, event: z.infer<typeof courierEventSchema>) {
  if (order.row.acceptance !== 'ACCEPTED' || order.row.status === 'CANCELLED') {
    return { ok: false as const, reason: 'not_accepted' };
  }
  const completes = event.status === 'PICKED_UP' || event.status === 'DELIVERED';
  return {
    ok: true as const,
    order: serializeOrder(toOrderRow(order.id, order.payload, {
      courier_status: event.status,
      courier_name: event.courier_name ?? null,
      courier_phone: event.courier_phone ?? null,
      ...(event.status === 'FAILED' && event.reason ? { cancel_reason: event.reason } : {}),
      ...(completes ? { status: 'COMPLETED', invoice_number: 'TEST-0000' } : {}),
      updated_at: new Date().toISOString(),
    })),
  };
}
