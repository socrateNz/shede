import { apiError, apiOk, readJson, withApi } from '@/lib/api/context';
import { courierEventSchema, loadApiOrder, recordCourierEvent, serializeOrder, zodDetails } from '@/lib/api/orders';

/**
 * POST /api/v1/orders/{id}/delivery-events
 * { "status": "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "FAILED", "courier_name", "courier_phone", "reason" }
 * PICKED_UP (ou DELIVERED) clôt la vente côté restaurant.
 */
export const POST = withApi<{ id: string }>(async (ctx, request, { id }) => {
  const parsed = courierEventSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(ctx.locale, 'validation_error', { rate: ctx.rate, details: zodDetails(parsed.error) });

  const order = await loadApiOrder(ctx.structureId, id);
  if (!order) return apiError(ctx.locale, 'not_found', { rate: ctx.rate });

  const result = await recordCourierEvent(order, parsed.data);
  if (!result.ok) {
    return apiError(ctx.locale, 'invalid_state', { rate: ctx.rate, details: [{ field: 'status', code: result.reason }] });
  }
  return apiOk(ctx, serializeOrder((await loadApiOrder(ctx.structureId, order.id))!));
});
