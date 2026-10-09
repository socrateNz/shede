'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

type AnalyticsSummary = {
  orderRevenue: number;
  ordersCount: number;
  completedOrdersCount: number;
  ordersByStatus: Record<string, number>;
  hotelRevenue: number;
  bookingsCount: number;
  bookingsByStatus: Record<string, number>;
  paymentsByMethod: Record<string, number>;
};

const numbers = (record: Record<string, unknown> | null | undefined) =>
  Object.fromEntries(Object.entries(record ?? {}).map(([k, v]) => [k, Number(v) || 0])) as Record<string, number>;

/**
 * Statistiques de la page Statistiques. Le périmètre vient de la session (jamais du
 * navigateur) : toute la plateforme pour le super-admin, le point de la session pour
 * un admin. Tous les totaux sont calculés en SQL (analytics_summary).
 */
export async function getAnalyticsData(range: string = '30') {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) return null;
  const global = session.role === 'SUPER_ADMIN';
  if (!global && !session.structureId) return null;

  const admin = getAdminSupabase();
  let startDate: string | null = null;
  if (range !== 'all') {
    const days = Number.parseInt(range, 10);
    const date = new Date();
    date.setDate(date.getDate() - (Number.isFinite(days) && days > 0 ? days : 30));
    startDate = date.toISOString();
  }

  const { data, error } = await admin.rpc('analytics_summary', { p_structure_id: global ? null : session.structureId, p_since: startDate });
  if (error) console.error('[getAnalyticsData]', error);
  const raw = (data ?? {}) as Partial<AnalyticsSummary>;
  const s: AnalyticsSummary = {
    orderRevenue: Number(raw.orderRevenue) || 0,
    ordersCount: Number(raw.ordersCount) || 0,
    completedOrdersCount: Number(raw.completedOrdersCount) || 0,
    ordersByStatus: numbers(raw.ordersByStatus),
    hotelRevenue: Number(raw.hotelRevenue) || 0,
    bookingsCount: Number(raw.bookingsCount) || 0,
    bookingsByStatus: numbers(raw.bookingsByStatus),
    paymentsByMethod: numbers(raw.paymentsByMethod),
  };
  const totalRevenue = s.orderRevenue + s.hotelRevenue;

  if (global) {
    let structuresQuery = admin.from('structures').select('id', { count: 'exact', head: true });
    if (startDate) structuresQuery = structuresQuery.gte('created_at', startDate);
    const { count: newStructuresCount } = await structuresQuery;
    return {
      type: 'SUPER_ADMIN' as const,
      totalRevenue,
      hotelRevenue: s.hotelRevenue,
      orderRevenue: s.orderRevenue,
      completedOrdersCount: s.ordersCount,
      totalBookingsCount: s.bookingsCount,
      averageOrderValue: s.ordersCount > 0 ? totalRevenue / s.ordersCount : 0,
      newStructuresCount: newStructuresCount || 0,
      paymentsByMethod: s.paymentsByMethod,
      ordersByStatus: s.ordersByStatus,
      bookingsByStatus: s.bookingsByStatus,
    };
  }

  const { count: productCount } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('structure_id', session.structureId!)
    .eq('is_deleted', false);

  return {
    type: 'ADMIN' as const,
    totalRevenue,
    hotelRevenue: s.hotelRevenue,
    orderRevenue: s.orderRevenue,
    completedOrdersCount: s.completedOrdersCount,
    totalBookingsCount: s.bookingsCount,
    averageOrderValue: s.completedOrdersCount > 0 ? s.orderRevenue / s.completedOrdersCount : 0,
    productCount: productCount || 0,
    paymentsByMethod: s.paymentsByMethod,
    ordersByStatus: s.ordersByStatus,
    bookingsByStatus: s.bookingsByStatus,
  };
}

/** Changement de période depuis l'écran : même périmètre, déterminé par la session. */
export async function fetchClientAnalyticsData(range: string) {
  return getAnalyticsData(range);
}
