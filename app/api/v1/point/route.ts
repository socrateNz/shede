import { apiOk, withApi } from '@/lib/api/context';
import { serializePoint } from '@/lib/api/serializers';

/** GET /api/v1/point — le point de vente associé à la clé. */
export const GET = withApi(async (ctx) => apiOk(ctx, serializePoint(ctx.structure)));
