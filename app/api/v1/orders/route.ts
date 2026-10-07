import { apiError, apiOk, readJson, withApi } from '@/lib/api/context';
import {
  API_ORDER_STATUSES,
  createApiOrder,
  createOrderSchema,
  listApiOrders,
  serializeOrder,
  zodDetails,
  type ApiOrderStatus,
} from '@/lib/api/orders';
import { createSandboxOrder } from '@/lib/api/sandbox';

/** Jour civil au Cameroun (UTC+1, sans heure d'été). */
const DOUALA_OFFSET = '+01:00';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Borne de date : `YYYY-MM-DD` (journée à Douala) ou date-heure ISO. null si invalide. */
function parseBound(value: string, edge: 'start' | 'end') {
  if (DATE_ONLY.test(value)) {
    const start = new Date(`${value}T00:00:00${DOUALA_OFFSET}`);
    if (Number.isNaN(start.getTime())) return null;
    // Date de fin incluse : on s'arrête au début du jour suivant.
    return new Date(start.getTime() + (edge === 'end' ? 86_400_000 : 0)).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * GET /api/v1/orders
 *   ?updated_since=ISO                 resynchronisation (tri par date de modification)
 *   ?created_from=&created_to=         période de création (jour inclus, ou date-heure)
 *   ?status=picked_up,delivered        un ou plusieurs statuts
 *   &limit=50&offset=0                 pagination (has_more indique la suite)
 */
export const GET = withApi(async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const details: { field: string; code: string }[] = [];

  const read = (name: string, edge: 'start' | 'end') => {
    const raw = params.get(name);
    if (!raw) return undefined;
    const value = parseBound(raw, edge);
    if (!value) details.push({ field: name, code: 'invalid_date' });
    return value ?? undefined;
  };
  const updatedSince = read('updated_since', 'start');
  const createdFrom = read('created_from', 'start');
  const createdTo = read('created_to', 'end');

  const statuses = (params.get('status') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = statuses.find((s) => !API_ORDER_STATUSES.includes(s as ApiOrderStatus));
  if (unknown) details.push({ field: 'status', code: 'invalid_status' });

  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.get('limit'))) || 50));
  const offset = Math.min(10_000, Math.max(0, Math.floor(Number(params.get('offset'))) || 0));

  if (details.length) return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details });

  // Mode test : les commandes simulées ne sont pas enregistrées, la liste est vide.
  if (ctx.mode === 'test') return apiOk(ctx, [], 200, { has_more: false });

  const { orders, hasMore } = await listApiOrders(ctx.structureId, {
    updatedSince,
    createdFrom,
    createdTo,
    statuses: statuses as ApiOrderStatus[],
    limit,
    offset,
  });
  return apiOk(ctx, orders.map(serializeOrder), 200, { has_more: hasMore });
});

/**
 * POST /api/v1/orders — nouvelle commande de la marketplace.
 * Rejouer la même requête (même `external_id`) renvoie la commande existante (200).
 */
export const POST = withApi(async (ctx, request) => {
  const parsed = createOrderSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: zodDetails(parsed.error) });
  }

  // Mode test : validée et chiffrée comme en production, mais jamais enregistrée.
  if (ctx.mode === 'test') {
    const simulated = await createSandboxOrder(ctx.structure, parsed.data);
    if (simulated.kind === 'created') return apiOk(ctx, simulated.order, 201);
    if (simulated.kind === 'paused') return apiError(ctx.locale, 'point_paused', { rate: ctx.rate });
    return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: simulated.details });
  }

  const result = await createApiOrder(ctx.structure, parsed.data);
  switch (result.kind) {
    case 'created':
      return apiOk(ctx, serializeOrder(result.order), 201);
    case 'replayed':
      return apiOk(ctx, serializeOrder(result.order), 200);
    case 'paused':
      return apiError(ctx.locale, 'point_paused', { rate: ctx.rate });
    case 'quota_exceeded':
      return apiError(ctx.locale, 'quota_exceeded', { rate: ctx.rate });
    case 'invalid':
      return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: result.details });
  }
});
