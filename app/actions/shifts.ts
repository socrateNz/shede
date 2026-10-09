'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { buildMeta, emptyPage, pageRange, settlePage, type Paginated } from '@/lib/pagination';
import { revalidatePath } from 'next/cache';
import { te } from '@/lib/i18n/server';
import { notifyStructureStaff } from '@/lib/notifications';

// The `structures.modules` column has drifted schema (TEXT[] vs JSONB) across
// migrations, and has been seen holding stray stringified-JSON fragments
// (e.g. '["POS"') alongside clean values. Filter to known keys and dedupe
// before trusting it anywhere.
const KNOWN_MODULES = ['POS', 'CLIENT_APP', 'CUISINE', 'BAR', 'LIVRAISON', 'TABLES', 'HOTEL', 'STOCK', 'PROMOTION', 'RH', 'CRM'];

// Shared by closeShift() and getShiftReport() so the "théorique" revenue used to
// close the till and the figures shown on the printed report can never drift apart.
async function getShiftTransactions(admin: any, structureId: string, windowStart: string, windowEnd: string) {
  const { data: allOrders } = await admin
    .from('orders')
    .select('id, total, subtotal, tax, discount_amount, status, paid_at, updated_at, table_number, room_id, guest_name, rooms(number), order_items(quantity, products(name))')
    .eq('structure_id', structureId)
    .eq('status', 'COMPLETED')
    .gte('paid_at', windowStart)
    .lte('paid_at', windowEnd);

  const orders = allOrders || [];

  const { data: allBookings } = await admin
    .from('bookings')
    .select('*, rooms(number, type, structure_id)')
    .eq('is_paid', true)
    .gte('updated_at', windowStart)
    .lte('updated_at', windowEnd);

  const bookings = (allBookings || []).filter((b: any) => b.rooms?.structure_id === structureId);

  const orderRevenue = orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
  const bookingRevenue = bookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
  const totalDiscounts = orders.reduce((sum: number, o: any) => sum + (Number(o.discount_amount) || 0), 0);
  // TVA collectée (incluse dans les montants encaissés).
  const totalTax =
    orders.reduce((sum: number, o: any) => sum + (Number(o.tax) || 0), 0) +
    bookings.reduce((sum: number, b: any) => sum + (Number(b.tax_amount) || 0), 0);

  return { orders, bookings, orderRevenue, bookingRevenue, totalDiscounts, totalTax };
}

export async function getActiveShift() {
  const session = await getSession();
  if (!session?.userId) return null;

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('shifts')
    .select('*')
    .eq('user_id', session.userId)
    .eq('status', 'OPEN')
    .maybeSingle();

  if (error) {
    console.error('Error fetching active shift:', error);
    return null;
  }
  return data;
}

export async function openShift(openingBalance: number) {
  const session = await getSession();
  if (!session?.userId || !session?.structureId) return { success: false, error: await te('errors.unauthorized') };

  // Only Admin or Caisse can open a shift
  if (!['ADMIN', 'SUPER_ADMIN', 'CAISSE'].includes(session.role)) {
    return { success: false, error: await te('errors.openShiftRoles') };
  }

  const admin = getAdminSupabase();
  
  // Check if a shift is already open
  const existing = await getActiveShift();
  if (existing) return { success: false, error: await te('errors.shiftAlreadyOpen') };

  const { data, error } = await admin
    .from('shifts')
    .insert({
      user_id: session.userId,
      structure_id: session.structureId,
      opening_balance: openingBalance,
      status: 'OPEN',
      opened_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[shifts]', error.message);
    return { success: false, error: await te('errors.unexpected') };
  }
  
  revalidatePath('/');
  return { success: true, shift: data };
}

export async function closeShift(actualAmount: number, notes: string) {
  const session = await getSession();
  const activeShift = await getActiveShift();
  
  if (!session || !activeShift) return { success: false, error: await te('errors.noActiveShift') };

  // Only Admin or Caisse can close a shift
  if (!['ADMIN', 'SUPER_ADMIN', 'CAISSE'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  const admin = getAdminSupabase();
  const now = new Date().toISOString();

  const safetyStartTime = new Date(new Date(activeShift.opened_at).getTime() - 60000).toISOString();

  const { orderRevenue, bookingRevenue } = await getShiftTransactions(
    admin,
    session.structureId as string,
    safetyStartTime,
    now
  );

  const totalRevenueGenerated = orderRevenue + bookingRevenue;
  const expectedAmount = Number(activeShift.opening_balance) + totalRevenueGenerated;
  const difference = actualAmount - expectedAmount;

  const { data, error } = await admin
    .from('shifts')
    .update({
      closed_at: now,
      expected_amount: expectedAmount,
      actual_amount: actualAmount,
      difference: difference,
      status: 'CLOSED',
      notes: notes,
    })
    .eq('id', activeShift.id)
    .select()
    .single();

  if (error) {
    console.error('[shifts]', error.message);
    return { success: false, error: await te('errors.unexpected') };
  }

  // Écart entre le fond compté et le fond attendu : le responsable doit le voir
  if (Math.round(difference) !== 0) {
    await notifyStructureStaff({
      structureId: session.structureId as string,
      roles: ['ADMIN', 'MANAGER'],
      excludeUserId: session.userId,
      message: ({ t, format }) => ({
        title: t('notify.shiftVariance.title'),
        body: t(difference < 0 ? 'notify.shiftVariance.short' : 'notify.shiftVariance.over', {
          amount: format.money(Math.abs(difference)),
          expected: format.money(expectedAmount),
          actual: format.money(actualAmount),
        }),
      }),
      url: '/shifts',
    });
  }

  revalidatePath('/');
  return { success: true, shift: data };
}

export async function getShiftReport(shiftId: string) {
  const session = await getSession();
  if (!session) return null;

  const admin = getAdminSupabase();

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .select('*, users(first_name, last_name), structures(*)')
    .eq('id', shiftId)
    .single();

  if (shiftError) return null;

  // Personnel du point, propriétaire de l'organisation ou super admin uniquement.
  const canRead =
    session.role === 'SUPER_ADMIN' ||
    session.structureId === shift.structure_id ||
    (session.role === 'ORG_ADMIN' &&
      Boolean(session.organizationId) &&
      shift.structures?.organization_id === session.organizationId);
  if (!canRead) return null;

  const shiftOpening = new Date(shift.opened_at).getTime();
  const shiftClosing = new Date(shift.closed_at || new Date()).getTime() + 60000;
  const windowStart = new Date(shiftOpening - 60000).toISOString();
  const windowEnd = new Date(shiftClosing).toISOString();

  // Same helper used at close-time, so the printed report can never disagree
  // with the "théorique" amount the till was actually closed against.
  const { orders, bookings, orderRevenue, bookingRevenue, totalDiscounts, totalTax } =
    await getShiftTransactions(admin, shift.structure_id, windowStart, windowEnd);

  const orderIds = Array.from(new Set(orders.map((o: any) => o.id)));

  // Breakdown by payment method (from payments table, linked to orders in shift)
  const { data: shiftPayments } = orderIds.length > 0
    ? await admin
        .from('payments')
        .select('amount, payment_method, order_id')
        .in('order_id', orderIds)
        .eq('status', 'COMPLETED')
    : { data: [] };

  const paymentMethods: Record<string, number> = {};
  shiftPayments?.forEach((p: any) => {
    const method = p.payment_method || 'AUTRE';
    paymentMethods[method] = (paymentMethods[method] || 0) + Number(p.amount);
  });

  const openingBalance = Number(shift.opening_balance) || 0;
  const netSales = orderRevenue + bookingRevenue;
  const grossSales = netSales + totalDiscounts;
  const expectedAmount = openingBalance + netSales;
  const actualAmount = shift.actual_amount !== null ? Number(shift.actual_amount) : null;
  const difference = actualAmount !== null ? actualAmount - expectedAmount : null;

  const rawModules: string[] = Array.isArray(shift.structures?.modules) ? shift.structures.modules : [];
  const cleanModules = Array.from(new Set(rawModules.filter((m) => KNOWN_MODULES.includes(m))));
  const modules = cleanModules.length > 0 ? cleanModules : ['POS'];

  return {
    shift,
    orders,
    bookings,
    paymentMethods,
    modules,
    summary: {
      openingBalance,
      orderRevenue,
      orderCount: orders.length,
      bookingRevenue,
      bookingCount: bookings.length,
      totalDiscounts,
      totalTax,
      grossSales,
      netSales,
      expectedAmount,
      actualAmount,
      difference,
    },
  };
}

export type ShiftListStats = { total: number; negative: number; open: number };

/** Sessions de caisse du point de la session, 20 par page (les plus récentes d'abord) ; statistiques en SQL. */
export async function listShifts(filters: { page?: number; status?: string | null } = {}): Promise<Paginated<any, ShiftListStats>> {
  const empty: ShiftListStats = { total: 0, negative: 0, open: 0 };
  const session = await getSession();
  const page = Math.max(1, filters.page ?? 1);
  if (!session?.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);

  let query = admin
    .from('shifts')
    .select('*, users(first_name, last_name)', { count: 'exact' })
    .eq('structure_id', session.structureId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (filters.status === 'OPEN' || filters.status === 'CLOSED') query = query.eq('status', filters.status);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('shift_list_stats', { p_structure_id: session.structureId })]);
  if (error) console.error('Error fetching all shifts:', error);
  const raw = (statsRes.data ?? empty) as ShiftListStats;
  const stats: ShiftListStats = { total: Number(raw.total) || 0, negative: Number(raw.negative) || 0, open: Number(raw.open) || 0 };
  return { items: data ?? [], meta: buildMeta(page, count ?? 0, stats) };
}
