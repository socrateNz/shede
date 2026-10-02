import { apiOk, withApi } from '@/lib/api/context';
import { serializePoint } from '@/lib/api/serializers';

/** GET /api/v1/point — le point de vente associé à la clé. */
export const GET = withApi(async (ctx) =>
  // livemode : false avec une clé de test (shd_test_) — permet de vérifier la clé utilisée.
  apiOk(ctx, { ...serializePoint(ctx.structure), livemode: ctx.mode === 'live' })
);
