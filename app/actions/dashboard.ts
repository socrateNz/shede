'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
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
 * Données enrichies pour le dashboard ADMIN / MANAGER / COMPTABLE, du point de la session.
 * Tous les montants sont calculés en SQL (dashboard_summary, heure du Cameroun) : aucune
 * liste de commandes n'est chargée, donc pas de coupure à 1000 lignes.
 */
export async function getDashboardEnrichedData(currency = 'XOF'): Promise<DashboardEnrichedData | null> {
  const session = await getSession();
  if (!session?.structureId || !['ADMIN', 'MANAGER', 'COMPTABLE', 'SUPER_ADMIN'].includes(session.role)) return null;
  const intl = INTL_LOCALES[await getLocale()];
  const { data, error } = await getAdminSupabase().rpc('dashboard_summary', { p_structure_id: session.structureId });
  if (error) console.error('[getDashboardEnrichedData]', error);
  const raw = (data ?? {}) as Record<string, any>;
  const unknownLabel = await te('common.unknown');
  const pending = Number(raw.pendingCount) || 0;

  return {
    todayRevenue: Number(raw.todayRevenue) || 0,
    weekRevenue: Number(raw.weekRevenue) || 0,
    monthRevenue: Number(raw.monthRevenue) || 0,
    avgOrderValue: Number(raw.avgOrderValue) || 0,
    pendingOrdersCount: pending,
    activeOrdersCount: pending + (Number(raw.inProgressCount) || 0),
    dailyRevenue: ((raw.dailyRevenue ?? []) as { date: string; revenue: number }[]).map((d) => ({
      date: d.date,
      // Midi : le libellé reste le bon jour quel que soit le fuseau du serveur.
      label: new Date(`${d.date}T12:00:00`).toLocaleDateString(intl, { weekday: 'short', day: '2-digit' }),
      revenue: Number(d.revenue) || 0,
    })),
    topProducts: ((raw.topProducts ?? []) as any[]).map((p) => ({ product_id: p.product_id, name: p.name || unknownLabel, quantity: Number(p.quantity) || 0 })),
    lowStockItems: ((raw.lowStock ?? []) as any[]).map((l) => ({
      id: l.id,
      name: l.name,
      quantity: Number(l.quantity) || 0,
      threshold: Number(l.threshold) || 0,
      type: l.type === 'accompaniment' ? 'accompaniment' : 'product',
    })),
    currency,
  };
}
