'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';

export async function getSidebarCounts() {
  const session = await getSession();
  if (!session) return { orders: 0, stock: 0, bookings: 0, notifications: 0 };

  try {
    const admin = getAdminSupabase();
    const structureId = session.structureId;
    const userId = session.userId;

    // 1. Pending Orders
    const { count: ordersCount } = await admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .eq('status', 'PENDING');

    // 2. Unread Notifications
    const { count: notificationsCount } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('structure_id', structureId)
      .eq('is_read', false);

    // 3. Pending Bookings (if HOTEL module is active)
    let bookingsCount = 0;
    if (session.modules?.includes('HOTEL')) {
      const { count } = await admin
        .from('bookings')
        .select('id, rooms!inner(structure_id)', { count: 'exact', head: true })
        .eq('rooms.structure_id', structureId)
        .eq('status', 'PENDING');
      bookingsCount = count || 0;
    }

    // 4. Low Stock (if STOCK module is active)
    // We count products AND accompaniments whose effective stock is below threshold.
    // Items with no row in `stocks` are treated as quantity = 0 (below any threshold).
    let stockCount = 0;
    if (session.modules?.includes('STOCK')) {
      const [{ data: productsData }, { data: accompData }] = await Promise.all([
        admin
          .from('products')
          .select('id, stocks(quantity, threshold)')
          .eq('structure_id', structureId)
          .eq('is_deleted', false),
        admin
          .from('accompaniments')
          .select('id, stocks(quantity, threshold)')
          .eq('structure_id', structureId)
          .eq('is_deleted', false)
          .eq('is_available', true),
      ]);

      const allItems = [...(productsData || []), ...(accompData || [])];
      stockCount = allItems.filter((item: any) => {
        const stock = item.stocks?.[0];
        const qty = stock?.quantity ?? 0;
        const threshold = stock?.threshold ?? 5;
        return qty <= threshold;
      }).length;
    }

    return {
      orders: ordersCount || 0,
      notifications: notificationsCount || 0,
      bookings: bookingsCount || 0,
      stock: stockCount || 0,
    };
  } catch (error) {
    console.error('Error fetching sidebar counts:', error);
    return { orders: 0, stock: 0, bookings: 0, notifications: 0 };
  }
}
