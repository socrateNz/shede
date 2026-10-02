import { apiError, apiOk, readJson, withApi } from '@/lib/api/context';
import { createApiOrder, createOrderSchema, listApiOrders, serializeOrder, zodDetails } from '@/lib/api/orders';
import { createSandboxOrder } from '@/lib/api/sandbox';

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
  // Mode test : les commandes simulées ne sont pas enregistrées, la liste est vide.
  if (ctx.mode === 'test') return apiOk(ctx, []);
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
