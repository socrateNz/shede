'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

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

export async function getStructureActiveShift(structureId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('shifts')
    .select('*')
    .eq('structure_id', structureId)
    .eq('status', 'OPEN')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching structure active shift:', error);
    return null;
  }
  return data;
}

export async function openShift(openingBalance: number) {
  const session = await getSession();
  if (!session?.userId || !session?.structureId) return { success: false, error: 'Unauthorized' };

  // Only Admin or Caisse can open a shift
  if (!['ADMIN', 'SUPER_ADMIN', 'CAISSE'].includes(session.role)) {
    return { success: false, error: 'Seuls les caissiers ou administrateurs peuvent ouvrir une session de caisse.' };
  }

  const admin = getAdminSupabase();
  
  // Check if a shift is already open
  const existing = await getActiveShift();
  if (existing) return { success: false, error: 'Une caisse est déjà ouverte pour cet utilisateur.' };

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

  if (error) return { success: false, error: error.message };
  
  revalidatePath('/');
  return { success: true, shift: data };
}

export async function closeShift(actualAmount: number, notes: string) {
  const session = await getSession();
  const activeShift = await getActiveShift();
  
  if (!session || !activeShift) return { success: false, error: 'No active shift found' };

  // Only Admin or Caisse can close a shift
  if (!['ADMIN', 'SUPER_ADMIN', 'CAISSE'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminSupabase();
  const now = new Date().toISOString();

  const safetyStartTime = new Date(new Date(activeShift.opened_at).getTime() - 60000).toISOString();
  
  // Orders revenue based on orders paid (paid_at) during the shift
  const { data: paidOrders } = await admin
    .from('orders')
    .select('total')
    .eq('structure_id', session.structureId)
    .eq('status', 'COMPLETED')
    .gte('paid_at', safetyStartTime);

  const orderRevenue = paidOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

  // Bookings revenue - based on when they were marked as PAID during the shift
  const { data: bookings } = await admin
    .from('bookings')
    .select('total_amount, rooms!inner(structure_id)')
    .eq('rooms.structure_id', session.structureId)
    .eq('is_paid', true)
    .gte('updated_at', safetyStartTime);

  const bookingRevenue = bookings?.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) || 0;

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

  if (error) return { success: false, error: error.message };

  revalidatePath('/');
  return { success: true, shift: data };
}

export async function getShiftReport(shiftId: string) {
  const admin = getAdminSupabase();
  
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .select('*, users(first_name, last_name), structures(name, address, phone)')
    .eq('id', shiftId)
    .single();

  if (shiftError) return null;

  const safetyStartTime = new Date(new Date(shift.opened_at).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const shiftOpening = new Date(shift.opened_at).getTime();
  const shiftClosing = new Date(shift.closed_at || new Date()).getTime() + 60000;

  // 1. Get ALL orders paid during this shift (using paid_at)
  const { data: allOrders } = await admin
    .from('orders')
    .select('id, total, status, paid_at, table_number, room_id, rooms(number), order_items(quantity, products(name))')
    .eq('structure_id', shift.structure_id)
    .eq('status', 'COMPLETED')
    .gte('paid_at', new Date(shiftOpening - 60000).toISOString())
    .lte('paid_at', new Date(shiftClosing).toISOString());

  const orderIds = Array.from(new Set((allOrders || []).map(o => o.id)));
  const orders = allOrders || [];

  // 3. Get Bookings marked as paid during the shift
  const { data: allBookings } = await admin
    .from('bookings')
    .select('*, rooms(number, type, structure_id)')
    .eq('is_paid', true)
    .gte('updated_at', new Date(shiftOpening - 60000).toISOString())
    .lte('updated_at', new Date(shiftClosing).toISOString());

  const bookings = (allBookings || []).filter(b => b.rooms?.structure_id === shift.structure_id);

  // 4. Breakdown by payment method (from payments table, linked to orders in shift)
  const { data: shiftPayments } = await admin
    .from('payments')
    .select('amount, payment_method, order_id')
    .in('order_id', orderIds)
    .eq('status', 'COMPLETED');

  const paymentMethods: Record<string, number> = {};
  shiftPayments?.forEach(p => {
    const method = p.payment_method || 'AUTRE';
    paymentMethods[method] = (paymentMethods[method] || 0) + p.amount;
  });

  return {
    shift,
    orders,
    bookings,
    paymentMethods,
  };
}

export async function getAllShifts(structureId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return [];
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('shifts')
    .select('*, users(first_name, last_name)')
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all shifts:', error);
    return [];
  }

  return data || [];
}
