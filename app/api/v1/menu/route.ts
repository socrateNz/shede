import { getAdminSupabase } from '@/lib/supabase';
import { apiOk, withApi } from '@/lib/api/context';
import { serializeMenu } from '@/lib/api/serializers';

/**
 * GET /api/v1/menu — produits du point avec leurs accompagnements.
 * Les produits indisponibles sont inclus (`is_available: false`) pour que la
 * marketplace puisse les masquer sans les supprimer de son catalogue.
 */
export const GET = withApi(async (ctx) => {
  const { data: products, error } = await getAdminSupabase()
    .from('products')
    .select('*, product_accompaniments(quantity, accompaniments(id, name, price, is_available, is_deleted))')
    .eq('structure_id', ctx.structureId)
    .eq('is_deleted', false)
    .order('category')
    .order('name');
  if (error) throw error;
  return apiOk(ctx, serializeMenu(ctx.structure, products || []));
});
