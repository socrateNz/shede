import { requireModule } from '@/app/actions/auth';
import { listStockMovements } from '@/app/actions/stock';
import { parsePage } from '@/lib/pagination';
import { UrlSelect } from '@/components/url-filters';
import { History } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StockMovementsList } from '@/components/stock-movements-list';
import { getT } from '@/lib/i18n/server';

export default async function StockMovementsPage({ searchParams }: { searchParams: Promise<{ page?: string; direction?: string; kind?: string }> }) {
  await requireModule('STOCK');
  const { t, format } = await getT();
  const params = await searchParams;
  // 20 mouvements par page ; compteurs calculés en SQL sur tout l'historique.
  const { items: movements, meta } = await listStockMovements({ page: parsePage(params.page), direction: params.direction, kind: params.kind });
  const { stats } = meta;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-3">
            <History className="w-8 h-8 text-blue-500" />
            {t('stock.movements.title')}
          </h1>
          <p className="text-slate-400">{t('stock.movements.subtitle')}</p>
        </div>
        <Link href="/stock">
          <Button variant="outline">
            {t('stock.movements.back')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('stock.movements.statTotal'), value: stats.total, tone: 'text-slate-50' },
          { label: t('stock.movements.statIn'), value: stats.in, tone: 'text-emerald-400' },
          { label: t('stock.movements.statOut'), value: stats.out, tone: 'text-red-400' },
          { label: t('stock.movements.statAdjustment'), value: stats.adjustment, tone: 'text-amber-400' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
            <div className="text-sm text-slate-400">{card.label}</div>
            <div className={`text-2xl font-bold ${card.tone}`}>{format.number(card.value)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <UrlSelect
          param="direction"
          label={t('stock.movements.allDirections')}
          options={[
            { value: '', label: t('stock.movements.allDirections') },
            { value: 'IN', label: t('stock.movements.statIn') },
            { value: 'OUT', label: t('stock.movements.statOut') },
            { value: 'ADJUSTMENT', label: t('stock.movements.statAdjustment') },
          ]}
        />
        <UrlSelect
          param="kind"
          label={t('stock.list.filterAll')}
          options={[
            { value: '', label: t('stock.list.filterAll') },
            { value: 'product', label: t('stock.list.filterProducts') },
            { value: 'accompaniment', label: t('stock.list.filterAccompaniments') },
            { value: 'ingredient', label: t('stock.list.filterIngredients') },
          ]}
        />
      </div>

      <StockMovementsList movements={movements as any} meta={meta} />
    </div>
  );
}

