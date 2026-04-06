'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { notifyUser } from '@/app/actions/push';
import { getActiveShift, getStructureActiveShift } from './shifts';

export async function getBookings(structureId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data: bookings, error } = await admin
      .from('bookings')
      .select(`
        *,
        rooms!inner(id, number, type, structure_id, price),
        users!bookings_client_id_fkey(id, first_name, last_name, email)
      `)
      .eq('rooms.structure_id', structureId)
      .order('check_in', { ascending: false });

    // Fallback if the explicit foreign key name is wrong
    if (error && error.message.includes('foreign key')) {
      const { data: fallbackBookings } = await admin
        .from('bookings')
        .select(`
          *,
          rooms!inner(id, number, type, structure_id),
          users:client_id(id, first_name, last_name, email)
        `)
        .eq('rooms.structure_id', structureId)
        .order('check_in', { ascending: false });
      return fallbackBookings || [];
    }

    if (error) {
      console.error('Fetch bookings error:', error);
      return [];
    }

    return bookings || [];
  } catch (error) {
    return [];
  }
}

export async function createBooking(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if shift is open
  const activeShift = await getActiveShift();
  if (!activeShift && ['ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: 'La caisse doit être ouverte pour effectuer cette opération.' };
  }

  const roomId = String(formData.get('roomId') || '');
  const clientId = String(formData.get('clientId') || '') || null; // Can be null if walking-in without account? Usually we need a client
  const clientName = String(formData.get('clientName') || ''); // Optional fallback if no client linked 
  const phone = String(formData.get('phone') || '').trim();
  const checkIn = String(formData.get('checkIn') || '');
  const checkOut = String(formData.get('checkOut') || '');

  if (!roomId || !checkIn || !checkOut || !phone) {
    return { success: false, error: 'Room, dates, and phone number are required' };
  }

  try {
    const admin = getAdminSupabase();

    // Verify room belongs to structure
    const { data: room } = await admin
      .from('rooms')
      .select('structure_id, price')
      .eq('id', roomId)
      .single();

    if (!room || room.structure_id !== session.structureId) {
      return { success: false, error: 'Invalid room' };
    }

    // Checking for overlapping bookings
    const parsedCheckIn = new Date(checkIn).toISOString();
    const parsedCheckOut = new Date(checkOut).toISOString();

    const { data: overlappingBookings, error: overlapError } = await admin
      .from('bookings')
      .select('id, check_in, check_out')
      .eq('room_id', roomId)
      .in('status', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
      .lt('check_in', parsedCheckOut)
      .gt('check_out', parsedCheckIn);

    if (overlapError) {
       console.error('Overlap check error:', overlapError);
       return { success: false, error: 'Erreur lors de la vérification des disponibilités' };
    }

    if (overlappingBookings && overlappingBookings.length > 0) {
       const periods = overlappingBookings.map(c => 
         `du ${new Date(c.check_in).toLocaleDateString('fr-FR')} au ${new Date(c.check_out).toLocaleDateString('fr-FR')}`
       );
       const message = periods.length === 1 
         ? `Cette chambre est déjà prise pour la période ${periods[0]}.`
         : `Cette chambre est déjà prise pour les dates suivantes : ${periods.join(', ')}.`;
       return { success: false, error: message };
    }

    const nights = Math.max(1, Math.ceil((new Date(parsedCheckOut).getTime() - new Date(parsedCheckIn).getTime()) / (1000 * 60 * 60 * 24)));
    const totalAmount = nights * (room.price || 0);

    const { error } = await admin.from('bookings').insert({
      room_id: roomId,
      client_id: clientId,
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      status: 'CONFIRMED',
      phone: phone || null,
      guest_name: clientName || null,
      total_amount: totalAmount
    });

    if (error) {
      return { success: false, error: 'Failed to create booking' };
    }

    // Mark room as occupied if it's currently check-in date
    // Simple logic: if check-in is today, mark occupied.
    const today = new Date().toISOString().split('T')[0];
    if (checkIn.startsWith(today)) {
       await admin.from('rooms').update({ status: 'OCCUPIED' }).eq('id', roomId);
    }

    return { success: true, error: '' };
  } catch (error) {
    console.error('Create booking error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateBookingStatus(bookingId: string, status: string, roomId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: 'La caisse doit être ouverte pour modifier le statut d\'une réservation.' };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) {
      return { success: false, error: 'Failed to update status' };
    }

    // Auto-update room status based on booking status
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      await admin.from('rooms').update({ status: 'AVAILABLE' }).eq('id', roomId);
    } else if (status === 'IN_PROGRESS' || status === 'CONFIRMED') {
      await admin.from('rooms').update({ status: 'OCCUPIED' }).eq('id', roomId);
    }

    // Notify client
    const { data: booking } = await admin.from('bookings').select('client_id').eq('id', bookingId).single();
    if (booking?.client_id) {
      await notifyUser({
        userId: booking.client_id,
        structureId: session.structureId!,
        title: `Mise à jour de votre réservation`,
        body: `Votre réservation ${bookingId.slice(0, 8)} est désormais : ${status}`,
        url: `/history`,
      });
    }

    revalidatePath('/bookings');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function markBookingAsPaid(bookingId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: 'La caisse doit être ouverte pour effectuer cette opération.' };
  }

  try {
    const admin = getAdminSupabase();
    // Assuming we add a new column `is_paid`
    // If we don't have it yet, this will error in Supabase but we'll then add the column
    const { error } = await admin
      .from('bookings')
      .update({ is_paid: true })
      .eq('id', bookingId);

    if (error) {
      console.error('markBookingAsPaid error:', error);
      return { success: false, error: 'Failed to record payment' };
    }

    revalidatePath('/bookings');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

