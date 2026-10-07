// Arborescence des catégories : deux niveaux au plus (catégorie → sous-catégories).
// Fonctions pures, utilisables côté serveur comme dans le navigateur.

export type CategoryNode = {
  id: string;
  name: string;
  parent_id: string | null;
  position?: number;
  is_active?: boolean;
};

const byPosition = (a: CategoryNode, b: CategoryNode) =>
  (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name);

/** Ordre d'affichage : chaque catégorie suivie de ses sous-catégories. */
export function sortCategoryTree<T extends CategoryNode>(list: T[]): T[] {
  const ids = new Set(list.map((c) => c.id));
  // Une sous-catégorie dont le parent n'est pas dans la liste est traitée comme un premier niveau.
  const roots = list.filter((c) => !c.parent_id || !ids.has(c.parent_id)).sort(byPosition);
  return roots.flatMap((root) => [root, ...list.filter((c) => c.parent_id === root.id).sort(byPosition)]);
}

/** Sous-catégories de chaque catégorie. */
export function childrenByParent<T extends CategoryNode>(list: T[]) {
  const map = new Map<string, T[]>();
  for (const c of list) {
    if (!c.parent_id) continue;
    map.set(c.parent_id, [...(map.get(c.parent_id) ?? []), c]);
  }
  map.forEach((children) => children.sort(byPosition));
  return map;
}

/**
 * Catégories visibles : actives, et dont le parent est actif (masquer une
 * catégorie masque aussi ses sous-catégories).
 */
export function visibleCategories<T extends CategoryNode>(list: T[]): T[] {
  const inactive = new Set(list.filter((c) => c.is_active === false).map((c) => c.id));
  return list.filter((c) => !inactive.has(c.id) && !(c.parent_id && inactive.has(c.parent_id)));
}

/** Un produit correspond au filtre s'il est dans la catégorie ou dans l'une de ses sous-catégories. */
export function productInCategory(productCategoryIds: string[] | undefined, filterId: string, list: CategoryNode[]) {
  if (!productCategoryIds?.length) return false;
  if (productCategoryIds.includes(filterId)) return true;
  return list.some((c) => c.parent_id === filterId && productCategoryIds.includes(c.id));
}

/** Libellé complet : « Grillades › Poulet ». */
export function categoryLabel(category: CategoryNode, list: CategoryNode[]) {
  const parent = category.parent_id ? list.find((c) => c.id === category.parent_id) : null;
  return parent ? `${parent.name} › ${category.name}` : category.name;
}
