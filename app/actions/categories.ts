'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { emitMenuUpdated } from '@/lib/api/webhooks';
import { refreshLegacyCategoryText } from '@/lib/categories';
import { sortCategoryTree } from '@/lib/category-tree';

// Catégories de produits d'un point (docs/phase15-categories.sql), gérées par
// l'administrateur du point, comme les produits. Deux niveaux au plus : une
// sous-catégorie ne peut pas avoir de sous-catégories (règle aussi vérifiée par
// la base, voir check_product_category_parent).

type Result = { success: boolean; error: string };

export type CategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  is_active: boolean;
  product_count: number;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session?.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) return null;
  return session as typeof session & { structureId: string };
}

function revalidateCatalog() {
  revalidatePath('/categories');
  revalidatePath('/products');
  revalidatePath('/orders/new');
}

/** Catégories du point avec le nombre de produits de chacune. null : migration non exécutée. */
export async function listCategories(): Promise<CategoryRow[] | null> {
  const session = await requireAdmin();
  if (!session) return [];
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('product_categories')
    .select('id, name, parent_id, position, is_active, product_category_links(product_id, products(is_deleted))')
    .eq('structure_id', session.structureId);
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? null : [];
  return sortCategoryTree(
    (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id ?? null,
      position: Number(c.position) || 0,
      is_active: c.is_active !== false,
      product_count: (c.product_category_links || []).filter((l: any) => !l.products?.is_deleted).length,
    }))
  );
}

/** Erreur de la base → message : règle des deux niveaux, nom en double. */
async function dbError(error: { code?: string; message?: string }, fallback: 'errors.createFailed' | 'errors.updateFailed' | 'errors.deleteFailed') {
  if (error.code === '23505') return te('categories.errors.duplicate');
  if (error.message?.includes('category_has_children') || error.code === '23503') return te('categories.errors.hasChildren');
  if (error.message?.includes('category_parent_invalid')) return te('categories.errors.parentInvalid');
  return te(fallback);
}

/**
 * Vérifie le parent choisi : catégorie de premier niveau du même point, différente
 * de la catégorie elle-même. null = premier niveau.
 */
async function checkParent(structureId: string, parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return null;
  if (parentId === selfId) return 'categories.errors.parentInvalid' as const;
  const { data: parent } = await getAdminSupabase()
    .from('product_categories')
    .select('id, parent_id')
    .eq('id', parentId)
    .eq('structure_id', structureId)
    .maybeSingle();
  if (!parent || parent.parent_id) return 'categories.errors.parentInvalid' as const;
  return null;
}

/** Position suivante parmi les catégories de même niveau. */
async function nextPosition(structureId: string, parentId: string | null) {
  let query = getAdminSupabase()
    .from('product_categories')
    .select('position')
    .eq('structure_id', structureId)
    .order('position', { ascending: false })
    .limit(1);
  query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
  const { data } = await query.maybeSingle();
  return (Number(data?.position) || 0) + 1;
}

function cleanName(raw: unknown) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

/** Crée une catégorie, ou une sous-catégorie si parentId (catégorie de premier niveau) est donné. */
export async function createCategory(name: string, parentId?: string | null): Promise<Result & { id?: string }> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const clean = cleanName(name);
  if (!clean) return { success: false, error: await te('categories.errors.nameRequired') };
  const parentProblem = await checkParent(session.structureId, parentId);
  if (parentProblem) return { success: false, error: await te(parentProblem) };

  const { data, error } = await getAdminSupabase()
    .from('product_categories')
    .insert({
      structure_id: session.structureId,
      name: clean,
      parent_id: parentId || null,
      position: await nextPosition(session.structureId, parentId || null),
    })
    .select('id')
    .single();
  if (error) return { success: false, error: await dbError(error, 'errors.createFailed') };
  revalidateCatalog();
  await emitMenuUpdated(session.structureId, { category_id: data.id, change: 'created' });
  return { success: true, error: '', id: data.id as string };
}

/**
 * Renomme, masque/affiche ou déplace une catégorie. parentId : null = premier
 * niveau ; une catégorie qui a des sous-catégories ne peut pas être déplacée sous une autre.
 */
export async function updateCategory(
  id: string,
  input: { name?: string; isActive?: boolean; parentId?: string | null }
): Promise<Result> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const changes: Record<string, unknown> = {};
  if (input.parentId !== undefined) {
    const { data: current } = await getAdminSupabase()
      .from('product_categories')
      .select('parent_id')
      .eq('id', id)
      .eq('structure_id', session.structureId)
      .maybeSingle();
    if (!current) return { success: false, error: await te('errors.updateFailed') };
    if ((current.parent_id ?? null) !== (input.parentId || null)) {
      const parentProblem = await checkParent(session.structureId, input.parentId, id);
      if (parentProblem) return { success: false, error: await te(parentProblem) };
      if (input.parentId) {
        const { count } = await getAdminSupabase()
          .from('product_categories')
          .select('id', { count: 'exact', head: true })
          .eq('parent_id', id);
        if (count) return { success: false, error: await te('categories.errors.hasChildren') };
      }
      changes.parent_id = input.parentId || null;
      changes.position = await nextPosition(session.structureId, input.parentId || null);
    }
  }
  if (input.name !== undefined) {
    const clean = cleanName(input.name);
    if (!clean) return { success: false, error: await te('categories.errors.nameRequired') };
    changes.name = clean;
  }
  if (input.isActive !== undefined) changes.is_active = Boolean(input.isActive);
  if (!Object.keys(changes).length) return { success: true, error: '' };

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('product_categories')
    .update(changes)
    .eq('id', id)
    .eq('structure_id', session.structureId);
  if (error) return { success: false, error: await dbError(error, 'errors.updateFailed') };

  // Nom ou visibilité changés : le texte recopié sur les produits suit.
  const { data: links } = await admin.from('product_category_links').select('product_id').eq('category_id', id);
  await refreshLegacyCategoryText(admin, session.structureId, (links || []).map((l) => l.product_id as string));

  revalidateCatalog();
  await emitMenuUpdated(session.structureId, { category_id: id, change: 'updated' });
  return { success: true, error: '' };
}

/**
 * Supprime la catégorie ; les produits restent, ils perdent seulement cette catégorie.
 * Une catégorie qui a des sous-catégories doit d'abord être vidée.
 */
export async function deleteCategory(id: string): Promise<Result> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { count } = await admin.from('product_categories').select('id', { count: 'exact', head: true }).eq('parent_id', id);
  if (count) return { success: false, error: await te('categories.errors.hasChildren') };
  const { data: links } = await admin.from('product_category_links').select('product_id').eq('category_id', id);
  const { error } = await admin.from('product_categories').delete().eq('id', id).eq('structure_id', session.structureId);
  if (error) return { success: false, error: await dbError(error, 'errors.deleteFailed') };
  await refreshLegacyCategoryText(admin, session.structureId, (links || []).map((l) => l.product_id as string));
  revalidateCatalog();
  await emitMenuUpdated(session.structureId, { category_id: id, change: 'deleted' });
  return { success: true, error: '' };
}

/** Nouvel ordre d'affichage d'un groupe de catégories de même niveau : ids dans l'ordre voulu. */
export async function reorderCategories(orderedIds: string[]): Promise<Result> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const results = await Promise.all(
    orderedIds.slice(0, 500).map((id, index) =>
      admin.from('product_categories').update({ position: index + 1 }).eq('id', id).eq('structure_id', session.structureId)
    )
  );
  if (results.some((r) => r.error)) return { success: false, error: await te('errors.updateFailed') };
  revalidateCatalog();
  await emitMenuUpdated(session.structureId, { change: 'categories_reordered' });
  return { success: true, error: '' };
}
