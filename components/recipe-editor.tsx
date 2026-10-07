'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChefHat, Loader2, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRecipe, saveRecipe, type RecipeIngredientOption, type RecipeOwner } from '@/app/actions/recipes';
import {
  COMPATIBLE_UNITS,
  FOOD_COST_TARGET_PERCENT,
  foodCost,
  lineCost,
  recipeCost,
  type IngredientCost,
  type RecipeLine,
} from '@/lib/recipes';
import type { TaxSettings } from '@/lib/tax';
import { useT } from '@/lib/i18n/client';

type EditableLine = { key: string; ingredient_id: string; quantity: string; unit: RecipeLine['unit']; waste_percent: string };

const newKey = () => Math.random().toString(36).slice(2);

/**
 * Fiche recette d'un produit ou d'un accompagnement : ingrédients d'une portion,
 * avec le coût matière et la marge calculés en direct.
 */
export function RecipeEditor({
  owner,
  price,
  taxSettings,
  onSaved,
  compact = false,
}: {
  owner: RecipeOwner;
  /** Prix de vente (tel que saisi : TTC ou HT selon le point). */
  price: number;
  taxSettings: TaxSettings;
  onSaved?: () => void;
  /** Dans un dialogue : sans titre ni cadre. */
  compact?: boolean;
}) {
  const { t, format } = useT();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState(true);
  const [ingredients, setIngredients] = useState<RecipeIngredientOption[]>([]);
  const [lines, setLines] = useState<EditableLine[]>([]);

  const ownerKey = 'productId' in owner ? `p:${owner.productId}` : `a:${owner.accompanimentId}`;
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRecipe(owner).then((result) => {
      if (cancelled) return;
      if (result === null) {
        setInstalled(false);
      } else {
        setIngredients(result.ingredients);
        setLines(
          result.lines.map((l) => ({
            key: newKey(),
            ingredient_id: l.ingredient_id,
            quantity: String(l.quantity),
            unit: l.unit,
            waste_percent: String(l.waste_percent || ''),
          }))
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey]);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const costs = useMemo(
    () => new Map<string, IngredientCost>(ingredients.map((i) => [i.id, { id: i.id, unit: i.unit, cost_per_unit: i.cost_per_unit }])),
    [ingredients]
  );
  const parsed: RecipeLine[] = lines
    .filter((l) => l.ingredient_id && Number(l.quantity) > 0)
    .map((l) => ({ ingredient_id: l.ingredient_id, quantity: Number(l.quantity), unit: l.unit, waste_percent: Number(l.waste_percent) || 0 }));
  const summary = foodCost(recipeCost(parsed, costs), price, taxSettings);
  const overTarget = summary.percent !== null && summary.percent > FOOD_COST_TARGET_PERCENT;

  const update = (key: string, patch: Partial<EditableLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function chooseIngredient(key: string, ingredientId: string) {
    const ingredient = byId.get(ingredientId);
    // Unité proposée : la plus pratique pour une portion (g, ml, pièce)
    update(key, { ingredient_id: ingredientId, unit: ingredient ? COMPATIBLE_UNITS[ingredient.unit][0] : 'g' });
  }

  function save() {
    startTransition(async () => {
      const result = await saveRecipe(owner, parsed);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('recipes.saved'));
      onSaved?.();
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (!installed) return <p className="text-sm text-amber-400">{t('recipes.notInstalled')}</p>;

  const usedIds = new Set(lines.map((l) => l.ingredient_id));
  const inputClass = 'h-9 border-slate-600 bg-slate-900/50 text-slate-50';
  const selectClass = 'h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-2 text-sm text-slate-50';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5'}>
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 font-semibold text-slate-100">
              <ChefHat className="h-4 w-4 text-orange-400" /> {t('recipes.title')}
            </p>
            <p className="text-xs text-slate-400">{t('recipes.subtitle')}</p>
          </div>
          <Link href="/stock/ingredients" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            <Settings2 className="h-3.5 w-3.5" /> {t('recipes.manageIngredients')}
          </Link>
        </div>
      )}

      {ingredients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-600 p-3 text-sm text-slate-400">
          {t('recipes.noIngredients')}{' '}
          <Link href="/stock/ingredients" className="text-blue-400 hover:underline">{t('recipes.manageIngredients')}</Link>
        </p>
      ) : (
        <>
          {lines.length === 0 ? (
            <p className="text-sm text-slate-400">{t('recipes.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pb-2 font-medium">{t('recipes.ingredient')}</th>
                    <th className="w-24 pb-2 font-medium">{t('recipes.quantity')}</th>
                    <th className="w-24 pb-2 font-medium">{t('recipes.unit')}</th>
                    <th className="w-20 pb-2 font-medium" title={t('recipes.wasteHint')}>{t('recipes.waste')}</th>
                    <th className="w-24 pb-2 text-right font-medium">{t('recipes.lineCost')}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="align-middle">
                  {lines.map((line) => {
                    const ingredient = byId.get(line.ingredient_id);
                    const units = ingredient ? COMPATIBLE_UNITS[ingredient.unit] : [];
                    const cost =
                      ingredient && Number(line.quantity) > 0
                        ? lineCost(
                            { ingredient_id: line.ingredient_id, quantity: Number(line.quantity), unit: line.unit, waste_percent: Number(line.waste_percent) || 0 },
                            costs.get(line.ingredient_id)
                          )
                        : 0;
                    return (
                      <tr key={line.key}>
                        <td className="py-1 pr-2">
                          <select value={line.ingredient_id} onChange={(e) => chooseIngredient(line.key, e.target.value)} className={selectClass} aria-label={t('recipes.ingredient')}>
                            <option value="">{t('recipes.selectIngredient')}</option>
                            {ingredients
                              .filter((i) => i.id === line.ingredient_id || (i.is_active && !usedIds.has(i.id)))
                              .map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} {i.is_active ? '' : t('recipes.inactiveIngredient')}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <Input type="number" min="0" step="any" value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value })} className={inputClass} aria-label={t('recipes.quantity')} />
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={line.unit}
                            onChange={(e) => update(line.key, { unit: e.target.value as RecipeLine['unit'] })}
                            disabled={!ingredient}
                            className={selectClass}
                            aria-label={t('recipes.unit')}
                          >
                            {units.map((u) => (
                              <option key={u} value={u}>{t(`recipes.units.${u}`)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <Input type="number" min="0" max="89" step="any" value={line.waste_percent} placeholder="0" onChange={(e) => update(line.key, { waste_percent: e.target.value })} className={inputClass} aria-label={t('recipes.waste')} />
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-slate-200">{format.money(Math.round(cost))}</td>
                        <td className="py-1 text-right">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))} className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10" aria-label={t('recipes.remove')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((prev) => [...prev, { key: newKey(), ingredient_id: '', quantity: '', unit: 'g', waste_percent: '' }])}
            className="border-slate-600 text-slate-200 hover:bg-slate-700"
          >
            <Plus className="mr-1.5 h-4 w-4" /> {t('recipes.addLine')}
          </Button>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-900/40 p-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">{t('recipes.cost')}</p>
              <p className="font-semibold tabular-nums text-slate-50">{format.money(summary.cost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t('recipes.priceExcludingTax')}</p>
              <p className="font-semibold tabular-nums text-slate-50">{format.money(summary.priceExcludingTax)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t('recipes.margin')}</p>
              <p className={`font-semibold tabular-nums ${summary.margin < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{format.money(summary.margin)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t('recipes.percent')}</p>
              <p className={`font-semibold tabular-nums ${overTarget ? 'text-amber-400' : 'text-slate-50'}`}>
                {summary.percent === null ? '—' : `${format.number(summary.percent)} %`}
              </p>
              <p className="text-[10px] text-slate-500">{t('recipes.target', { percent: FOOD_COST_TARGET_PERCENT })}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={save} disabled={pending} className="bg-orange-600 text-white hover:bg-orange-700">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('recipes.save')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
