import { createHmac, randomBytes } from 'crypto';
import { after } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';

// Webhooks : Shede prévient la marketplace d'un point (docs/phase13-api.sql).
// Chaque événement est enregistré puis envoyé immédiatement ; un échec est
// réessayé plus tard (/api/cron/webhooks, déclenché chaque minute par Supabase,
// et à chaque appel de l'API par la marketplace).
//
// Requête envoyée : POST <webhook_url>, corps JSON
//   { "id", "type", "created_at", "data" }
// En-têtes : Shede-Event, Shede-Delivery (= id), Shede-Signature: t=<unix>,v1=<hex>
// avec v1 = HMAC-SHA256(secret, `${t}.${corps}`).

export type WebhookEventType = 'order.status_changed' | 'menu.updated' | 'point.paused' | 'point.resumed' | 'ping';

/** Délais avant chaque nouvelle tentative (après la 1re, la 2e…). */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 12 * 3600_000, 24 * 3600_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const TIMEOUT_MS = 8_000;

export function generateWebhookSecret() {
  return 'whsec_' + randomBytes(24).toString('base64url');
}

export function signWebhook(secret: string, timestamp: number, body: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Refuse les adresses locales ou privées : le serveur ne doit pas être utilisé
 * pour joindre son propre réseau.
 */
export function isAllowedWebhookUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
  if (host.startsWith('[') || host === '::1') return false;
  return true;
}

/** Exécute après la réponse si possible (requête en cours), sinon tout de suite. */
function later(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Enregistre un événement pour le point (s'il a un webhook) et tente l'envoi. */
export async function emitWebhook(structureId: string, type: WebhookEventType, data: unknown) {
  try {
    const admin = getAdminSupabase();
    const { data: credential } = await admin
      .from('point_api_credentials')
      .select('webhook_url')
      .eq('structure_id', structureId)
      .maybeSingle();
    if (!credential?.webhook_url) return null;

    const { data: row, error } = await admin
      .from('webhook_deliveries')
      .insert({ structure_id: structureId, event_type: type, payload: data ?? {} })
      .select('*')
      .single();
    if (error || !row) {
      console.warn('[webhooks] événement non enregistré :', error?.message);
      return null;
    }
    later(() => deliver(row));
    return row.id as string;
  } catch (error) {
    console.warn('[webhooks] émission :', (error as Error).message);
    return null;
  }
}

type DeliveryRow = {
  id: string;
  structure_id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
  created_at: string;
};

/** Envoie un événement et enregistre le résultat (succès, nouvelle tentative ou abandon). */
export async function deliver(row: DeliveryRow) {
  const admin = getAdminSupabase();
  const { data: credential } = await admin
    .from('point_api_credentials')
    .select('webhook_url, webhook_secret')
    .eq('structure_id', row.structure_id)
    .maybeSingle();

  const attempts = row.attempts + 1;
  let statusCode: number | null = null;
  let errorText: string | null = null;

  if (!credential?.webhook_url || !credential.webhook_secret) {
    errorText = 'webhook non configuré';
  } else {
    const body = JSON.stringify({ id: row.id, type: row.event_type, created_at: row.created_at, data: row.payload });
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      const response = await fetch(credential.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Shede-Webhooks/1.0',
          'Shede-Event': row.event_type,
          'Shede-Delivery': row.id,
          'Shede-Signature': `t=${timestamp},v1=${signWebhook(credential.webhook_secret, timestamp, body)}`,
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      statusCode = response.status;
      if (!response.ok) errorText = `HTTP ${response.status}`;
    } catch (error) {
      errorText = (error as Error).name === 'TimeoutError' ? 'timeout' : (error as Error).message.slice(0, 200);
    }
  }

  const delivered = statusCode !== null && statusCode >= 200 && statusCode < 300;
  const giveUp = !delivered && attempts >= MAX_ATTEMPTS;
  await admin
    .from('webhook_deliveries')
    .update({
      attempts,
      last_status_code: statusCode,
      last_error: delivered ? null : errorText,
      status: delivered ? 'DELIVERED' : giveUp ? 'FAILED' : 'PENDING',
      delivered_at: delivered ? new Date().toISOString() : null,
      next_attempt_at: new Date(Date.now() + (RETRY_DELAYS_MS[attempts - 1] ?? 0)).toISOString(),
    })
    .eq('id', row.id);
  return delivered;
}

/** Envoie les événements arrivés à échéance (tous les points, ou un seul). */
export async function processDueWebhooks(options: { structureId?: string; limit?: number } = {}) {
  const { data, error } = await getAdminSupabase().rpc('claim_due_webhooks', {
    p_limit: options.limit ?? 50,
    p_structure_id: options.structureId ?? null,
  });
  if (error) {
    console.warn('[webhooks] relances :', error.message);
    return { processed: 0, delivered: 0 };
  }
  let delivered = 0;
  for (const row of (data || []) as DeliveryRow[]) {
    if (await deliver(row)) delivered++;
  }
  return { processed: (data || []).length, delivered };
}

/** Événement de test, envoyé tout de suite : renvoie le résultat de l'envoi. */
export async function sendTestWebhook(structureId: string) {
  const admin = getAdminSupabase();
  const { data: row, error } = await admin
    .from('webhook_deliveries')
    .insert({ structure_id: structureId, event_type: 'ping', payload: { message: 'Shede webhook test' } })
    .select('*')
    .single();
  if (error || !row) return null;
  await deliver(row);
  const { data: result } = await admin
    .from('webhook_deliveries')
    .select('status, last_status_code, last_error')
    .eq('id', row.id)
    .single();
  return result;
}

/** Relance planifiée dès maintenant (bouton « Renvoyer »). */
export async function retryDelivery(structureId: string, deliveryId: string) {
  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from('webhook_deliveries')
    .update({ status: 'PENDING', next_attempt_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .eq('structure_id', structureId)
    .select('*')
    .maybeSingle();
  if (!row) return false;
  return deliver({ ...row, attempts: Math.min(row.attempts, MAX_ATTEMPTS - 1) });
}

/**
 * Commande marketplace : si son statut vu par la marketplace a changé depuis le
 * dernier envoi, émet `order.status_changed` avec la commande complète.
 * À appeler après toute modification d'une commande (cuisine, caisse, API…).
 */
export async function syncOrderWebhook(orderId: string) {
  try {
    const { apiOrderStatus, loadApiOrder, serializeOrder } = await import('@/lib/api/orders');
    const admin = getAdminSupabase();
    const { data: head } = await admin
      .from('orders')
      .select('id, structure_id, source, api_last_status')
      .eq('id', orderId)
      .maybeSingle();
    if (!head || head.source !== 'API') return;

    const order = await loadApiOrder(head.structure_id, orderId);
    if (!order) return;
    const status = apiOrderStatus(order);
    if (status === head.api_last_status) return;

    // Mise à jour conditionnelle : deux appels simultanés n'émettent qu'une fois.
    const { data: claimed } = await admin
      .from('orders')
      .update({ api_last_status: status })
      .eq('id', orderId)
      .or(head.api_last_status ? `api_last_status.eq.${head.api_last_status}` : 'api_last_status.is.null')
      .select('id');
    if (!claimed?.length) return;

    await emitWebhook(head.structure_id, 'order.status_changed', {
      previous_status: head.api_last_status ?? null,
      order: serializeOrder({ ...order, api_last_status: status }),
    });
  } catch (error) {
    console.warn('[webhooks] statut de commande :', (error as Error).message);
  }
}

/** Le menu du point a changé : la marketplace doit relire GET /api/v1/menu. */
export function emitMenuUpdated(structureId: string, change: Record<string, unknown>) {
  return emitWebhook(structureId, 'menu.updated', change);
}
