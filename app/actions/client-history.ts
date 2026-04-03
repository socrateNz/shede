'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { notifyStructureStaff, notifyUser } from '@/app/actions/push';

export async function updateClientBooking(
  bookingId: string,
  checkIn: string,
  checkOut: string,
  action: 'UPDATE' | 'CANCEL'
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const admin = getAdminSupabase();

  // Verify ownership
  const { data: booking } = await admin
    .from('bookings')
    .select('id, room_id, status, rooms!inner(structure_id)')
    .eq('id', bookingId)
    .eq('client_id', session.userId)
    .single();

  if (!booking) return { success: false, error: 'Booking not found' };
  
  if (booking.status !== 'PENDING') {
    return { success: false, error: 'Only pending bookings can be modified' };
  }

  if (action === 'CANCEL') {
    const { error } = await admin
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', bookingId);
      
    if (error) return { success: false, error: 'Failed to cancel booking' };
    
    // Notify staff
    const roomsObj: any = booking.rooms;
    const structureId = Array.isArray(roomsObj) ? roomsObj[0]?.structure_id : roomsObj?.structure_id;
    if (structureId) {
      await notifyStructureStaff({
        structureId,
        title: 'Réservation annulée',
        body: `Le client a annulé la réservation ${bookingId.slice(0, 8)}.`,
        url: '/bookings',
      });
    }

    revalidatePath('/client/history');
    return { success: true };
  }

  // Action is UPDATE
  if (!checkIn || !checkOut) return { success: false, error: 'Dates required' };

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
    return { success: false, error: 'Dates non disponibles / Erreur vérification' };
  }

  // Recalculate price
  const nights = Math.max(1, Math.ceil((new Date(parsedCheckOut).getTime() - new Date(parsedCheckIn).getTime()) / (1000 * 60 * 60 * 24)));
  const { data: roomInfo } = await admin.from('rooms').select('price').eq('id', booking.room_id).single();
  const totalAmount = nights * (roomInfo?.price || 0);

  const { error } = await admin
    .from('bookings')
    .update({
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      total_amount: totalAmount
    })
    .eq('id', bookingId);

  if (error) return { success: false, error: 'Failed to update booking dates' };

  const roomsObj2: any = booking.rooms;
  const structureId2 = Array.isArray(roomsObj2) ? roomsObj2[0]?.structure_id : roomsObj2?.structure_id;
  if (structureId2) {
    await notifyStructureStaff({
      structureId: structureId2,
      title: 'Réservation modifiée',
      body: `Le client a modifié les dates de la réservation ${bookingId.slice(0, 8)}.`,
      url: '/bookings',
    });
  }

  revalidatePath('/client/history');
  return { success: true };
}

export async function cancelClientOrder(orderId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const admin = getAdminSupabase();

  // Verify ownership
  const { data: order } = await admin
    .from('orders')
    .select('id, status, structure_id')
    .eq('id', orderId)
    .or(`client_id.eq.${session.userId},user_id.eq.${session.userId}`)
    .single();

  if (!order) return { success: false, error: 'Order not found' };

  if (order.status !== 'PENDING') {
    return { success: false, error: 'Only PENDING orders can be cancelled' };
  }

  const { error } = await admin
    .from('orders')
    .update({ status: 'CANCELLED' })
    .eq('id', orderId);

  if (error) return { success: false, error: 'Failed to cancel order' };

  await notifyStructureStaff({
    structureId: order.structure_id,
    title: 'Commande annulée',
    body: `Le client a annulé la commande ${order.id.slice(0, 8)}.`,
    url: `/orders/${order.id}`,
  });

  revalidatePath('/client/history');
  return { success: true };
}
