'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Carrot, Eye, EyeOff, Loader2, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createIngredient, deleteIngredient, setIngredientActive, updateIngredient, type IngredientRow } from '@/app/actions/ingredients';
import type { IngredientListStats } from '@/app/actions/ingredients';
import type { Paginated } from '@/lib/pagination';
import { PageNav } from '@/components/page-nav';
import { UrlSearch } from '@/components/url-filters';
import { INGREDIENT_UNITS, type IngredientUnit } from '@/lib/recipes';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

const SELECT_CLASS = 'h-10 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50 disabled:opacity-60';
const INPUT_CLASS = 'border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500';

type Form = { name: string; unit: IngredientUnit; cost: string; threshold: string; initial: string };
const EMPTY_FORM: Form = { name: '', unit: 'kg', cost: '', threshold: '0', initial: '' };

/** Ingrédients du point : liste, création et modification dans un dialogue. */
/** Une page d'ingrédients (20), filtrée par le serveur ; null = migration absente. */
export function IngredientsManager({ result }: { result: Paginated<IngredientRow, IngredientListStats> | null }) {
  const initialIngredients = result?.items ?? null;
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<IngredientRow | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const ingredients = initialIngredients ?? [];

  const visible = ingredients;

  const unitShort = (unit: IngredientUnit) => t(`ingredients.unitShort.${unit}`);

  function run(action: () => Promise<{ success: boolean; error: string }>, success?: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      after?.();
      router.refresh();
    });
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setEditing('new');
  }

  function openEdit(ingredient: IngredientRow) {
    setForm({
      name: ingredient.name,
      unit: ingredient.unit,
      cost: String(ingredient.cost_per_unit),
      threshold: String(ingredient.threshold),
      initial: '' });
    setEditing(ingredient);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      name: form.name,
      unit: form.unit,
      costPerUnit: Number(form.cost) || 0,
      threshold: Number(form.threshold) || 0 };
    if (editing === 'new') {
      run(() => createIngredient({ ...input, initialQuantity: Number(form.initial) || 0 }), t('ingredients.created'), () => setEditing(null));
    } else if (editing) {
      run(() => updateIngredient(editing.id, input), t('ingredients.saved'), () => setEditing(null));
    }
  }

  async function remove(ingredient: IngredientRow) {
    if (!(await dialogs.confirm({ description: t('ingredients.confirmDelete', { name: ingredient.name }), destructive: true }))) return;
    run(() => deleteIngredient(ingredient.id), t('ingredients.deleted'));
  }

  const unitLocked = editing !== null && editing !== 'new' && editing.recipe_count > 0;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            {t('ingredients.title')}
          </h1>
          <p className="max-w-2xl text-slate-400">{t('ingredients.subtitle')}</p>
        </div>
        {initialIngredients !== null && (
          <Button type="button" onClick={openNew} className="border-none bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700">
            <Plus className="mr-2 h-4 w-4" />
            {t('ingredients.newButton')}
          </Button>
        )}
      </div>

      {initialIngredients === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('ingredients.notInstalled')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
          <div className="border-b border-slate-700/50 p-4">
            <UrlSearch placeholder={t('ingredients.search')} className="max-w-sm" />
          </div>
          {visible.length === 0 ? (
            <div className="py-16 text-center">
              <Carrot className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="mb-4 text-sm text-slate-400">{t('ingredients.empty')}</p>
              {(result?.meta.stats.total ?? 0) === 0 && (
                <Button type="button" variant="outline" onClick={openNew} className="border-slate-700 text-emerald-400 hover:bg-slate-800">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('ingredients.newButton')}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-300">{t('ingredients.colName')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('ingredients.colUnit')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('ingredients.colCost')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('ingredients.colStock')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('ingredients.colStockValue')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('ingredients.colRecipes')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('ingredients.colStatus')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('ingredients.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((ingredient) => {
                  const low = ingredient.threshold > 0 && ingredient.quantity <= ingredient.threshold;
                  return (
                    <TableRow key={ingredient.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className={`font-medium ${ingredient.is_active ? 'text-slate-50' : 'text-slate-500 line-through'}`}>{ingredient.name}</TableCell>
                      <TableCell className="text-slate-300">{unitShort(ingredient.unit)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-200">
                        {t('ingredients.perUnit', { amount: format.money(ingredient.cost_per_unit), unit: unitShort(ingredient.unit) })}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${low ? 'text-amber-400' : 'text-slate-200'}`}>
                        <span className="inline-flex items-center gap-1">
                          {low && <AlertTriangle className="h-3.5 w-3.5" aria-label={t('ingredients.low')} />}
                          {format.number(ingredient.quantity, { maximumFractionDigits: 3 })} {unitShort(ingredient.unit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-200">
                        {format.money(Math.round(Math.max(0, ingredient.quantity) * ingredient.cost_per_unit))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-200">{ingredient.recipe_count}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ingredient.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-700/40 text-slate-400'}`}>
                          {ingredient.is_active ? t('ingredients.active') : t('ingredients.inactive')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label={t('ingredients.colActions')}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 border-slate-700 bg-slate-800 text-slate-200">
                            <DropdownMenuItem onClick={() => openEdit(ingredient)} className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                              <Pencil className="h-4 w-4 text-blue-400" /> {t('ingredients.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => run(() => setIngredientActive(ingredient.id, !ingredient.is_active))}
                              disabled={pending}
                              className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700"
                            >
                              {ingredient.is_active ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                              {ingredient.is_active ? t('ingredients.deactivate') : t('ingredients.activate')}
                            </DropdownMenuItem>
                            {ingredient.recipe_count === 0 && (
                              <>
                                <DropdownMenuSeparator className="bg-slate-700" />
                                <DropdownMenuItem onClick={() => remove(ingredient)} disabled={pending} className="cursor-pointer gap-2 text-red-400 hover:bg-slate-700 focus:bg-slate-700">
                                  <Trash2 className="h-4 w-4" /> {t('ingredients.delete')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {result && <PageNav meta={result.meta} />}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !pending && setEditing(null)}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('ingredients.newTitle') : t('ingredients.editTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ingredient-name" className="text-sm text-slate-300">{t('ingredients.name')}</label>
              <Input id="ingredient-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('ingredients.namePlaceholder')} maxLength={120} autoFocus className={INPUT_CLASS} />
            </div>
            <div className="space-y-2">
              <label htmlFor="ingredient-unit" className="text-sm text-slate-300">{t('ingredients.unit')}</label>
              <select id="ingredient-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as IngredientUnit })} disabled={unitLocked} className={SELECT_CLASS}>
                {INGREDIENT_UNITS.map((u) => (
                  <option key={u} value={u}>{t(`ingredients.units.${u}`)}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">{unitLocked ? t('ingredients.errors.unitInUse') : t('ingredients.unitHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="ingredient-cost" className="text-sm text-slate-300">{t('ingredients.cost', { unit: unitShort(form.unit) })}</label>
                <Input id="ingredient-cost" type="number" min="0" step="any" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ingredient-threshold" className="text-sm text-slate-300">{t('ingredients.threshold')}</label>
                <Input id="ingredient-threshold" type="number" min="0" step="any" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className={INPUT_CLASS} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-slate-500">{t('ingredients.costHint')}</p>
            {editing === 'new' && (
              <div className="space-y-2">
                <label htmlFor="ingredient-initial" className="text-sm text-slate-300">
                  {t('ingredients.initialStock')} ({unitShort(form.unit)})
                </label>
                <Input id="ingredient-initial" type="number" min="0" step="any" value={form.initial} onChange={(e) => setForm({ ...form, initial: e.target.value })} className={INPUT_CLASS} />
                <p className="text-xs text-slate-500">{t('ingredients.initialStockHint')}</p>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={pending} className="text-slate-300 hover:bg-slate-700">
                {t('ingredients.cancel')}
              </Button>
              <Button type="submit" disabled={pending || !form.name.trim()} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing === 'new' ? t('ingredients.create') : t('ingredients.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
