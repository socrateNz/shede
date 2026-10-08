'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecipeEditor } from '@/components/recipe-editor';
import type { FoodCostRow } from '@/app/actions/recipes';
import { FOOD_COST_TARGET_PERCENT } from '@/lib/recipes';
import type { TaxSettings } from '@/lib/tax';
import { useT } from '@/lib/i18n/client';

type Filter = 'all' | 'missing' | 'above';

/** Coût matière de chaque produit et accompagnement, avec accès direct à sa fiche recette. */
export function FoodCostReport({ rows, taxSettings }: { rows: FoodCostRow[] | null; taxSettings: TaxSettings }) {
  const { t, format } = useT();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<FoodCostRow | null>(null);
  const list = rows ?? [];

  const withRecipe = list.filter((r) => r.cost !== null);
  const above = withRecipe.filter((r) => r.percent !== null && r.percent > FOOD_COST_TARGET_PERCENT);
  // Moyenne pondérée par le prix : coût total / prix HT total des articles avec fiche
  const totalNet = withRecipe.reduce((s, r) => s + r.priceExcludingTax, 0);
  const average = totalNet > 0 ? Math.round((withRecipe.reduce((s, r) => s + (r.cost ?? 0), 0) / totalNet) * 1000) / 10 : null;

  const visible = useMemo(() => {
    if (filter === 'missing') return list.filter((r) => r.cost === null);
    if (filter === 'above') return list.filter((r) => r.percent !== null && r.percent > FOOD_COST_TARGET_PERCENT);
    return list;
  }, [list, filter]);

  if (rows === null) {
    return (
      <div className="flex-1 p-4 md:p-8">
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('foodCost.notInstalled')}</p>
      </div>
    );
  }

  const filters: [Filter, string][] = [
    ['all', t('foodCost.filterAll')],
    ['missing', t('foodCost.filterMissing')],
    ['above', t('foodCost.filterAbove')],
  ];

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('foodCost.title')}</h1>
        <p className="max-w-2xl text-slate-400">{t('foodCost.subtitle')}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('foodCost.statCoverage')}</p>
          <p className="mt-1 text-3xl font-bold text-white">{t('foodCost.coverage', { count: withRecipe.length, total: list.length })}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('foodCost.statAverage')}</p>
          <p className="mt-1 text-3xl font-bold text-white">{average === null ? '—' : `${format.number(average)} %`}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('foodCost.statAbove', { percent: FOOD_COST_TARGET_PERCENT })}</p>
          <p className={`mt-1 text-3xl font-bold ${above.length ? 'text-amber-400' : 'text-emerald-400'}`}>{above.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
        <div className="flex flex-wrap gap-2 border-b border-slate-700/50 p-4">
          {filters.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === key ? 'border-orange-500 bg-orange-500/20 text-orange-200' : 'border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">{t('foodCost.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-300">{t('foodCost.colItem')}</TableHead>
                <TableHead className="font-semibold text-slate-300">{t('foodCost.colType')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('foodCost.colPrice')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('foodCost.colPriceHT')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('foodCost.colCost')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('foodCost.colMargin')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('foodCost.colPercent')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('foodCost.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const over = row.percent !== null && row.percent > FOOD_COST_TARGET_PERCENT;
                return (
                  <TableRow key={`${row.type}-${row.id}`} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="font-medium text-slate-50">{row.name}</TableCell>
                    <TableCell className="text-slate-400">{row.type === 'product' ? t('foodCost.product') : t('foodCost.accompaniment')}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">{format.money(row.price)}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">{format.money(row.priceExcludingTax)}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-200">
                      {row.cost === null ? <span className="text-xs text-slate-500">{t('foodCost.noRecipe')}</span> : format.money(row.cost)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${row.margin !== null && row.margin < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                      {row.margin === null ? '—' : format.money(row.margin)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.percent === null ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${over ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                          {format.number(row.percent)} %
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(row)} className="text-orange-300 hover:bg-slate-700">
                        <ChefHat className="mr-1.5 h-4 w-4" />
                        {row.cost === null ? t('foodCost.createRecipe') : t('foodCost.editRecipe')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t('recipes.title')} — {editing?.name}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <RecipeEditor
              compact
              owner={editing.type === 'product' ? { productId: editing.id } : { accompanimentId: editing.id }}
              price={editing.price}
              taxSettings={taxSettings}
              onSaved={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
