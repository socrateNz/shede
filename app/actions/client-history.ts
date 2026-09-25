'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { notifyStructureStaff, notifyUser } from '@/lib/notifications';
import { priceBooking, saveBookingTax } from '@/lib/fiscal';
import { te } from '@/lib/i18n/server';

export async function updateClientBooking(
  bookingId: string,
  checkIn: string,
  checkOut: string,
  action: 'UPDATE' | 'CANCEL'
) {
  const session = await getSession();
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const admin = getAdminSupabase();

  // Verify ownership
  const { data: booking } = await admin
    .from('bookings')
    .select('id, room_id, status, rooms!inner(structure_id)')
    .eq('id', bookingId)
    .eq('client_id', session.userId)
    .single();

  if (!booking) return { success: false, error: await te('errors.bookingNotFound') };
  
  if (booking.status !== 'PENDING') {
    return { success: false, error: await te('errors.onlyPendingBookingsModify') };
  }

  if (action === 'CANCEL') {
    const { error } = await admin
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', bookingId);
      
    if (error) return { success: false, error: await te('errors.bookingCancelFailed') };
    
    // Notify staff
    const roomsObj: any = booking.rooms;
    const structureId = Array.isArray(roomsObj) ? roomsObj[0]?.structure_id : roomsObj?.structure_id;
    if (structureId) {
      await notifyStructureStaff({
        structureId,
        message: ({ t }) => ({
          title: t('notify.bookingCancelled.title'),
          body: t('notify.bookingCancelled.body', { ref: bookingId.slice(0, 8) }),
        }),
        url: '/bookings',
        roles: ['ADMIN', 'RECEPTION', 'SUPER_ADMIN'],
      });
    }

    revalidatePath('/client/history');
    return { success: true };
  }

  // Action is UPDATE
  if (!checkIn || !checkOut) return { success: false, error: await te('errors.datesRequired') };

  const parsedCheckIn = new Date(checkIn).toISOString();
  const parsedCheckOut = new Date(checkOut).toISOString();

  // Check overlap excluding this booking
  const { data: overlappingBookings, error: overlapError } = await admin
    .from('bookings')
    .select('id, check_in, check_out')
    .eq('room_id', booking.room_id)
    .neq('id', bookingId)
    .in('status', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
    .lt('check_in', parsedCheckOut)
    .gt('check_out', parsedCheckIn);

  if (overlapError || (overlappingBookings && overlappingBookings.length > 0)) {
    return { success: false, error: await te('errors.datesUnavailable') };
  }

  // Recalculate price
  const nights = Math.max(1, Math.ceil((new Date(parsedCheckOut).getTime() - new Date(parsedCheckIn).getTime()) / (1000 * 60 * 60 * 24)));
  const { data: roomInfo } = await admin.from('rooms').select('price, structure_id').eq('id', booking.room_id).single();
  const pricing = await priceBooking(roomInfo?.structure_id ?? '', nights, roomInfo?.price || 0);

  const { error } = await admin
    .from('bookings')
    .update({
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      total_amount: pricing.total
    })
    .eq('id', bookingId);

  if (error) return { success: false, error: await te('errors.bookingDatesUpdateFailed') };
  await saveBookingTax(bookingId, pricing.tax, pricing.settings);

  const roomsObj2: any = booking.rooms;
  const structureId2 = Array.isArray(roomsObj2) ? roomsObj2[0]?.structure_id : roomsObj2?.structure_id;
  if (structureId2) {
    await notifyStructureStaff({
      structureId: structureId2,
      message: ({ t }) => ({
        title: t('notify.bookingDatesChanged.title'),
        body: t('notify.bookingDatesChanged.body', { ref: bookingId.slice(0, 8) }),
      }),
      url: '/bookings',
      roles: ['ADMIN', 'RECEPTION', 'SUPER_ADMIN'],
    });
  }

  revalidatePath('/client/history');
  return { success: true };
}

export async function cancelClientOrder(orderId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const admin = getAdminSupabase();

  // Verify ownership
  const { data: order } = await admin
    .from('orders')
    .select('id, status, structure_id')
    .eq('id', orderId)
    .or(`client_id.eq.${session.userId},user_id.eq.${session.userId}`)
    .single();

  if (!order) return { success: false, error: await te('errors.orderNotFound') };

  if (order.status !== 'PENDING') {
    return { success: false, error: await te('errors.onlyPendingOrdersCancel') };
  }

  const { error } = await admin
    .from('orders')
    .update({ status: 'CANCELLED' })
    .eq('id', orderId);

  if (error) return { success: false, error: await te('errors.orderCancelFailed') };

  await notifyStructureStaff({
    structureId: order.structure_id,
    message: ({ t }) => ({
      title: t('notify.orderCancelled.title'),
      body: t('notify.orderCancelled.body', { ref: order.id.slice(0, 8) }),
    }),
    url: `/orders/${order.id}`,
    roles: ['ADMIN', 'CAISSE', 'SERVEUR', 'SUPER_ADMIN'],
  });

  revalidatePath('/client/history');
  return { success: true };
}
