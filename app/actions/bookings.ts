'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { buildMeta, emptyPage, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';
import { revalidatePath } from 'next/cache';
import { notifyUser } from '@/lib/notifications';
import { getActiveShift } from './shifts';
import { getStructureActiveShift } from '@/lib/shifts-server';
import { assignInvoiceNumber, priceBooking, saveBookingTax } from '@/lib/fiscal';
import { postSaleSafely } from '@/lib/accounting/posting';
import { te } from '@/lib/i18n/server';

export type BookingStatusStat = { count: number; revenue: number };
export type BookingListStats = { total: BookingStatusStat; byStatus: Record<string, BookingStatusStat> };
const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

/**
 * Réservations des chambres du point de la session, 20 par page (arrivée la plus récente
 * d'abord), filtre par statut et recherche par numéro de chambre ; statistiques en SQL.
 */
export async function listBookings(filters: { page?: number; q?: string; status?: string | null } = {}): Promise<Paginated<any, BookingListStats>> {
  const empty: BookingListStats = { total: { count: 0, revenue: 0 }, byStatus: {} };
  const session = await getSession();
  const page = Math.max(1, filters.page ?? 1);
  if (!session?.structureId || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const q = searchTerm(filters.q);

  let query = admin
    .from('bookings')
    .select('*, rooms!inner(id, number, type, structure_id, price, structures(*)), users:client_id(id, first_name, last_name, email)', { count: 'exact' })
    .eq('rooms.structure_id', session.structureId)
    .order('check_in', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (filters.status && BOOKING_STATUSES.includes(filters.status)) query = query.eq('status', filters.status);
  if (q) query = query.ilike('rooms.number', `%${q}%`);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('booking_list_stats', { p_structure_id: session.structureId })]);
  if (error) console.error('[listBookings] Error:', error);
  const raw = (statsRes.data ?? empty) as BookingListStats;
  const stats: BookingListStats = {
    total: { count: Number(raw.total?.count) || 0, revenue: Number(raw.total?.revenue) || 0 },
    byStatus: Object.fromEntries(Object.entries(raw.byStatus ?? {}).map(([k, v]) => [k, { count: Number(v.count) || 0, revenue: Number(v.revenue) || 0 }])),
  };
  return { items: data ?? [], meta: buildMeta(page, count ?? 0, stats) };
}

export async function createBooking(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Check if shift is open
  const activeShift = await getActiveShift();
  if (!activeShift && ['ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: await te('errors.registerClosed') };
  }

  const roomId = String(formData.get('roomId') || '');
  const clientId = String(formData.get('clientId') || '') || null; // Can be null if walking-in without account? Usually we need a client
  const clientName = String(formData.get('clientName') || ''); // Optional fallback if no client linked 
  const phone = String(formData.get('phone') || '').trim();
  const checkIn = String(formData.get('checkIn') || '');
  const checkOut = String(formData.get('checkOut') || '');

  if (!roomId || !checkIn || !checkOut || !phone) {
    return { success: false, error: await te('errors.roomDatesPhoneRequired') };
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
      return { success: false, error: await te('errors.invalidRoom') };
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
    const pricing = await priceBooking(session.structureId as string, nights, room.price || 0);

    const { data: created, error } = await admin.from('bookings').insert({
      room_id: roomId,
      client_id: clientId,
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      status: 'CONFIRMED',
      phone: phone || null,
      guest_name: clientName || null,
      total_amount: pricing.total
    }).select('id').single();

    if (error || !created) {
      return { success: false, error: await te('errors.bookingCreateFailed') };
    }
    await saveBookingTax(created.id, pricing.tax, pricing.settings);

    // Mark room as occupied if it's currently check-in date
    // Simple logic: if check-in is today, mark occupied.
    const today = new Date().toISOString().split('T')[0];
    if (checkIn.startsWith(today)) {
       await admin.from('rooms').update({ status: 'OCCUPIED' }).eq('id', roomId);
    }

    return { success: true, error: '' };
  } catch (error) {
    console.error('Create booking error:', error);
    return { success: false, error: await te('errors.unexpected') };
  }
}

/** Réservation d'une chambre du point (null sinon). */
async function ownedBooking(structureId: string | undefined, bookingId: string) {
  if (!structureId) return null;
  const { data } = await getAdminSupabase()
    .from('bookings')
    .select('id, room_id, rooms!inner(structure_id)')
    .eq('id', bookingId)
    .eq('rooms.structure_id', structureId)
    .maybeSingle();
  return data as { id: string; room_id: string } | null;
}

export async function updateBookingStatus(bookingId: string, status: string, roomId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: await te('errors.registerClosedBooking') };
  }

  try {
    const admin = getAdminSupabase();

    if (!['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return { success: false, error: await te('errors.statusUpdateFailed') };
    }
    // La réservation doit être une chambre du point de la session ; la chambre vient de la
    // réservation elle-même, jamais de l'identifiant envoyé par le navigateur (roomId ignoré).
    const owned = await ownedBooking(session.structureId, bookingId);
    if (!owned) return { success: false, error: await te('errors.bookingNotFound') };
    roomId = owned.room_id;

    const { error } = await admin
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) {
      return { success: false, error: await te('errors.statusUpdateFailed') };
    }

    // Auto-update room status based on booking status
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      await admin.from('rooms').update({ status: 'AVAILABLE' }).eq('id', roomId);
      if (status === 'COMPLETED') await postSaleSafely('BOOKING', bookingId);
    } else if (status === 'IN_PROGRESS' || status === 'CONFIRMED') {
      await admin.from('rooms').update({ status: 'OCCUPIED' }).eq('id', roomId);
    }

    // Notify client
    const { data: booking } = await admin.from('bookings').select('client_id').eq('id', bookingId).single();
    if (booking?.client_id) {
      await notifyUser({
        userId: booking.client_id,
        structureId: session.structureId!,
        message: ({ t }) => ({
          title: t('notify.bookingUpdated.title'),
          body: t('notify.bookingUpdated.body', {
            ref: bookingId.slice(0, 8),
            status: t(`hotel.bookingStatus.${status as 'PENDING'}`),
          }),
        }),
        url: `/history`,
      });
    }

    revalidatePath('/bookings');
    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.unexpected') };
  }
}

export async function markBookingAsPaid(bookingId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'RECEPTION'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: await te('errors.registerClosed') };
  }

  try {
    const admin = getAdminSupabase();
    // Assuming we add a new column `is_paid`
    // If we don't have it yet, this will error in Supabase but we'll then add the column
    if (!(await ownedBooking(session.structureId, bookingId))) {
      return { success: false, error: await te('errors.bookingNotFound') };
    }
    const { error } = await admin
      .from('bookings')
      .update({ is_paid: true })
      .eq('id', bookingId);

    if (error) {
      console.error('markBookingAsPaid error:', error);
      return { success: false, error: await te('errors.bookingPaymentFailed') };
    }

    // Numéro de facture continu du point (idempotent).
    await assignInvoiceNumber('BOOKING', bookingId);
    await postSaleSafely('BOOKING', bookingId);

    revalidatePath('/bookings');
    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.unexpected') };
  }
}

