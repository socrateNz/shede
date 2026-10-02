import { apiError, apiOk, withApi } from '@/lib/api/context';
import { loadApiOrder, serializeOrder } from '@/lib/api/orders';
import { loadSandboxOrder } from '@/lib/api/sandbox';

/** GET /api/v1/orders/{id} — par id Shede ou par numéro de commande de la marketplace. */
export const GET = withApi<{ id: string }>(async (ctx, _request, { id }) => {
  if (ctx.mode === 'test') {
    const simulated = loadSandboxOrder(ctx.structureId, id);
    if (!simulated) return apiError(ctx.locale, 'not_found', { rate: ctx.rate });
    return apiOk(ctx, serializeOrder(simulated.row));
  }
  const order = await loadApiOrder(ctx.structureId, id);
  if (!order) return apiError(ctx.locale, 'not_found', { rate: ctx.rate });
  return apiOk(ctx, serializeOrder(order));
});
