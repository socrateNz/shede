import { z } from 'zod';
import { apiError, apiOk, readJson, withApi } from '@/lib/api/context';
import { serializeOrder, zodDetails } from '@/lib/api/orders';
import { loadSandboxOrder } from '@/lib/api/sandbox';
import { sendUnrecordedWebhook } from '@/lib/api/webhooks';

const STATUSES = [
  'pending_acceptance',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'delivery_failed',
  'rejected',
  'cancelled',
] as const;

const schema = z.object({
  type: z.enum(['order.status_changed', 'menu.updated', 'delivery_zones.updated', 'point.paused', 'point.resumed', 'ping']),
  /** Commande de test (id renvoyé par POST /orders avec une clé de test), pour order.status_changed. */
  order_id: z.string().max(8000).optional(),
  /** Statut à annoncer ; par défaut le statut actuel de la commande de test. */
  status: z.enum(STATUSES).optional(),
});

/**
 * POST /api/v1/sandbox/webhooks — clé de test uniquement.
 * Envoie tout de suite un événement signé (marqué `livemode: false`) à l'URL de
 * webhook du point, sans rien enregistrer, et renvoie le résultat de l'envoi.
 */
export const POST = withApi(async (ctx, request) => {
  if (ctx.mode !== 'test') {
    return apiError(ctx.locale, 'invalid_state', { rate: ctx.rate, details: [{ field: 'key', code: 'test_key_required' }] });
  }
  const parsed = schema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: zodDetails(parsed.error) });
  const { type, order_id, status } = parsed.data;

  let data: unknown;
  if (type === 'order.status_changed') {
    const simulated = order_id ? loadSandboxOrder(ctx.structureId, order_id) : null;
    if (!simulated) {
      return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: [{ field: 'order_id', code: 'test_order_required' }] });
    }
    const order = serializeOrder(simulated.row);
    data = { previous_status: null, order: status ? { ...order, status } : order };
  } else if (type === 'point.paused' || type === 'point.resumed') {
    data = { paused: type === 'point.paused' };
  } else if (type === 'menu.updated' || type === 'delivery_zones.updated') {
    data = { test: true };
  } else {
    data = { message: 'Shede webhook test' };
  }

  const result = await sendUnrecordedWebhook(ctx.structureId, type, data);
  if (!result.configured) {
    return apiError(ctx.locale, 'invalid_state', { rate: ctx.rate, details: [{ field: 'webhook_url', code: 'webhook_not_configured' }] });
  }
  return apiOk(ctx, result);
});
