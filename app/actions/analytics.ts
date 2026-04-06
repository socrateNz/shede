'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function getAnalyticsData(structureId: string, role: string, range: string = '30') {
  const admin = getAdminSupabase();
  let startDate: string | null = null;

  if (range !== 'all') {
    const days = parseInt(range);
    const date = new Date();
    date.setDate(date.getDate() - days);
    startDate = date.toISOString();
  }

  if (role === 'SUPER_ADMIN') {
    let paymentsQuery = admin
      .from('payments')
      .select('amount, payment_method')
      .eq('status', 'COMPLETED');

    if (startDate) {
      paymentsQuery = paymentsQuery.gte('created_at', startDate);
    }

    const { data: globalPayments } = await paymentsQuery;

    let globalCompletedOrdersQuery = admin
      .from('orders')
      .select('total, status');

    if (startDate) {
      globalCompletedOrdersQuery = globalCompletedOrdersQuery.gte('created_at', startDate);
    }

    const { data: globalOrders } = await globalCompletedOrdersQuery;
    let totalOrderRevenue = (globalOrders || []).filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    let bookingsRevenueQuery = admin
      .from('bookings')
      .select('total_amount, status, is_paid')
      .or(`status.eq.COMPLETED,is_paid.eq.true`);

    if (startDate) {
      bookingsRevenueQuery = bookingsRevenueQuery.gte('created_at', startDate);
    }

    const { data: globalBookings } = await bookingsRevenueQuery;

    let totalHotelRevenue = (globalBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

    const paymentsByMethod: Record<string, number> = {};
    (globalPayments || []).forEach((p) => {
      const method = String(p.payment_method || 'AUTRE');
      paymentsByMethod[method] = (paymentsByMethod[method] || 0) + p.amount;
    });

    let ordersQuery = admin.from('orders').select('status');
    if (startDate) ordersQuery = ordersQuery.gte('created_at', startDate);
    const { data: allOrders } = await ordersQuery;

    const ordersByStatus: Record<string, number> = {};
    (allOrders || []).forEach((order) => {
      const status = String(order.status || 'UNKNOWN');
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    let bookingsStatusQuery = admin.from('bookings').select('status');
    if (startDate) bookingsStatusQuery = bookingsStatusQuery.gte('created_at', startDate);
    const { data: allBookings } = await bookingsStatusQuery;

    const bookingsByStatus: Record<string, number> = {};
    (allBookings || []).forEach((booking) => {
      const status = String(booking.status || 'UNKNOWN');
      bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
    });

    let structuresQuery = admin.from('structures').select('*', { count: 'exact', head: true });
    if (startDate) structuresQuery = structuresQuery.gte('created_at', startDate);
    const { count: newStructuresCount } = await structuresQuery;

    return {
      type: 'SUPER_ADMIN',
      totalRevenue: totalOrderRevenue + totalHotelRevenue,
      hotelRevenue: totalHotelRevenue,
      orderRevenue: totalOrderRevenue,
      completedOrdersCount: allOrders?.length || 0,
      totalBookingsCount: allBookings?.length || 0,
      averageOrderValue: allOrders && allOrders.length > 0 ? (totalOrderRevenue + totalHotelRevenue) / allOrders.length : 0,
      newStructuresCount: newStructuresCount || 0,
      paymentsByMethod,
      ordersByStatus,
      bookingsByStatus,
    };
  }

  // Re-calcul des revenus pour l'ADMIN (Restaurant + Hotel)
  // 1. Revenu Restaurant: somme des totaux des commandes COMPLETED (plus fiable que payments)
  let adminOrdersQuery = admin
    .from('orders')
    .select('total, status, created_at')
    .eq('structure_id', structureId);

  if (startDate) adminOrdersQuery = adminOrdersQuery.gte('created_at', startDate);
  const { data: allOrders } = await adminOrdersQuery;

  // 2. Revenu Hotel: toutes les réservations payées ou complétées liée à la structure
  let adminBookingsQuery = admin
    .from('bookings')
    .select('total_amount, status, is_paid, rooms!inner(structure_id)')
    .eq('rooms.structure_id', structureId)
    .or(`status.eq.COMPLETED,is_paid.eq.true`);

  if (startDate) adminBookingsQuery = adminBookingsQuery.gte('created_at', startDate);
  const { data: paidBookings } = await adminBookingsQuery;

  let orderRevenue = (allOrders || []).filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  let hotelRevenue = (paidBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  let totalRevenue = orderRevenue + hotelRevenue;

  // breakdown par méthode de paiement (depuis la table payments)
  let adminPaymentsQuery = admin
    .from('payments')
    .select('amount, payment_method, orders!inner(structure_id)')
    .eq('orders.structure_id', structureId)
    .eq('status', 'COMPLETED');

  if (startDate) adminPaymentsQuery = adminPaymentsQuery.gte('created_at', startDate);
  const { data: completedPayments } = await adminPaymentsQuery;

  const paymentsByMethod: Record<string, number> = {};
  (completedPayments || []).forEach((payment: any) => {
    const method = payment.payment_method || 'AUTRE';
    paymentsByMethod[method] = (paymentsByMethod[method] || 0) + payment.amount;
  });

  let completedOrdersCount = allOrders?.filter(o => o.status === 'COMPLETED').length || 0;
  const averageOrderValue = completedOrdersCount > 0 ? orderRevenue / completedOrdersCount : 0;

  // Récupérer les stats des réservations
  let adminAllBookingsQuery = admin
    .from('bookings')
    .select('status, rooms!inner(structure_id)')
    .eq('rooms.structure_id', structureId);

  if (startDate) adminAllBookingsQuery = adminAllBookingsQuery.gte('created_at', startDate);
  const { data: allBookings } = await adminAllBookingsQuery;

  const bookingsByStatus: Record<string, number> = {};
  (allBookings || []).forEach((booking) => {
    const status = booking.status || 'UNKNOWN';
    bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
  });

  const { count: productCount } = await admin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', structureId)
    .eq('is_deleted', false);

  const ordersByStatus: Record<string, number> = {};
  (allOrders || []).forEach((order) => {
    const status = order.status || 'UNKNOWN';
    ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
  });

  return {
    type: 'ADMIN',
    totalRevenue,
    hotelRevenue,
    orderRevenue,
    completedOrdersCount: completedOrdersCount,
    totalBookingsCount: allBookings?.length || 0,
    averageOrderValue,
    productCount: productCount || 0,
    paymentsByMethod,
    ordersByStatus,
    bookingsByStatus,
  };
}

export async function fetchClientAnalyticsData(range: string) {
  const session = await getSession();
  if (!session) return null;
  return getAnalyticsData(session.structureId!, session.role as string, range);
}
