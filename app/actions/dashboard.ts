'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getLocale, te } from '@/lib/i18n/server';
import { INTL_LOCALES } from '@/lib/i18n/config';

export interface DailyRevenuePoint {
  date: string;
  revenue: number;
  label: string;
}

export interface TopProduct {
  product_id: string;
  name: string;
  quantity: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  quantity: number;
  threshold: number;
  type: 'product' | 'accompaniment';
}

export interface DashboardEnrichedData {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  avgOrderValue: number;
  pendingOrdersCount: number;
  activeOrdersCount: number;
  dailyRevenue: DailyRevenuePoint[];
  topProducts: TopProduct[];
  lowStockItems: LowStockItem[];
  currency: string;
}

/**
 * Données enrichies pour le dashboard ADMIN / MANAGER / COMPTABLE.
 * Utilise le service role — appelé uniquement depuis des Server Components.
 */
export async function getDashboardEnrichedData(
  structureId: string,
  currency = 'XOF'
): Promise<DashboardEnrichedData> {
  const admin = getAdminSupabase();
  const now = new Date();
  const intl = INTL_LOCALES[await getLocale()];

  // Plages de dates
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Dimanche
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const last7DaysStart = new Date(now);
  last7DaysStart.setDate(now.getDate() - 6);
  last7DaysStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // --------------------------------------------------------
  // 1. Revenus (commandes COMPLETED via paid_at)
  // --------------------------------------------------------
  const { data: recentCompletedOrders } = await admin
    .from('orders')
    .select('id, total, paid_at')
    .eq('structure_id', structureId)
    .eq('status', 'COMPLETED')
    .gte('paid_at', last7DaysStart.toISOString());

  const allCompletedOrders = recentCompletedOrders || [];

  const todayRevenue = allCompletedOrders
    .filter((o) => o.paid_at && new Date(o.paid_at) >= todayStart)
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const weekRevenue = allCompletedOrders
    .filter((o) => o.paid_at && new Date(o.paid_at) >= weekStart)
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // Mois courant (requête séparée car > 7 jours)
  const { data: monthOrders } = await admin
    .from('orders')
    .select('total')
    .eq('structure_id', structureId)
    .eq('status', 'COMPLETED')
    .gte('paid_at', monthStart.toISOString());

  const monthRevenue = (monthOrders || []).reduce(
    (sum, o) => sum + (Number(o.total) || 0),
    0
  );

  // Ticket moyen (30 derniers jours)
  const { data: thirtyDaysOrders } = await admin
    .from('orders')
    .select('total')
    .eq('structure_id', structureId)
    .eq('status', 'COMPLETED')
    .gte('paid_at', thirtyDaysAgo.toISOString());

  const thirtyDaysList = thirtyDaysOrders || [];
  const avgOrderValue =
    thirtyDaysList.length > 0
      ? thirtyDaysList.reduce((sum, o) => sum + (Number(o.total) || 0), 0) /
        thirtyDaysList.length
      : 0;

  // --------------------------------------------------------
  // 2. Commandes en cours (PENDING + IN_PROGRESS)
  // --------------------------------------------------------
  const { count: pendingCount } = await admin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId)
    .eq('status', 'PENDING');

  const { count: inProgressCount } = await admin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId)
    .eq('status', 'IN_PROGRESS');

  // --------------------------------------------------------
  // 3. Graphique CA — 7 derniers jours
  // --------------------------------------------------------
  const dailyRevenue: DailyRevenuePoint[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const dayRevenue = allCompletedOrders
      .filter((o) => {
        if (!o.paid_at) return false;
        const t = new Date(o.paid_at).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      })
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return {
      date: d.toISOString().split('T')[0],
      label: d.toLocaleDateString(intl, { weekday: 'short', day: '2-digit' }),
      revenue: dayRevenue,
    };
  });

  // --------------------------------------------------------
  // 4. Top 5 produits vendus (30 derniers jours)
  // --------------------------------------------------------
  let topProducts: TopProduct[] = [];
  const orderIds = thirtyDaysList.length > 0
    ? (
        await admin
          .from('orders')
          .select('id')
          .eq('structure_id', structureId)
          .eq('status', 'COMPLETED')
          .gte('paid_at', thirtyDaysAgo.toISOString())
      ).data?.map((o: any) => o.id) || []
    : [];

  if (orderIds.length > 0) {
    const { data: items } = await admin
      .from('order_items')
      .select('product_id, quantity, products(name)')
      .in('order_id', orderIds.slice(0, 500));

    const productMap = new Map<string, { name: string; quantity: number }>();
    const unknownLabel = await te('common.unknown');
    (items || []).forEach((item: any) => {
      const existing = productMap.get(item.product_id);
      if (existing) {
        existing.quantity += Number(item.quantity) || 0;
      } else {
        productMap.set(item.product_id, {
          name: item.products?.name || unknownLabel,
          quantity: Number(item.quantity) || 0,
        });
      }
    });

    topProducts = Array.from(productMap.entries())
      .map(([product_id, v]) => ({ product_id, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  // --------------------------------------------------------
  // 5. Stock bas (quantité <= seuil)
  // --------------------------------------------------------
  const { data: stockData } = await admin
    .from('stocks')
    .select('id, quantity, threshold, product_id, accompaniment_id, products(name), accompaniments(name)')
    .eq('structure_id', structureId);

  const lowStockItems: LowStockItem[] = (stockData || [])
    .filter((s: any) => Number(s.quantity) <= Number(s.threshold ?? 5))
    .map((s: any) => ({
      id: s.id,
      name: (s.products?.name ?? s.accompaniments?.name ?? '—') as string,
      quantity: Number(s.quantity),
      threshold: Number(s.threshold ?? 5),
      type: (s.accompaniment_id ? 'accompaniment' : 'product') as 'product' | 'accompaniment',
    }))
    .slice(0, 8);


  return {
    todayRevenue,
    weekRevenue,
    monthRevenue,
    avgOrderValue,
    pendingOrdersCount: pendingCount || 0,
    activeOrdersCount: (pendingCount || 0) + (inProgressCount || 0),
    dailyRevenue,
    topProducts,
    lowStockItems,
    currency,
  };
}
