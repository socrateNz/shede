'use client';

import Link from 'next/link';
import { Check, Layers, Settings2, Truck } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { childrenByParent, sortCategoryTree } from '@/lib/category-tree';

export type CategoryOption = { id: string; name: string; parent_id: string | null; is_active: boolean };

/**
 * Choix des catégories d'un produit (plusieurs possibles), parmi celles créées à
 * part ; les sous-catégories sont regroupées sous leur catégorie.
 */
export function ProductCategoryPicker({
  categories,
  selected,
  onChange,
  disabled,
}: {
  categories: CategoryOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  // Une catégorie masquée reste affichée si le produit l'a déjà, pour pouvoir la retirer.
  const visible = sortCategoryTree(categories.filter((c) => c.is_active || selected.includes(c.id)));
  const roots = visible.filter((c) => !c.parent_id || !visible.some((r) => r.id === c.parent_id));
  const children = childrenByParent(visible);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const chip = (category: CategoryOption, isChild = false) => {
    const active = selected.includes(category.id);
    return (
      <button
        key={category.id}
        type="button"
        disabled={disabled}
        onClick={() => toggle(category.id)}
        aria-pressed={active}
        className={`inline-flex items-center gap-1.5 rounded-full border transition-colors disabled:opacity-50 ${
          isChild ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm font-medium'
        } ${
          active ? 'border-amber-500/60 bg-amber-500/15 text-amber-200' : 'border-slate-600 bg-slate-900/40 text-slate-300 hover:border-slate-500'
        } ${category.is_active ? '' : 'italic opacity-70'}`}
      >
        {active ? <Check className="h-3.5 w-3.5" /> : isChild ? <span className="text-slate-500">›</span> : null}
        {category.name}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Layers className="h-4 w-4 text-amber-400" />
          {t('products.form.categories')}
        </label>
        <Link href="/categories" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
          <Settings2 className="h-3.5 w-3.5" />
          {t('products.form.manageCategories')}
        </Link>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-600 p-3 text-sm text-slate-400">{t('products.form.noCategories')}</p>
      ) : (
        <div className="space-y-2">
          {roots.map((root) => (
            <div key={root.id} className="flex flex-wrap items-center gap-2">
              {chip(root)}
              {(children.get(root.id) ?? []).map((child) => chip(child, true))}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">{t('products.form.categoriesHint')}</p>
    </div>
  );
}

/** Produit livrable ou non. */
export function DeliverableToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <Truck className="h-4 w-4 text-cyan-400" />
        {t('products.form.deliverable')}
      </label>
      <div className="flex items-center gap-4 pt-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" checked={value} onChange={() => onChange(true)} disabled={disabled} className="h-4 w-4" />
          <span className="text-sm text-slate-300">{t('products.form.deliverableYes')}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" checked={!value} onChange={() => onChange(false)} disabled={disabled} className="h-4 w-4" />
          <span className="text-sm text-slate-300">{t('products.form.deliverableNo')}</span>
        </label>
      </div>
      <p className="text-xs text-slate-500">{t('products.form.deliverableHint')}</p>
    </div>
  );
}
