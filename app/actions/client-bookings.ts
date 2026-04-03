'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { notifyStructureStaff } from '@/app/actions/push';

export async function createClientBooking(
  structureId: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
  guestName: string,
  phone: string
) {
  const session = await getSession();
  
  if (!roomId || !checkIn || !checkOut) {
    return { success: false, error: 'Room and dates are required' };
  }

  try {
    const admin = getAdminSupabase();

    // Verify room belongs to structure and is available
    const { data: room } = await admin
      .from('rooms')
      .select('structure_id, status, price')
      .eq('id', roomId)
      .single();

    if (!room || room.structure_id !== structureId) {
      return { success: false, error: 'Invalid room' };
    }

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

    // Insert booking (status starts as PENDING for client bookings)
    const { error } = await admin.from('bookings').insert({
      room_id: roomId,
      client_id: session?.userId || null,
      guest_name: guestName || null,
      phone: phone || null,
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      total_amount: totalAmount,
      status: 'PENDING'
    });

    if (error) {
      console.error('Create client booking log:', error);
      return { success: false, error: 'Failed to complete reservation' };
    }

    // For simplicity, mark the room as OCCUPIED automatically if they book today, but usually for hotels it stays available until check-in or is marked 'BOOKED'.
    // Let's just create the PENDING booking and let Reception validate it.

    // Notify structure staff
    await notifyStructureStaff({
      structureId,
      title: 'Nouvelle réservation (Web)',
      body: `Demande de réservation reçue au nom de ${guestName} du ${new Date(checkIn).toLocaleDateString()} au ${new Date(checkOut).toLocaleDateString()}`,
      url: `/bookings`,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Create client booking exception:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
