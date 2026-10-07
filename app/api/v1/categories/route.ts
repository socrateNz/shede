import { apiOk, withApi } from '@/lib/api/context';
import { serializeCategory } from '@/lib/api/serializers';
import { loadCategories } from '@/lib/categories';

/**
 * GET /api/v1/categories — catégories et sous-catégories du menu, dans l'ordre
 * d'affichage du restaurant : chaque catégorie principale suivie de ses
 * sous-catégories (parent_id). Un produit de GET /menu peut appartenir à
 * plusieurs catégories (`categories`).
 */
export const GET = withApi(async (ctx) => {
  const categories = await loadCategories(ctx.structureId, { activeOnly: true });
  return apiOk(ctx, categories.map(serializeCategory));
});
