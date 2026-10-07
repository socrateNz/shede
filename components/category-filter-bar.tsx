'use client';

import { useMemo } from 'react';
import { childrenByParent, productInCategory, sortCategoryTree, type CategoryNode } from '@/lib/category-tree';

/**
 * Filtre par catégorie sur deux niveaux : catégories principales, puis les
 * sous-catégories de celle choisie. Seules les catégories qui contiennent au
 * moins un produit sont proposées. value = id choisi (catégorie ou sous-catégorie).
 */
export function CategoryFilterBar({
  categories,
  productCategoryIds,
  value,
  onChange,
  allLabel,
  tone = 'dark',
}: {
  categories: CategoryNode[];
  /** Catégories de chaque produit affichable. */
  productCategoryIds: (string[] | undefined)[];
  value: string | null;
  onChange: (id: string | null) => void;
  allLabel: string;
  tone?: 'dark' | 'light';
}) {
  const { roots, children } = useMemo(() => {
    const used = (id: string) => productCategoryIds.some((ids) => productInCategory(ids, id, categories));
    const sorted = sortCategoryTree(categories).filter((c) => used(c.id));
    return {
      roots: sorted.filter((c) => !c.parent_id || !sorted.some((r) => r.id === c.parent_id)),
      children: childrenByParent(sorted),
    };
  }, [categories, productCategoryIds]);

  if (!roots.length) return null;

  const selected = categories.find((c) => c.id === value);
  const activeRoot = selected?.parent_id ?? selected?.id ?? null;
  const subs = activeRoot ? children.get(activeRoot) ?? [] : [];

  const styles =
    tone === 'dark'
      ? {
          on: 'border-blue-500 bg-blue-500/20 text-blue-200',
          off: 'border-slate-600 text-slate-300 hover:border-slate-500',
          base: 'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          sub: 'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
        }
      : {
          on: 'border-blue-600 bg-blue-600 text-white shadow',
          off: 'border-slate-200 bg-white text-slate-600 hover:border-blue-300',
          base: 'shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors',
          sub: 'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        };
  const row = tone === 'dark' ? 'flex flex-wrap gap-2' : 'flex gap-2 overflow-x-auto pb-1';

  return (
    <div className="space-y-2">
      <div className={row}>
        <button type="button" onClick={() => onChange(null)} className={`${styles.base} ${value === null ? styles.on : styles.off}`}>
          {allLabel}
        </button>
        {roots.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c.id)} className={`${styles.base} ${activeRoot === c.id ? styles.on : styles.off}`}>
            {c.name}
          </button>
        ))}
      </div>
      {subs.length > 0 && (
        <div className={row}>
          {subs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(value === c.id ? activeRoot : c.id)}
              className={`${styles.sub} ${value === c.id ? styles.on : styles.off}`}
            >
              › {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
