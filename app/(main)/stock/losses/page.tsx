import { requireModule } from '@/app/actions/auth';
import { getStockList } from '@/app/actions/stock';
import { listLosses } from '@/app/actions/stock-control';
import { LossesManager, type LossItemOption } from '@/components/losses-manager';
import { PeriodTabs } from '@/components/period-tabs';
import { parsePeriod, periodRange } from '@/lib/periods';
import { getT } from '@/lib/i18n/server';
import { getAdminSupabase } from '@/lib/supabase';

export default async function LossesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireModule('STOCK');
  const { t } = await getT();
  const period = parsePeriod((await searchParams).period);
  const { from, to } = periodRange(period);

  const [losses, stock, { data: products }] = await Promise.all([
    listLosses(from, to),
    getStockList(),
    // Tous les plats (une perte de plat avec fiche recette sort ses ingrédients)
    getAdminSupabase().from('products').select('id, name').eq('structure_id', session.structureId).eq('is_deleted', false).order('name'),
  ]);

  const items: LossItemOption[] = [
    ...stock.filter((s) => s.type === 'ingredient').map((s) => ({ id: s.id, name: s.name, type: 'ingredient' as const, unit: (s as { unit?: string }).unit ?? null })),
    ...(products || []).map((p) => ({ id: p.id as string, name: p.name as string, type: 'product' as const })),
    ...stock.filter((s) => s.type === 'accompaniment').map((s) => ({ id: s.id, name: s.name, type: 'accompaniment' as const })),
  ];

  return (
    <LossesManager
      losses={losses}
      items={items}
      periodTabs={
        <PeriodTabs
          basePath="/stock/losses"
          current={period}
          labels={{
            d7: t('stockControl.periods.d7'),
            d30: t('stockControl.periods.d30'),
            month: t('stockControl.periods.month'),
            lastMonth: t('stockControl.periods.lastMonth'),
          }}
        />
      }
    />
  );
}
