import { getAdminSupabase } from '@/lib/supabase';
import { apiOk, withApi } from '@/lib/api/context';
import { serializeDeliveryZone } from '@/lib/api/serializers';

/**
 * GET /api/v1/delivery-zones — zones où le restaurant livre lui-même, avec leurs frais.
 * À utiliser avec `delivery_by: "restaurant"` dans POST /orders. Liste vide si le
 * point ne propose pas la livraison (GET /point → restaurant_delivery: false).
 */
export const GET = withApi(async (ctx) => {
  if (!(ctx.structure.modules as string[] | null)?.includes('LIVRAISON')) return apiOk(ctx, []);
  const { data, error } = await getAdminSupabase()
    .from('delivery_zones')
    .select('id, name, fee')
    .eq('structure_id', ctx.structureId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return apiOk(ctx, (data || []).map((zone) => serializeDeliveryZone(zone, ctx.structure)));
});
