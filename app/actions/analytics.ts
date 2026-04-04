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

    let totalOrderRevenue = (globalPayments || []).reduce((sum, p) => sum + p.amount, 0);

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
      const method = String(p.payment_method || 'UNKNOWN');
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

  // Admin logic (specific to structure)
  let adminOrdersQuery = admin
    .from('orders')
    .select('*, payments(*)')
    .eq('structure_id', structureId)
    .eq('status', 'COMPLETED');

  if (startDate) adminOrdersQuery = adminOrdersQuery.gte('created_at', startDate);
  const { data: orders } = await adminOrdersQuery;

  let adminPaidBookingsQuery = admin
    .from('bookings')
    .select('total_amount, status, is_paid, rooms!inner(structure_id)')
    .eq('rooms.structure_id', structureId)
    .or(`status.eq.COMPLETED,is_paid.eq.true`);

  if (startDate) adminPaidBookingsQuery = adminPaidBookingsQuery.gte('created_at', startDate);
  const { data: paidBookings } = await adminPaidBookingsQuery;

  let orderRevenue = (orders || []).reduce((sum, order) => {
    const payments = order.payments || [];
    return sum + payments.reduce((pSum: number, p: any) => pSum + p.amount, 0);
  }, 0);

  let hotelRevenue = (paidBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  let totalRevenue = orderRevenue + hotelRevenue;

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

  const averageOrderValue = (orders?.length || 0) > 0 ? totalRevenue / (orders!.length) : 0;

  const paymentsByMethod: Record<string, number> = {};
  (orders || []).forEach((order) => {
    const payments = order.payments || [];
    payments.forEach((payment: any) => {
      const method = payment.payment_method || 'UNKNOWN';
      paymentsByMethod[method] = (paymentsByMethod[method] || 0) + payment.amount;
    });
  });

  let adminAllOrdersQuery = admin
    .from('orders')
    .select('status')
    .eq('structure_id', structureId);

  if (startDate) adminAllOrdersQuery = adminAllOrdersQuery.gte('created_at', startDate);
  const { data: allOrders } = await adminAllOrdersQuery;

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
    completedOrdersCount: orders?.length || 0,
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
