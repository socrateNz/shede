import { getAdminSupabase } from '@/lib/supabase';
import { sortCategoryTree, visibleCategories } from '@/lib/category-tree';

// Catégories de produits (docs/phase15-categories.sql). Module serveur : les
// catégories sont créées à part, puis choisies sur chaque produit (plusieurs
// possibles). Deux niveaux au plus : catégorie → sous-catégories (règle vérifiée
// aussi par la base). Les lectures renvoient une liste vide tant que la migration n'est
// pas exécutée, pour ne pas casser les écrans existants.

export type ProductCategory = { id: string; name: string; parent_id: string | null; position: number; is_active: boolean };

type Admin = ReturnType<typeof getAdminSupabase>;

/**
 * Catégories d'un point, dans l'ordre d'affichage (chaque catégorie suivie de ses
 * sous-catégories). activeOnly : sans les catégories masquées ni les
 * sous-catégories d'une catégorie masquée.
 */
export async function loadCategories(structureId: string, options: { activeOnly?: boolean } = {}): Promise<ProductCategory[]> {
  const { data, error } = await getAdminSupabase()
    .from('product_categories')
    .select('id, name, parent_id, position, is_active')
    .eq('structure_id', structureId);
  if (error) return [];
  const list = sortCategoryTree(
    (data || []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      parent_id: (c.parent_id as string | null) ?? null,
      position: Number(c.position) || 0,
      is_active: c.is_active !== false,
    }))
  );
  return options.activeOnly ? visibleCategories(list) : list;
}

/** Ids des catégories de chaque produit. */
export async function categoryIdsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!productIds.length) return result;
  const { data, error } = await getAdminSupabase()
    .from('product_category_links')
    .select('product_id, category_id')
    .in('product_id', productIds);
  if (error) return result;
  for (const link of data || []) {
    const list = result.get(link.product_id as string) ?? [];
    list.push(link.category_id as string);
    result.set(link.product_id as string, list);
  }
  return result;
}

/**
 * Catégories des produits, prêtes à afficher : [{ id, name }] dans l'ordre du
 * point, sans les catégories désactivées.
 */
export async function categoriesForProducts(structureId: string, productIds: string[]) {
  const [categories, links] = await Promise.all([loadCategories(structureId, { activeOnly: true }), categoryIdsByProduct(productIds)]);
  const byProduct = new Map<string, { id: string; name: string; parent_id: string | null }[]>();
  for (const productId of productIds) {
    const ids = new Set(links.get(productId) ?? []);
    byProduct.set(
      productId,
      categories.filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id }))
    );
  }
  return { categories, byProduct };
}

/** Texte recopié dans products.category (anciens écrans) : noms des catégories choisies. */
function legacyCategoryText(names: string[]) {
  return names.length ? names.join(', ').slice(0, 100) : null;
}

/**
 * Remplace les catégories d'un produit. Seules les catégories du point sont
 * gardées ; renvoie les noms retenus.
 */
export async function setProductCategories(admin: Admin, structureId: string, productId: string, categoryIds: string[]) {
  const wanted = [...new Set(categoryIds.filter(Boolean))];
  let valid: { id: string; name: string }[] = [];
  if (wanted.length) {
    const { data, error } = await admin
      .from('product_categories')
      .select('id, name, position')
      .eq('structure_id', structureId)
      .in('id', wanted)
      .order('position', { ascending: true });
    if (error) throw error;
    valid = (data || []).map((c) => ({ id: c.id as string, name: c.name as string }));
  }

  const { error: deleteError } = await admin.from('product_category_links').delete().eq('product_id', productId);
  if (deleteError) throw deleteError;
  if (valid.length) {
    const { error: insertError } = await admin
      .from('product_category_links')
      .insert(valid.map((c) => ({ product_id: productId, category_id: c.id })));
    if (insertError) throw insertError;
  }

  await admin
    .from('products')
    .update({ category: legacyCategoryText(valid.map((c) => c.name)) })
    .eq('id', productId)
    .eq('structure_id', structureId);
  return valid.map((c) => c.name);
}

/** Après un renommage ou une suppression de catégorie : remet à jour products.category. */
export async function refreshLegacyCategoryText(admin: Admin, structureId: string, productIds: string[]) {
  if (!productIds.length) return;
  const { byProduct } = await categoriesForProducts(structureId, productIds);
  await Promise.all(
    productIds.map((productId) =>
      admin
        .from('products')
        .update({ category: legacyCategoryText((byProduct.get(productId) ?? []).map((c) => c.name)) })
        .eq('id', productId)
        .eq('structure_id', structureId)
    )
  );
}

/** Produits non livrables parmi une liste (noms), pour refuser une commande à livrer. */
export async function undeliverableProducts(structureId: string, productIds: string[]) {
  if (!productIds.length) return [];
  // select('*') : tolère l'absence de la colonne is_deliverable avant la migration.
  const { data } = await getAdminSupabase()
    .from('products')
    .select('*')
    .eq('structure_id', structureId)
    .in('id', [...new Set(productIds)]);
  return (data || []).filter((p) => p.is_deliverable === false).map((p) => p.name as string);
}
