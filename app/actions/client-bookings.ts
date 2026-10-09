'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { notifyStructureStaff } from '@/lib/notifications';
import { priceBooking, saveBookingTax } from '@/lib/fiscal';
import { te } from '@/lib/i18n/server';

export async function getRoomsForClient(structureId: string) {
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('rooms')
      .select('*')
      .eq('structure_id', structureId)
      .order('number', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('getRoomsForClient error:', error);
    return [];
  }
}

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
    return { success: false, error: await te('errors.roomDatesRequired') };
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
      return { success: false, error: await te('errors.invalidRoom') };
    }

    const parsedCheckIn = new Date(checkIn).toISOString();
    const parsedCheckOut = new Date(checkOut).toISOString();
    if (new Date(parsedCheckOut) <= new Date(parsedCheckIn)) {
      return { success: false, error: await te('errors.roomDatesRequired') };
    }

    const { data: overlappingBookings, error: overlapError } = await admin
      .from('bookings')
      .select('id, check_in, check_out')
      .eq('room_id', roomId)
      .in('status', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
      .lt('check_in', parsedCheckOut)
      .gt('check_out', parsedCheckIn);

    if (overlapError) {
       console.error('Overlap check error:', overlapError);
       return { success: false, error: await te('errors.availabilityCheckFailed') };
    }

    if (overlappingBookings && overlappingBookings.length > 0) {
       const periods = overlappingBookings.map(c => 
         `du ${new Date(c.check_in).toLocaleDateString('fr-FR')} au ${new Date(c.check_out).toLocaleDateString('fr-FR')}`
       );
       const message = periods.length === 1 
         ? await te('errors.roomTakenPeriod', { period: periods[0] })
         : await te('errors.roomTakenDates', { dates: periods.join(', ') });
       return { success: false, error: message };
    }

    const nights = Math.max(1, Math.ceil((new Date(parsedCheckOut).getTime() - new Date(parsedCheckIn).getTime()) / (1000 * 60 * 60 * 24)));
    const pricing = await priceBooking(room.structure_id, nights, room.price || 0);

    // Insert booking (status starts as PENDING for client bookings)
    const { data: created, error } = await admin.from('bookings').insert({
      room_id: roomId,
      client_id: session?.userId || null,
      guest_name: guestName || null,
      phone: phone || null,
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      total_amount: pricing.total,
      status: 'PENDING'
    }).select('id').single();

    if (error || !created) {
      console.error('Create client booking log:', error);
      return { success: false, error: await te('errors.bookingCompleteFailed') };
    }
    await saveBookingTax(created.id, pricing.tax, pricing.settings);

    // For simplicity, mark the room as OCCUPIED automatically if they book today, but usually for hotels it stays available until check-in or is marked 'BOOKED'.
    // Let's just create the PENDING booking and let Reception validate it.

    // Notify structure staff
    await notifyStructureStaff({
      structureId,
      message: ({ t, format }) => ({
        title: t('notify.webBooking.title'),
        body: t('notify.webBooking.body', { name: guestName, from: format.date(checkIn), to: format.date(checkOut) }),
      }),
      url: `/bookings`,
      roles: ['ADMIN', 'RECEPTION', 'SUPER_ADMIN'],
    });
    
    return { success: true };
  } catch (error) {
    console.error('Create client booking exception:', error);
    return { success: false, error: await te('errors.unexpected') };
  }
}
