import { apiError, apiOk, readJson, withApi } from '@/lib/api/context';
import { cancelApiOrder, cancelOrderSchema, loadApiOrder, serializeOrder, zodDetails } from '@/lib/api/orders';

/** POST /api/v1/orders/{id}/cancel — possible tant que la préparation n'a pas commencé. */
export const POST = withApi<{ id: string }>(async (ctx, request, { id }) => {
  const parsed = cancelOrderSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: zodDetails(parsed.error) });

  const order = await loadApiOrder(ctx.structureId, id);
  if (!order) return apiError(ctx.locale, 'not_found', { rate: ctx.rate });

  const result = await cancelApiOrder(order, parsed.data.reason);
  if (!result.ok) {
    return apiError(ctx.locale, 'invalid_state', { rate: ctx.rate, details: [{ field: 'status', code: result.status }] });
  }
  return apiOk(ctx, serializeOrder((await loadApiOrder(ctx.structureId, order.id))!));
});
