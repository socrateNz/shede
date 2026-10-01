import { apiError, apiOk, readJson, withApi } from '@/lib/api/context';
import { createApiOrder, createOrderSchema, listApiOrders, serializeOrder, zodDetails } from '@/lib/api/orders';

/**
 * GET /api/v1/orders?updated_since=ISO&limit=50
 * Commandes marketplace du point modifiées depuis une date (resynchronisation).
 */
export const GET = withApi(async (ctx, request) => {
  const url = new URL(request.url);
  const since = url.searchParams.get('updated_since');
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  if (since && Number.isNaN(Date.parse(since))) {
    return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: [{ field: 'updated_since', code: 'invalid_date' }] });
  }
  const orders = await listApiOrders(ctx.structureId, {
    updatedSince: since ? new Date(since).toISOString() : undefined,
    limit,
  });
  return apiOk(ctx, orders.map(serializeOrder));
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
