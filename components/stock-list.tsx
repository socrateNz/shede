'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import { PageNav } from './page-nav';
import { UrlSearch } from './url-filters';
import type { PageMeta } from '@/lib/pagination';
import type { StockListStats } from '@/app/actions/stock';
import { Package, Coffee, Carrot } from 'lucide-react';

interface StockItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  threshold: number;
  type: 'product' | 'accompaniment' | 'ingredient';
  /** Ingrédients : kg, l ou piece. */
  unit?: string;
}

interface StockListProps {
  /** Une page de lignes, déjà filtrée par le serveur. */
  stocks: StockItem[];
  meta: PageMeta<StockListStats>;
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

export function StockList({ stocks, meta }: StockListProps) {
  const { t, format } = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = (searchParams.get('type') ?? 'all') as 'all' | 'product' | 'accompaniment' | 'ingredient';
  // Onglet de type : paramètre d'URL, retour à la page 1, recherche conservée.
  const typeHref = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (key === 'all') params.delete('type');
    else params.set('type', key);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const paginatedStocks = stocks;

  return (
    <div className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl overflow-hidden rounded-xl border">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
        {([
          { key: 'all', label: t('stock.list.filterAll'), icon: undefined },
          { key: 'product', label: t('stock.list.filterProducts'), icon: Package },
          { key: 'accompaniment', label: t('stock.list.filterAccompaniments'), icon: Coffee },
          { key: 'ingredient', label: t('stock.list.filterIngredients'), icon: Carrot },
        ] as const).map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={typeHref(key)}
            scroll={false}
            aria-current={filter === key ? 'true' : undefined}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              filter === key
                ? key === 'product'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : key === 'accompaniment'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : key === 'ingredient'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-600 text-slate-200 border border-slate-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
            <span className="ml-1 text-[10px] opacity-70">
              ({format.number(key === 'all' ? meta.stats.total : meta.stats.byType[key])})
            </span>
          </Link>
        ))}
        <UrlSearch placeholder={t('stock.list.search')} className="ml-auto w-full sm:w-64" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.list.colName')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.list.colType')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.list.colCategory')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">{t('stock.list.colQuantity')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">{t('stock.list.colThreshold')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-right">{t('stock.list.colStatus')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {paginatedStocks.map((item) => (
              <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4">
                  <div className="font-medium text-slate-200">{item.name}</div>
                </td>
                <td className="p-4">
                  {item.type === 'product' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Package className="w-3 h-3" />
                      {t('stock.itemType.product')}
                    </span>
                  ) : item.type === 'ingredient' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Carrot className="w-3 h-3" />
                      {t('stock.itemType.ingredient')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Coffee className="w-3 h-3" />
                      {t('stock.itemType.accompaniment')}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-400">
                    {item.type === 'product' ? (item.category || t('stock.list.notApplicable')) : '—'}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <span className={cn(
                    "font-bold text-lg",
                    item.quantity <= item.threshold ? "text-amber-500" : "text-slate-50"
                  )}>
                    {format.number(item.quantity, { maximumFractionDigits: 3 })}
                  </span>
                  {item.unit && <span className="ml-1 text-xs text-slate-500">{t(`ingredients.unitShort.${item.unit as 'kg' | 'l' | 'piece'}`)}</span>}
                </td>
                <td className="p-4 text-center text-slate-400 text-sm">
                  {item.threshold}
                </td>
                <td className="p-4 text-right">
                  {item.quantity <= 0 ? (
                    <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                      {t('stock.list.outOfStock')}
                    </span>
                  ) : item.quantity <= item.threshold ? (
                    <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                      {t('stock.list.low')}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
                      {t('stock.list.ok')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {paginatedStocks.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  {t('stock.list.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PageNav meta={meta} />
    </div>
  );
}
